// Dominio RuO: enums y tipos compartidos entre UI y servicios.

export const DestinationStatus = {
    Pending: 'pending',
    Completed: 'completed',
    Failed: 'failed',
} as const;
export type DestinationStatus = (typeof DestinationStatus)[keyof typeof DestinationStatus];

export const WorkdayStatus = {
    Draft: 'draft',
    InProgress: 'in_progress',
    Completed: 'completed',
} as const;
export type WorkdayStatus = (typeof WorkdayStatus)[keyof typeof WorkdayStatus];

export const UserRole = {
    Superadmin: 'superadmin',
    Admin: 'admin',
    Driver: 'driver',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const destinationStatusLabel: Record<DestinationStatus, string> = {
    pending: 'Pendiente',
    completed: 'Entregado',
    failed: 'Fallido',
};

export const workdayStatusLabel: Record<WorkdayStatus, string> = {
    draft: 'Sin iniciar',
    in_progress: 'En ruta',
    completed: 'Completada',
};

/** Motivos de entrega fallida disponibles para el chofer. */
export const failureReasons: Record<string, string> = {
    customer_absent: 'Cliente ausente',
    wrong_address: 'Dirección incorrecta',
    refused: 'Entrega rechazada',
    business_closed: 'Negocio cerrado',
    other: 'Otro motivo',
};

export interface Coordinates {
    latitude: number;
    longitude: number;
}

export interface OsrmLegStep {
    distanceMeters: number;
    durationSeconds: number;
    text: string;
}

export interface RouteLeg {
    position: number;
    distanceMeters: number;
    durationSeconds: number;
    geometry: [number, number][];
    steps: OsrmLegStep[];
}

/**
 * Zona horaria de la operación. Vercel ejecuta en UTC: sin esto, a partir de
 * las 20:00 en Bolivia "hoy" sería el día siguiente y las horas saldrían +4 h.
 */
export const APP_TIME_ZONE = 'America/La_Paz';

/** Fecha actual (YYYY-MM-DD) en la zona horaria de la operación. */
export const todayIso = (now: Date = new Date()): string =>
    new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

/** true si el valor es una fecha real con formato YYYY-MM-DD. */
export const isIsoDate = (value: unknown): value is string => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/** Hora local de la operación, p. ej. "14:05". */
export const formatTime = (value: Date | string | number): string =>
    new Date(value).toLocaleTimeString('es-BO', { timeZone: APP_TIME_ZONE, hour: '2-digit', minute: '2-digit' });

/** Fecha y hora local de la operación. */
export const formatDateTime = (value: Date | string | number): string =>
    new Date(value).toLocaleString('es-BO', { timeZone: APP_TIME_ZONE });
