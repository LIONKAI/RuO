import { connection } from "next/server";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { destinations, profiles, vehicles, workdays } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { isIsoDate, todayIso } from "@/lib/domain";

export const instant = false;

function Stat({ label, value, color = "" }: { label: string; value: string | number; color?: string }) {
    return (
        <div className="corners border border-neutral-200 bg-white p-4">
            <p className="eyebrow mb-1">{label}</p>
            <p className={`font-display text-2xl font-extrabold ${color}`}>{value}</p>
        </div>
    );
}

export default async function ReportesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    await connection();
    const { user, companyId } = await requireAdmin();

    const sp = await searchParams;
    const hoy = todayIso();
    const hasta = isIsoDate(sp.hasta) ? sp.hasta : hoy;
    const desdeDefault = new Date(new Date(hasta + "T12:00:00").getTime() - 29 * 86400000).toISOString().slice(0, 10);
    const desde = isIsoDate(sp.desde) ? sp.desde : desdeDefault;

    // Pedidos de la empresa en el rango, por estado.
    const [totales] = await db.select({
        total: sql<number>`count(*)`,
        completados: sql<number>`count(*) filter (where status = 'completed')`,
        fallidos: sql<number>`count(*) filter (where status = 'failed')`,
        cobrado: sql<string>`coalesce(sum(amount_to_collect) filter (where collection_status = 'collected'), 0)`,
    }).from(destinations)
        .where(and(eq(destinations.companyId, companyId), gte(destinations.serviceDate, desde), lte(destinations.serviceDate, hasta)));

    // Por chofer: entregas, fallos, efectividad, cobrado.
    const porChofer = await db.select({
        driverId: profiles.id,
        nombre: profiles.name,
        total: sql<number>`count(${destinations.id})`,
        completados: sql<number>`count(${destinations.id}) filter (where ${destinations.status} = 'completed')`,
        fallidos: sql<number>`count(${destinations.id}) filter (where ${destinations.status} = 'failed')`,
        cobrado: sql<string>`coalesce(sum(${destinations.amountToCollect}) filter (where ${destinations.collectionStatus} = 'collected'), 0)`,
        km: sql<string>`coalesce(sum(${workdays.totalKm}), 0)`,
    }).from(destinations)
        .innerJoin(workdays, eq(destinations.workdayId, workdays.id))
        .innerJoin(vehicles, eq(workdays.vehicleId, vehicles.id))
        .innerJoin(profiles, eq(vehicles.driverId, profiles.id))
        .where(and(eq(destinations.companyId, companyId), gte(destinations.serviceDate, desde), lte(destinations.serviceDate, hasta)))
        .groupBy(profiles.id, profiles.name)
        .orderBy(sql`count(${destinations.id}) desc`);

    // Por día: volumen y efectividad para ver tendencia.
    const porDia = await db.select({
        fecha: destinations.serviceDate,
        total: sql<number>`count(*)`,
        completados: sql<number>`count(*) filter (where status = 'completed')`,
    }).from(destinations)
        .where(and(eq(destinations.companyId, companyId), gte(destinations.serviceDate, desde), lte(destinations.serviceDate, hasta)))
        .groupBy(destinations.serviceDate)
        .orderBy(destinations.serviceDate);

    const maxDia = Math.max(1, ...porDia.map((d) => Number(d.total)));
    const efectividad = Number(totales.total) > 0 ? Math.round((Number(totales.completados) / Number(totales.total)) * 100) : 0;

    return (
        <AppShell user={user} section="admin">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="eyebrow text-ruo-600">Análisis</p>
                    <h1 className="font-display text-3xl font-extrabold uppercase">Reportes</h1>
                </div>
                <form className="flex flex-wrap items-end gap-2">
                    <div>
                        <label className="label">Desde</label>
                        <input type="date" name="desde" defaultValue={desde} className="input py-1.5" />
                    </div>
                    <div>
                        <label className="label">Hasta</label>
                        <input type="date" name="hasta" defaultValue={hasta} className="input py-1.5" />
                    </div>
                    <button className="btn btn-secondary py-1.5">Ver</button>
                </form>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Pedidos" value={Number(totales.total)} />
                <Stat label="Efectividad" value={`${efectividad}%`} color={efectividad >= 90 ? "text-done" : efectividad >= 75 ? "text-ruo-600" : "text-alert"} />
                <Stat label="Fallidos" value={Number(totales.fallidos)} color={Number(totales.fallidos) > 0 ? "text-alert" : ""} />
                <Stat label="Cobrado" value={`Bs ${Number(totales.cobrado).toFixed(2)}`} color="text-done" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="corners border border-neutral-200 bg-white p-5">
                    <h2 className="mb-4 font-display text-lg font-bold uppercase">Por chofer</h2>
                    {porChofer.length === 0 && <p className="text-sm text-neutral-400">Sin entregas en este rango.</p>}
                    <div className="flex flex-col gap-2">
                        {porChofer.map((c) => {
                            const ef = Number(c.total) > 0 ? Math.round((Number(c.completados) / Number(c.total)) * 100) : 0;
                            return (
                                <div key={c.driverId} className="border border-neutral-100 px-3 py-2">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold">{c.nombre}</p>
                                        <span className={`tag ${ef >= 90 ? "tag-done" : ef >= 75 ? "" : "tag-alert"}`}>{ef}% efectivo</span>
                                    </div>
                                    <p className="text-xs text-neutral-500">
                                        {Number(c.completados)}/{Number(c.total)} entregas · {Number(c.fallidos)} fallos · {Number(c.km).toFixed(1)} km · Bs {Number(c.cobrado).toFixed(2)} cobrados
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="corners border border-neutral-200 bg-white p-5">
                    <h2 className="mb-4 font-display text-lg font-bold uppercase">Volumen por día</h2>
                    {porDia.length === 0 && <p className="text-sm text-neutral-400">Sin pedidos en este rango.</p>}
                    <div className="flex flex-col gap-1.5">
                        {porDia.map((d) => (
                            <div key={d.fecha} className="flex items-center gap-2 text-xs">
                                <span className="w-20 shrink-0 text-neutral-500">{d.fecha.slice(5)}</span>
                                <div className="h-3 bg-ruo-600" style={{ width: `${(Number(d.total) / maxDia) * 70}%` }} />
                                <span className="shrink-0">{Number(d.completados)}/{Number(d.total)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
