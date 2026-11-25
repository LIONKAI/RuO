import { connection } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { formatDateTime, todayIso } from "@/lib/domain";

export const instant = false;

const back = "/plataforma";

async function toggleCompany(formData: FormData) {
    "use server";
    await requireSuperadmin();
    const id = String(formData.get("id") ?? "");
    const active = formData.get("active") === "1";
    if (!id) redirect(back);

    await db.update(companies).set({ active, updatedAt: new Date() }).where(eq(companies.id, id));
    revalidatePath(back);
    redirect(`${back}?ok=${encodeURIComponent(active ? "Empresa reactivada." : "Empresa suspendida.")}`);
}

export default async function PlataformaPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    await connection();
    const user = await requireSuperadmin();
    const sp = await searchParams;
    const today = todayIso();

    const rows = await db.select({
        c: companies,
        admins: sql<number>`(select count(*) from profiles p where p.company_id = companies.id and p.role = 'admin')`,
        drivers: sql<number>`(select count(*) from profiles p where p.company_id = companies.id and p.role = 'driver')`,
        vehiclesCount: sql<number>`(select count(*) from vehicles v where v.company_id = companies.id)`,
        pedidosHoy: sql<number>`(select count(*) from destinations d where d.company_id = companies.id and d.service_date = ${today})`,
    }).from(companies).orderBy(companies.createdAt);

    return (
        <AppShell user={user} section="plataforma">
            <p className="eyebrow mb-1 text-ruo-600">Plataforma</p>
            <h1 className="mb-6 font-display text-3xl font-extrabold uppercase">Empresas registradas</h1>

            {sp.ok && <p className="mb-4 border border-done bg-done-50 px-3 py-2 text-sm text-done">{sp.ok}</p>}

            <div className="flex flex-col gap-3">
                {rows.map(({ c, admins, drivers, vehiclesCount, pedidosHoy }) => (
                    <div key={c.id} className="corners flex flex-wrap items-center justify-between gap-3 border border-neutral-200 bg-white p-5">
                        <div>
                            <p className="font-display text-lg font-bold uppercase">
                                {c.name} <span className="text-xs font-normal text-neutral-400">{c.slug}</span>
                            </p>
                            <p className="text-xs text-neutral-500">
                                {admins} admin · {drivers} choferes · {vehiclesCount} vehículos · {pedidosHoy} pedidos hoy
                                {` · alta ${formatDateTime(c.createdAt)}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`tag ${c.active ? "tag-done" : "tag-alert"}`}>{c.active ? "Activa" : "Suspendida"}</span>
                            <form action={toggleCompany}>
                                <input type="hidden" name="id" value={c.id} />
                                <input type="hidden" name="active" value={c.active ? "0" : "1"} />
                                <button className={`btn btn-ghost px-3 py-2 text-xs ${c.active ? "text-alert" : "text-done"}`}>
                                    {c.active ? "Suspender" : "Reactivar"}
                                </button>
                            </form>
                        </div>
                    </div>
                ))}
                {rows.length === 0 && (
                    <div className="corners border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
                        Aún no hay empresas. La primera se registrará sola desde /registro.
                    </div>
                )}
            </div>
        </AppShell>
    );
}
