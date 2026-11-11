import Link from "next/link";
import { currentUser } from "@/lib/supabase";
import { UserRole } from "@/lib/domain";

/**
 * Link cuyo destino depende de la sesión. Se renderiza detrás de <Suspense>
 * para que el shell estático de la página siga siendo prerenderizable
 * (Cache Components, Next 16).
 */
export async function AuthLink({
    className,
    children,
    authedChildren,
    guestHref = "/login",
}: {
    className?: string;
    children: React.ReactNode;
    /** Contenido alternativo cuando hay sesión (p.ej. "Ir a mi panel"). */
    authedChildren?: React.ReactNode;
    guestHref?: string;
}) {
    const user = await currentUser().catch(() => null);
    const href = user ? (user.role === UserRole.Admin ? "/admin" : "/chofer") : guestHref;

    return (
        <Link href={href} className={className}>
            {user && authedChildren ? authedChildren : children}
        </Link>
    );
}
