import { currentUser } from "@/lib/supabase";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";

export const instant = false;

export default async function DriverView() {
    const user = await currentUser();
    if (!user) redirect("/login");

    return (
        <AppShell user={user} section="chofer">
            <p className="eyebrow mb-1 text-ruo-600">Mi jornada</p>
            <h1 className="mb-6 font-display text-3xl font-extrabold uppercase">Ruta del día</h1>
            <div className="corners border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
                Vista chofer — en migración desde Laravel. Próximo: ruta paso a paso, GPS en vivo y prueba de entrega.
            </div>
        </AppShell>
    );
}
