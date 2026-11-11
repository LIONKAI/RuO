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

export const todayIso = (): string => new Date().toISOString().slice(0, 10);
