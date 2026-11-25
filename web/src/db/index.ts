import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Conexión a Postgres de Supabase para Drizzle.
 *
 * En Vercel (serverless) usa el "Transaction pooler" de Supabase (puerto 6543):
 * cada instancia abre pocas conexiones y el pooler las reparte, así no se agota
 * el límite de conexiones del plan gratuito. `prepare: false` es obligatorio en
 * ese modo. En desarrollo el cliente se reutiliza entre recargas en caliente.
 */
const globalForDb = globalThis as unknown as { ruoSql?: postgres.Sql };

const client = globalForDb.ruoSql ?? postgres(process.env.DATABASE_URL!, {
    prepare: false,
    // Una función serverless ejecuta sus queries en serie: conexión única por
    // instancia evita agotar los slots del pooler bajo ráfagas concurrentes.
    max: Number(process.env.DATABASE_POOL_MAX ?? 1),
    idle_timeout: 20,
    connect_timeout: 10,
    // Recicla conexiones antes de que el pooler las cierre por inactividad.
    max_lifetime: 60 * 5,
});

if (process.env.NODE_ENV !== 'production') globalForDb.ruoSql = client;

export const db = drizzle(client, { schema });
