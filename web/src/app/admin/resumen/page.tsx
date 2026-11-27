import { connection } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { destinations, vehicles, workdays } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { DestinationStatus, todayIso, isIsoDate } from "@/lib/domain";

export const instant = false;

export default async function ResumenPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    // Render por request: la página usa la fecha/hora actual (hoy en Bolivia, ETA).
    await connection();
    const { user, companyId } = await requireAdmin();

    const sp = await searchParams;
    const date = isIsoDate(sp.fecha) ? sp.fecha : todayIso();
    const fleet = await db.select().from(vehicles).where(eq(vehicles.companyId, companyId)).orderBy(vehicles.id);
    const days = await db.select().from(workdays).where(and(eq(workdays.date, date), eq(workdays.companyId, companyId)));

    const rows = await Promise.all(days.map(async (day) => {
        const dests = await db.select().from(destinations).where(eq(destinations.workdayId, day.id));
        const vehicle = fleet.find((v) => v.id === day.vehicleId);
        return { day, vehicle, dests };
    }));

    const cobradoDe = (d: (typeof rows)[number]["dests"][number]) =>
        d.collectionStatus === "collected" ? Number(d.amountToCollect ?? 0) : 0;
    const pendienteCobroDe = (d: (typeof rows)[number]["dests"][number]) =>
        d.collectionStatus !== "collected" && Number(d.amountToCollect ?? 0) > 0 && d.status !== DestinationStatus.Failed ? Number(d.amountToCollect) : 0;

    const totals = rows.reduce((acc, r) => ({
        km: acc.km + Number(r.day.totalKm ?? 0),
        fuel: acc.fuel + Number(r.day.estimatedFuelLiters ?? 0),
        done: acc.done + r.dests.filter((d) => d.status === DestinationStatus.Completed).length,
        failed: acc.failed + r.dests.filter((d) => d.status === DestinationStatus.Failed).length,
        pending: acc.pending + r.dests.filter((d) => d.status === DestinationStatus.Pending).length,
        cobrado: acc.cobrado + r.dests.reduce((sum, d) => sum + cobradoDe(d), 0),
        porCobrar: acc.porCobrar + r.dests.reduce((sum, d) => sum + pendienteCobroDe(d), 0),
    }), { km: 0, fuel: 0, done: 0, failed: 0, pending: 0, cobrado: 0, porCobrar: 0 });

    return (
        <AppShell user={user} section="admin">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="eyebrow text-ruo-600">Cierre · {date}</p>
                    <h1 className="font-display text-3xl font-extrabold uppercase">Resumen del día</h1>
                </div>
                <form className="flex items-end gap-2">
                    <div>
                        <label className="label">Fecha</label>
                        <input type="date" name="fecha" defaultValue={date} className="input py-1.5" />
                    </div>
                    <button className="btn btn-secondary py-1.5">Ver</button>
                </form>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                {[
                    ["Entregados", totals.done, "text-done"],
                    ["Fallidos", totals.failed, "text-alert"],
                    ["Pendientes", totals.pending, "text-neutral-500"],
                    ["Kilómetros", `${totals.km.toFixed(1)} km`, "text-ruo-600"],
                    ["Combustible", `${totals.fuel.toFixed(1)} L`, "text-ruo-600"],
                    ["Cobrado", `Bs ${totals.cobrado.toFixed(2)}`, "text-done"],
                    ["Por cobrar", `Bs ${totals.porCobrar.toFixed(2)}`, "text-alert"],
                ].map(([label, value, color]) => (
                    <div key={label as string} className="corners border border-neutral-200 bg-white p-4">
                        <p className="eyebrow mb-1">{label}</p>
                        <p className={`font-display text-2xl font-extrabold ${color}`}>{value}</p>
                    </div>
                ))}
            </div>

            <div className="flex flex-col gap-3">
                {rows.map(({ day, vehicle, dests }) => (
                    <div key={day.id} className="corners border border-neutral-200 bg-white p-5">
                        <div className="mb-2 flex justify-between">
                            <p className="font-display text-lg font-bold uppercase">{vehicle?.name ?? `Vehículo ${day.vehicleId}`}</p>
                            <p className="text-sm text-neutral-500">
                                {day.totalKm ? `${day.totalKm} km · ${day.estimatedFuelLiters} L` : "en curso"}
                                {(() => {
                                    const caja = dests.reduce((sum, d) => sum + (d.collectionStatus === "collected" ? Number(d.amountToCollect ?? 0) : 0), 0);
                                    return caja > 0 ? ` · caja Bs ${caja.toFixed(2)}` : "";
                                })()}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {dests.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((d) => (
                                <span key={d.id} className={`tag ${d.status === DestinationStatus.Completed ? "tag-done" : d.status === DestinationStatus.Failed ? "tag-alert" : "tag-outline"}`}>
                                    {d.position} · {d.reference}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
                {rows.length === 0 && <div className="corners border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Sin jornadas en esta fecha.</div>}
            </div>
        </AppShell>
    );
}
