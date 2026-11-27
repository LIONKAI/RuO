import { describe, expect, it } from 'vitest';
import { haversine, rebalanceCapacities, splitPool } from '../fleet';
import { instruction } from '../directions';
import { trackingLink, deliveredLink } from '../whatsapp';

describe('haversine', () => {
    it('distancia cero entre puntos iguales', () => {
        expect(haversine([-17.78, -63.18], [-17.78, -63.18])).toBe(0);
    });

    it('calcula distancia realista entre dos puntos de Santa Cruz (~1km)', () => {
        const d = haversine([-17.7833, -63.1821], [-17.7923, -63.1821]);
        expect(d).toBeGreaterThan(900);
        expect(d).toBeLessThan(1100);
    });
});

describe('splitPool', () => {
    const pool = [
        { id: 1, latitude: -17.70, longitude: -63.10 }, // norte-este
        { id: 2, latitude: -17.71, longitude: -63.11 },
        { id: 3, latitude: -17.85, longitude: -63.25 }, // sur-oeste
        { id: 4, latitude: -17.86, longitude: -63.26 },
    ];

    it('un solo vehículo recibe todo el pool', () => {
        const groups = splitPool(pool, [{ id: 10, depot: null }]);
        expect(groups.get(10)).toHaveLength(4);
    });

    it('asigna cada clúster al depósito más cercano', () => {
        const groups = splitPool(pool, [
            { id: 10, depot: { latitude: -17.70, longitude: -63.10 } }, // cerca NE
            { id: 20, depot: { latitude: -17.85, longitude: -63.25 } }, // cerca SO
        ]);

        expect(groups.get(10)?.map((d) => d.id).sort()).toEqual([1, 2]);
        expect(groups.get(20)?.map((d) => d.id).sort()).toEqual([3, 4]);
    });

    it('reparte todo el pool aunque haya vehículos sin depósito', () => {
        const groups = splitPool(pool, [
            { id: 10, depot: { latitude: -17.70, longitude: -63.10 } },
            { id: 20, depot: null },
        ]);
        const total = [...groups.values()].flat().length;
        expect(total).toBe(4);
    });
});

describe('instruction (OSRM → español)', () => {
    it('depart con calle', () => {
        expect(instruction({ maneuver: { type: 'depart' }, name: 'Av. Busch' })).toBe('Sal por Av. Busch');
    });
    it('arrive', () => {
        expect(instruction({ maneuver: { type: 'arrive' } })).toBe('Llegaste al destino');
    });
    it('rotonda con salida ordinal', () => {
        expect(instruction({ maneuver: { type: 'roundabout', exit: 2 }, name: 'Radial 27' }))
            .toBe('En la rotonda, toma la segunda salida hacia Radial 27');
    });
    it('giro a la derecha', () => {
        expect(instruction({ maneuver: { type: 'turn', modifier: 'right' }, name: 'Calle Sucre' }))
            .toBe('Gira a la derecha en Calle Sucre');
    });
});

describe('whatsapp links', () => {
    const delivery = { phone: '700 12345', reference: 'PKG-001' };

    it('tracking link normaliza móvil boliviano', () => {
        const link = trackingLink(delivery, 'https://ruo.app/seguimiento/abc');
        expect(link).toContain('https://wa.me/59170012345?text=');
        expect(link).toContain(encodeURIComponent('https://ruo.app/seguimiento/abc'));
    });

    it('sin teléfono retorna null', () => {
        expect(trackingLink({ phone: null, reference: 'X' }, 'https://x')).toBeNull();
        expect(deliveredLink({ phone: '', reference: 'X' })).toBeNull();
    });

    it('conserva prefijo internacional existente', () => {
        expect(deliveredLink({ phone: '+591 70012345', reference: 'P' })).toContain('wa.me/59170012345');
    });
});

describe('rebalanceCapacities', () => {
    const depot = { latitude: -17.78, longitude: -63.18 };
    const cerca = (n: number) => Array.from({ length: n }, (_, i) => ({ latitude: -17.78 + i * 0.001, longitude: -63.18, demandUnits: 1 }));
    const lejos = { latitude: -17.6, longitude: -63.0, demandUnits: 1 };

    it('sin capacidad (null) no mueve nada', () => {
        const items = cerca(10);
        const groups = new Map([[1, items]]);
        const { groups: out, leftover } = rebalanceCapacities(groups, [{ id: 1, depot, capacityUnits: null }], (d) => d.demandUnits);
        expect(out.get(1)).toHaveLength(10);
        expect(leftover).toHaveLength(0);
    });

    it('exceso se mueve a otro vehículo con espacio', () => {
        const items = cerca(8);
        const groups = new Map<number, typeof items>([[1, items], [2, []]]);
        const { groups: out, leftover } = rebalanceCapacities(groups, [
            { id: 1, depot, capacityUnits: 5 },
            { id: 2, depot, capacityUnits: 5 },
        ], (d) => d.demandUnits);
        expect(out.get(1)).toHaveLength(5);
        expect(out.get(2)).toHaveLength(3);
        expect(leftover).toHaveLength(0);
    });

    it('lo que no cabe en ninguna parte queda en leftover', () => {
        const items = cerca(8);
        const groups = new Map<number, typeof items>([[1, items]]);
        const { leftover } = rebalanceCapacities(groups, [
            { id: 1, depot, capacityUnits: 5 },
        ], (d) => d.demandUnits);
        expect(leftover).toHaveLength(3);
    });

    it('respeta la demanda en unidades, no solo el conteo', () => {
        const pesado = { ...cerca(1)[0], demandUnits: 4 };
        const liviano = { ...cerca(1)[0], demandUnits: 1 };
        const groups = new Map([[1, [pesado, liviano, liviano]]]);
        const { groups: out, leftover } = rebalanceCapacities(groups, [
            { id: 1, depot, capacityUnits: 5 },
        ], (d) => d.demandUnits);
        // 4+1+1 = 6 > 5: un liviano debe salir.
        expect(out.get(1)!.reduce((s, d) => s + d.demandUnits, 0)).toBeLessThanOrEqual(5);
        expect(leftover.length + (out.get(1)?.length ?? 0)).toBe(3);
    });
});
