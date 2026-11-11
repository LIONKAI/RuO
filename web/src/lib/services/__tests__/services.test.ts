import { describe, expect, it } from 'vitest';
import { haversine, splitPool } from '../fleet';
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
