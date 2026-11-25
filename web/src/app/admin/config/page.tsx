import { connection } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { regenerateApiKey } from "@/lib/companies";
import { AppShell } from "@/components/AppShell";

export const instant = false;

const back = "/admin/config";

async function regenerateKey() {
    "use server";
    const { companyId } = await requireAdmin();
    await regenerateApiKey(companyId);
    revalidatePath(back);
    redirect(`${back}?ok=${encodeURIComponent("Clave regenerada. Actualiza el bot de WhatsApp con la nueva.")}`);
}

export default async function ConfigPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    await connection();
    const { user, companyId } = await requireAdmin();
    const sp = await searchParams;

    const [company] = await db.select().from(companies).where(eq(companies.id, companyId));

    return (
        <AppShell user={user} section="admin">
            <p className="eyebrow mb-1 text-ruo-600">Empresa</p>
            <h1 className="mb-6 font-display text-3xl font-extrabold uppercase">Configuración</h1>

            {sp.ok && <p className="mb-4 border border-done bg-done-50 px-3 py-2 text-sm text-done">{sp.ok}</p>}

            <div className="flex max-w-2xl flex-col gap-4">
                <div className="corners border border-neutral-200 bg-white p-5">
                    <h2 className="mb-3 font-display text-lg font-bold uppercase">{company?.name ?? "Empresa"}</h2>
                    <p className="text-xs text-neutral-500">Los datos operativos (pedidos, vehículos, choferes) son privados de tu empresa.</p>
                </div>

                <div className="corners corners-accent border border-neutral-200 bg-white p-5">
                    <h2 className="mb-1 font-display text-lg font-bold uppercase">API key del bot</h2>
                    <p className="mb-3 text-xs text-neutral-500">
                        Úsala en n8n / WhatsApp como <code className="bg-neutral-100 px-1">Authorization: Bearer &lt;clave&gt;</code> en
                        <code className="bg-neutral-100 px-1">POST /api/pedidos</code>. Identifica a tu empresa: los pedidos del bot caen en tu pool.
                    </p>
                    <code className="mb-3 block overflow-x-auto border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs break-all">{company?.apiKey}</code>
                    <form action={regenerateKey}>
                        <button className="btn btn-ghost px-3 py-2 text-xs text-alert">Regenerar clave (invalida la actual)</button>
                    </form>
                </div>
            </div>
        </AppShell>
    );
}
