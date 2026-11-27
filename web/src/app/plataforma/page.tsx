import { connection } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { companies, destinations } from "@/db/schema";
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

function Kpi({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
    return (
        <div className="corners border border-neutral-200 bg-white p-4">
            <p className="eyebrow text-neutral-400">{label}</p>
            <p className="font-display text-2xl font-extrabold">{value}</p>
            {detail && <p className="text-xs text-neutral-500">{detail}</p>}
        </div>
    );
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
        pedidos30d: sql<number>`(select count(*) from destinations d where d.company_id = companies.id and d.created_at > now() - interval '30 days')`,
        ultimaActividad: sql<string | null>`(select max(d.updated_at)::text from destinations d where d.company_id = companies.id)`,
    }).from(companies).orderBy(companies.createdAt);

    const [kpis] = await db.select({
        activas: sql<number>`count(*) filter (where active)`,
        total: sql<number>`count(*)`,
        mrr: sql<number>`coalesce(sum(monthly_price) filter (where active), 0)`,
    }).from(companies);

    const [uso] = await db.select({
        hoy: sql<number>`count(*) filter (where service_date = current_date)`,
        mes: sql<number>`count(*) filter (where created_at > now() - interval '30 days')`,
        completadosMes: sql<number>`count(*) filter (where status = 'completed' and created_at > now() - interval '30 days')`,
    }).from(destinations);

    return (
        <AppShell user={user} section="plataforma">
            <p className="eyebrow mb-1 text-ruo-600">Plataforma</p>
            <h1 className="mb-6 font-display text-3xl font-extrabold uppercase">Panel de control</h1>

            {sp.ok && <p className="mb-4 border border-done bg-done-50 px-3 py-2 text-sm text-done">{sp.ok}</p>}

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="Empresas activas" value={`${kpis.activas}/${kpis.total}`} />
                <Kpi label="MRR estimado" value={`Bs ${Number(kpis.mrr).toLocaleString("es-BO")}`} detail="suma de planes activos" />
                <Kpi label="Pedidos del mes" value={Number(uso.mes)} detail={`${Number(uso.hoy)} hoy`} />
                <Kpi label="Entregas del mes" value={Number(uso.completadosMes)} detail={Number(uso.mes) > 0 ? `${Math.round((Number(uso.completadosMes) / Number(uso.mes)) * 100)}% de efectividad` : undefined} />
            </div>

            <h2 className="mb-3 font-display text-lg font-bold uppercase">Empresas</h2>
            <div className="flex flex-col gap-3">
                {rows.map(({ c, admins, drivers, vehiclesCount, pedidosHoy, pedidos30d, ultimaActividad }) => (
                    <div key={c.id} className="corners flex flex-wrap items-center justify-between gap-3 border border-neutral-200 bg-white p-5">
                        <div>
                            <p className="font-display text-lg font-bold uppercase">
                                {c.name} <span className="text-xs font-normal text-neutral-400">{c.slug}</span>{" "}
                                <span className="tag ml-1">{c.plan}</span>
                            </p>
                            <p className="text-xs text-neutral-500">
                                {admins} admin · {drivers} choferes · {vehiclesCount}/{c.maxVehicles} vehículos · {pedidosHoy} pedidos hoy · {pedidos30d} en 30d
                            </p>
                            <p className="text-xs text-neutral-400">
                                alta {formatDateTime(c.createdAt)}
                                {ultimaActividad ? ` · última actividad ${formatDateTime(new Date(ultimaActividad))}` : " · sin actividad aún"}
                                {` · Bs ${c.monthlyPrice}/mes`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`tag ${c.active ? "tag-done" : "tag-alert"}`}>{c.active ? "Activa" : "Suspendida"}</span>
                            <Link href={`/plataforma/empresas/${c.id}`} className="btn btn-secondary px-3 py-2 text-xs">Gestionar</Link>
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
