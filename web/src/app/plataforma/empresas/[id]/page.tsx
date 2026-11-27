import { connection } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, destinations, profiles, vehicles } from "@/db/schema";
import { requireSuperadmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { formatDateTime } from "@/lib/domain";

export const instant = false;

async function updatePlan(formData: FormData) {
    "use server";
    await requireSuperadmin();
    const id = String(formData.get("id") ?? "");
    if (!id) redirect("/plataforma");
    const back = `/plataforma/empresas/${id}`;

    const plan = String(formData.get("plan") ?? "");
    if (!["piloto", "pro", "enterprise"].includes(plan)) redirect(`${back}?error=Plan inválido.`);
    const maxVehicles = Math.max(1, Math.min(200, Number(formData.get("max_vehicles")) || 5));
    const monthlyPrice = Math.max(0, Math.min(100000, Number(formData.get("monthly_price")) || 0));
    const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;

    await db.update(companies).set({ plan: plan as "piloto" | "pro" | "enterprise", maxVehicles, monthlyPrice: String(monthlyPrice), notes, updatedAt: new Date() }).where(eq(companies.id, id));
    revalidatePath(back);
    revalidatePath("/plataforma");
    redirect(`${back}?ok=${encodeURIComponent("Plan actualizado.")}`);
}

export default async function EmpresaDetallePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
    await connection();
    const user = await requireSuperadmin();
    const { id } = await params;
    const sp = await searchParams;

    const [company] = await db.select().from(companies).where(eq(companies.id, id));
    if (!company) notFound();

    const users = await db.select().from(profiles).where(eq(profiles.companyId, id)).orderBy(profiles.role);
    const fleet = await db.select().from(vehicles).where(eq(vehicles.companyId, id));

    const [stats] = await db.select({
        total: sql<number>`count(*)`,
        completados: sql<number>`count(*) filter (where status = 'completed')`,
        fallidos: sql<number>`count(*) filter (where status = 'failed')`,
        mes: sql<number>`count(*) filter (where created_at > now() - interval '30 days')`,
    }).from(destinations).where(eq(destinations.companyId, id));

    const actividad = await db.select({
        fecha: sql<string>`service_date`,
        pedidos: sql<number>`count(*)`,
        completados: sql<number>`count(*) filter (where status = 'completed')`,
    }).from(destinations)
        .where(eq(destinations.companyId, id))
        .groupBy(sql`service_date`)
        .orderBy(sql`service_date desc`)
        .limit(14);

    return (
        <AppShell user={user} section="plataforma">
            <p className="eyebrow mb-1 text-ruo-600">
                <Link href="/plataforma" className="hover:underline">Plataforma</Link> / {company.slug}
            </p>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-3xl font-extrabold uppercase">{company.name}</h1>
                <span className={`tag ${company.active ? "tag-done" : "tag-alert"}`}>{company.active ? "Activa" : "Suspendida"}</span>
            </div>

            {sp.ok && <p className="mb-4 border border-done bg-done-50 px-3 py-2 text-sm text-done">{sp.ok}</p>}
            {sp.error && <p className="mb-4 border border-alert bg-alert-50 px-3 py-2 text-sm text-alert">{sp.error}</p>}

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="corners border border-neutral-200 bg-white p-5">
                    <h2 className="mb-4 font-display text-lg font-bold uppercase">Plan y límites</h2>
                    <form action={updatePlan} className="grid gap-3 sm:grid-cols-2">
                        <input type="hidden" name="id" value={company.id} />
                        <div>
                            <label className="label">Plan</label>
                            <select name="plan" defaultValue={company.plan} className="input">
                                <option value="piloto">Piloto</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Precio mensual (Bs)</label>
                            <input name="monthly_price" type="number" min="0" step="0.01" defaultValue={company.monthlyPrice} className="input" />
                        </div>
                        <div>
                            <label className="label">Máx. vehículos</label>
                            <input name="max_vehicles" type="number" min="1" max="200" defaultValue={company.maxVehicles} className="input" />
                        </div>
                        <div>
                            <label className="label">Notas internas</label>
                            <input name="notes" defaultValue={company.notes ?? ""} className="input" placeholder="Contacto, acuerdos…" />
                        </div>
                        <button className="btn btn-primary sm:col-span-2">Guardar plan</button>
                    </form>
                    <p className="mt-3 text-xs text-neutral-400">Alta: {formatDateTime(company.createdAt)}</p>
                </div>

                <div className="corners border border-neutral-200 bg-white p-5">
                    <h2 className="mb-4 font-display text-lg font-bold uppercase">Uso</h2>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><p className="eyebrow text-neutral-400">Pedidos total</p><p className="font-display text-xl font-bold">{stats.total}</p></div>
                        <div><p className="eyebrow text-neutral-400">Últimos 30 días</p><p className="font-display text-xl font-bold">{stats.mes}</p></div>
                        <div><p className="eyebrow text-neutral-400">Completados</p><p className="font-display text-xl font-bold text-done">{stats.completados}</p></div>
                        <div><p className="eyebrow text-neutral-400">Fallidos</p><p className="font-display text-xl font-bold text-alert">{stats.fallidos}</p></div>
                    </div>
                    <h3 className="mb-2 mt-5 font-display text-sm font-bold uppercase">Actividad por día</h3>
                    {actividad.length === 0 && <p className="text-xs text-neutral-400">Sin pedidos aún.</p>}
                    <div className="flex flex-col gap-1">
                        {actividad.map((a) => (
                            <div key={a.fecha} className="flex justify-between text-xs">
                                <span className="text-neutral-500">{a.fecha}</span>
                                <span>{a.completados}/{a.pedidos} entregados</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="corners border border-neutral-200 bg-white p-5">
                    <h2 className="mb-4 font-display text-lg font-bold uppercase">Usuarios ({users.length})</h2>
                    <div className="flex flex-col gap-2">
                        {users.map((u) => (
                            <div key={u.id} className="flex items-center justify-between border border-neutral-100 px-3 py-2 text-sm">
                                <span>{u.name}</span>
                                <span className="tag">{u.role}</span>
                            </div>
                        ))}
                        {users.length === 0 && <p className="text-xs text-neutral-400">Sin usuarios.</p>}
                    </div>
                </div>

                <div className="corners border border-neutral-200 bg-white p-5">
                    <h2 className="mb-4 font-display text-lg font-bold uppercase">Vehículos ({fleet.length}/{company.maxVehicles})</h2>
                    <div className="flex flex-col gap-2">
                        {fleet.map((v) => (
                            <div key={v.id} className="flex items-center justify-between border border-neutral-100 px-3 py-2 text-sm">
                                <span>{v.name}</span>
                                <span className="text-xs text-neutral-400">{v.plate}</span>
                            </div>
                        ))}
                        {fleet.length === 0 && <p className="text-xs text-neutral-400">Sin vehículos.</p>}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
