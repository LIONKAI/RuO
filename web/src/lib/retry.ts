import 'server-only';

/**
 * Errores transitorios de Postgres/red que merecen reintento:
 * la conexión se cayó a mitad de camino, el pooler recicló el slot,
 * o el proyecto Supabase estaba despertando de la pausa del plan gratuito.
 */
const TRANSIENT_CODES = new Set([
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENETUNREACH',
    '57P01', // admin_shutdown
    '53300', // too_many_connections
    '08000', '08001', '08003', '08004', '08006', '08007', // connection exception family
]);

const TRANSIENT_PATTERNS = [
    /connection (terminated|closed|refused|reset|timed out|lost)/i,
    /terminating connection/i,
    /socket hang up/i,
    /remaining connection slots/i,
    /timeout exceeded when trying to connect/i,
];

export function isTransientDbError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) return false;
    const e = error as { code?: unknown; message?: unknown; cause?: unknown };
    const code = String(e.code ?? '');
    if (TRANSIENT_CODES.has(code) || (code.startsWith('08') && code.length === 5)) return true;
    const message = String(e.message ?? '');
    if (TRANSIENT_PATTERNS.some((p) => p.test(message))) return true;
    // Errores envueltos por Drizzle/node
    if (e.cause !== undefined && e.cause !== error) return isTransientDbError(e.cause);
    return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ejecuta una lectura con reintentos ante errores transitorios de conexión.
 * Solo para operaciones idempotentes (SELECT) — no envuelvas escrituras.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (!isTransientDbError(error) || i === attempts - 1) throw error;
            await sleep(150 * (i + 1));
        }
    }
    throw lastError;
}
