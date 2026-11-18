// Reglas de autorización y validación puras (sin BD) — port de App\Policies\DestinationPolicy.
import { DestinationStatus, WorkdayStatus } from './domain';

interface StopLike {
    id: number;
    status: string;
    position: number | null;
}

interface WorkdayLike {
    vehicleId: number;
    status: string;
}

/** Parada activa de la ruta: la primera pendiente según el orden calculado. */
export function activeStop<T extends StopLike>(stops: T[]): T | null {
    const pending = stops
        .filter((s) => s.status === DestinationStatus.Pending)
        .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER) || a.id - b.id);
    return pending[0] ?? null;
}

/**
 * ¿Puede el chofer de `vehicleId` completar o marcar como fallida la parada?
 * Devuelve el motivo del rechazo, o null si está permitido.
 */
export function driverStopError(
    vehicleId: number | null,
    workday: WorkdayLike | null,
    stops: StopLike[],
    destinationId: number,
): string | null {
    if (vehicleId === null) return 'Tu cuenta no tiene vehículo asignado.';
    if (!workday || workday.vehicleId !== vehicleId) {
        return 'Solo el chofer asignado a este vehículo puede registrar esta entrega.';
    }

    const stop = stops.find((s) => s.id === destinationId);
    if (!stop || workday.status !== WorkdayStatus.InProgress || stop.status !== DestinationStatus.Pending) {
        return 'Este destino ya no está pendiente.';
    }

    if (activeStop(stops)?.id !== destinationId) return 'Completa los destinos en el orden de la ruta.';

    return null;
}

/** Límite por archivo de prueba de entrega (el cliente ya comprime las fotos). */
export const POD_MAX_BYTES = 3 * 1024 * 1024;
export const POD_MIME_TYPES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

/** Motivo de rechazo de un archivo de prueba de entrega, o null si es válido. */
export function podFileError(file: { size: number; type: string }): string | null {
    if (!(file.type in POD_MIME_TYPES)) return 'La foto debe ser JPG, PNG o WebP.';
    if (file.size > POD_MAX_BYTES) return 'La foto es demasiado grande (máx. 3 MB).';
    return null;
}

/** Violación de restricción UNIQUE de Postgres (directa o envuelta por Drizzle). */
export function isUniqueViolation(error: unknown): boolean {
    const codeOf = (e: unknown) => (typeof e === 'object' && e !== null && 'code' in e ? (e as { code: unknown }).code : undefined);
    const cause = typeof error === 'object' && error !== null && 'cause' in error ? (error as { cause: unknown }).cause : undefined;
    return codeOf(error) === '23505' || codeOf(cause) === '23505';
}

/** Lee un id numérico positivo de un FormData. */
export function formId(formData: FormData, key: string): number | null {
    const value = Number(formData.get(key));
    return Number.isInteger(value) && value > 0 ? value : null;
}
