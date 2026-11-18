import 'server-only';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { vehicles } from '@/db/schema';
import type { Vehicle } from '@/db/schema';
import { currentUser, type SessionUser } from '@/lib/supabase';
import { UserRole } from '@/lib/domain';

/**
 * Guardas para server actions. Mostrar un formulario solo en una página
 * protegida no es una barrera de seguridad: cada acción revalida aquí.
 */
export async function requireAdmin(): Promise<SessionUser> {
    const user = await currentUser();
    if (!user) redirect('/login');
    if (user.role !== UserRole.Admin) redirect('/chofer');
    return user;
}

/** Chofer autenticado y su vehículo asignado (null si aún no tiene). */
export async function requireDriver(): Promise<{ user: SessionUser; vehicle: Vehicle | null }> {
    const user = await currentUser();
    if (!user) redirect('/login');
    if (user.role !== UserRole.Driver) redirect('/admin');

    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, user.id));
    return { user, vehicle: vehicle ?? null };
}
