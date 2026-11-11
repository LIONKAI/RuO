import { currentUser } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { UserRole } from "@/lib/domain";
import { AppShell } from "@/components/AppShell";

// Página dinámica: la sesión define el contenido, no hay shell estático útil.
export const instant = false;

export default async function AdminDashboard() {
    const user = await currentUser();
    if (!user) redirect("/login");
    if (user.role !== UserRole.Admin) redirect("/chofer");

    return (
        <AppShell user={user} section="admin">
            <p className="eyebrow mb-1 text-ruo-600">Panel</p>
            <h1 className="mb-6 font-display text-3xl font-extrabold uppercase">Flota del día</h1>
            <div className="corners border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
                Panel administrador — en migración desde Laravel. Próximo: mapa de flota en vivo, pool de pedidos y optimización por vehículo.
            </div>
        </AppShell>
    );
}
