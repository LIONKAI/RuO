import { describe, expect, it } from 'vitest';
import { activeStop, driverStopError, formId, isUniqueViolation, podFileError } from '../guards';
import { isIsoDate, todayIso } from '../domain';

const stops = [
    { id: 1, status: 'completed', position: 1 },
    { id: 2, status: 'pending', position: 3 },
    { id: 3, status: 'pending', position: 2 },
];
const running = { vehicleId: 10, status: 'in_progress' };

describe('activeStop', () => {
    it('es la primera parada pendiente según la posición', () => {
        expect(activeStop(stops)?.id).toBe(3);
    });

    it('es null cuando no quedan pendientes', () => {
        expect(activeStop([{ id: 1, status: 'completed', position: 1 }])).toBeNull();
    });
});

describe('driverStopError', () => {
    it('permite al chofer asignado actuar sobre la parada activa', () => {
        expect(driverStopError(10, running, stops, 3)).toBeNull();
    });

    it('rechaza a un chofer de otro vehículo', () => {
        expect(driverStopError(99, running, stops, 3)).toMatch(/chofer asignado/);
    });

    it('rechaza a un chofer sin vehículo', () => {
        expect(driverStopError(null, running, stops, 3)).toMatch(/no tiene vehículo/);
    });

    it('obliga a respetar el orden de la ruta', () => {
        expect(driverStopError(10, running, stops, 2)).toMatch(/orden de la ruta/);
    });

    it('rechaza paradas ya cerradas o jornadas que no están en curso', () => {
        expect(driverStopError(10, running, stops, 1)).toMatch(/ya no está pendiente/);
        expect(driverStopError(10, { vehicleId: 10, status: 'draft' }, stops, 3)).toMatch(/ya no está pendiente/);
    });

    it('rechaza una parada que no pertenece a la jornada', () => {
        expect(driverStopError(10, running, stops, 42)).toMatch(/ya no está pendiente/);
    });
});

describe('podFileError', () => {
    it('acepta imágenes JPG, PNG y WebP pequeñas', () => {
        expect(podFileError({ size: 300_000, type: 'image/jpeg' })).toBeNull();
        expect(podFileError({ size: 20_000, type: 'image/png' })).toBeNull();
    });

    it('rechaza otros tipos y archivos grandes', () => {
        expect(podFileError({ size: 1000, type: 'application/pdf' })).toMatch(/JPG, PNG o WebP/);
        expect(podFileError({ size: 10 * 1024 * 1024, type: 'image/jpeg' })).toMatch(/demasiado grande/);
    });
});

describe('isUniqueViolation', () => {
    it('detecta el código 23505 directo o envuelto por Drizzle', () => {
        expect(isUniqueViolation({ code: '23505' })).toBe(true);
        expect(isUniqueViolation({ cause: { code: '23505' } })).toBe(true);
        expect(isUniqueViolation(new Error('otro'))).toBe(false);
    });
});

describe('formId', () => {
    it('solo acepta enteros positivos', () => {
        const fd = new FormData();
        fd.set('ok', '7');
        fd.set('bad', 'abc');
        fd.set('neg', '-1');
        expect(formId(fd, 'ok')).toBe(7);
        expect(formId(fd, 'bad')).toBeNull();
        expect(formId(fd, 'neg')).toBeNull();
        expect(formId(fd, 'missing')).toBeNull();
    });
});

describe('fechas en hora de Bolivia', () => {
    it('a las 21:00 en Santa Cruz sigue siendo el mismo día (aunque en UTC ya sea mañana)', () => {
        expect(todayIso(new Date('2026-11-18T01:00:00Z'))).toBe('2026-11-17');
    });

    it('valida fechas YYYY-MM-DD reales', () => {
        expect(isIsoDate('2026-11-17')).toBe(true);
        expect(isIsoDate('2026-02-30')).toBe(false);
        expect(isIsoDate('17/11/2026')).toBe(false);
        expect(isIsoDate(undefined)).toBe(false);
    });
});
