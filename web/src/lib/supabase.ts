import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { UserRole } from './domain';

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cliente para Server Components / Route Handlers (lee cookies de la request). */
export async function supabaseServer() {
    const store = await cookies();

    return createServerClient(url(), anonKey(), {
        cookies: {
            getAll: () => store.getAll(),
            setAll: (list) => {
                try {
                    list.forEach(({ name, value, options }) => store.set(name, value, options));
                } catch {
                    // Llamado desde un Server Component puro; el proxy refresca la sesión.
                }
            },
        },
    });
}

/** Cliente de navegador para componentes 'use client'. */
export function supabaseBrowser() {
    return createBrowserClient(url(), anonKey());
}

/** Admin API (service role) — solo en route handlers del servidor. */
export function supabaseAdmin() {
    return createClient(url(), process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
}

export interface SessionUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
}

/** Usuario actual + perfil (rol). null si no hay sesión.
 *  'use cache: private' permite invocarlo detrás de <Suspense> con prefetch
 *  (lee cookies, así que solo vive en el navegador — nunca en caché de servidor). */
export async function currentUser(): Promise<SessionUser | null> {
    'use cache: private';

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return null;
    }

    const supabase = await supabaseServer();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single();

    return {
        id: user.id,
        email: user.email ?? '',
        name: profile?.name ?? user.email ?? '',
        role: (profile?.role as UserRole) ?? 'driver',
    };
}
