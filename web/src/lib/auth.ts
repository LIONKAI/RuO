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
 * Toda acción de empresa opera con el companyId que devuelven estas guardas;
 * NUNCA con un id que venga del cliente.
 */

export interface AdminContext {
    user: SessionUser;
    companyId: string;
}

/** Admin de empresa autenticado, con empresa activa. Redirige si no. */
export async function requireAdmin(): Promise<AdminContext> {
    const user = await currentUser();
    if (!user) redirect('/login');
    if (user.role === UserRole.Superadmin) redirect('/plataforma');
    if (user.role !== UserRole.Admin) redirect('/chofer');
    if (!user.companyId) redirect('/login?error=sin-empresa');
    if (!user.companyActive) redirect('/suspendida');
    return { user, companyId: user.companyId };
}

/** Superadmin de la plataforma (dueño de RuO). */
export async function requireSuperadmin(): Promise<SessionUser> {
    const user = await currentUser();
    if (!user) redirect('/login');
    if (user.role !== UserRole.Superadmin) redirect(user.role === UserRole.Admin ? '/admin' : '/chofer');
    return user;
}

/** Chofer autenticado y su vehículo asignado (null si aún no tiene). */
export async function requireDriver(): Promise<{ user: SessionUser; vehicle: Vehicle | null }> {
    const user = await currentUser();
    if (!user) redirect('/login');
    if (user.role === UserRole.Superadmin) redirect('/plataforma');
    if (user.role !== UserRole.Driver) redirect('/admin');
    if (user.companyId && !user.companyActive) redirect('/suspendida');

    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, user.id));
    return { user, vehicle: vehicle ?? null };
}
