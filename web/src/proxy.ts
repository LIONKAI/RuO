import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PROTECTED = ['/admin', '/chofer'];
const ROLE_HOME: Record<string, string> = { admin: '/admin', driver: '/chofer' };

/**
 * Proxy (antes "middleware" en Next <16): refresca la cookie de sesión de
 * Supabase y redirige rutas protegidas por rol. La autorización fina se
 * revalida en cada página/handler — el proxy es solo la puerta.
 */
export async function proxy(request: NextRequest) {
    const response = NextResponse.next({ request });
    const path = request.nextUrl.pathname;
    const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

    // Sin proyecto Supabase configurado aún: tratar como invitado.
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        if (isProtected) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }
        return response;
    }

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (list) => {
                    list.forEach(({ name, value }) => request.cookies.set(name, value));
                    list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
                },
            },
        },
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        if (isProtected) {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            url.searchParams.set('next', path);
            return NextResponse.redirect(url);
        }
        return response;
    }

    if (path === '/login') {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        const url = request.nextUrl.clone();
        url.pathname = ROLE_HOME[profile?.role ?? 'driver'] ?? '/chofer';
        url.search = '';
        return NextResponse.redirect(url);
    }

    return response;
}

export const config = {
    matcher: ['/admin/:path*', '/chofer/:path*', '/login'],
};
