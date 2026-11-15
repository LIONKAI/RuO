import { redirect } from "next/navigation";
import Link from "next/link";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { destinations, vehicles, workdays } from "@/db/schema";
import { currentUser } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { RouteMap, type MapStop } from "@/components/MapLoader";
import { optimizeRoute } from "./actions";
import { DestinationStatus, UserRole, WorkdayStatus, todayIso, workdayStatusLabel } from "@/lib/domain";

export const instant = false;

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    const user = await currentUser();
    if (!user) redirect("/login");
    if (user.role !== UserRole.Admin) redirect("/chofer");

    const sp = await searchParams;
    const date = sp.fecha ?? todayIso();

    const fleet = await db.select().from(vehicles).orderBy(vehicles.id);
    const days = await db.select().from(workdays).where(eq(workdays.date, date));
    const allDests = days.length
        ? await db.select().from(destinations).where(sql`${destinations.workdayId} in (${sql.join(days.map((d) => sql`${d.id}`), sql`, `)})`).orderBy(destinations.position)
        : [];

    const liveStops: MapStop[] = days
        .filter((d) => d.lastLatitude != null)
        .map((d) => ({ latitude: d.lastLatitude!, longitude: d.lastLongitude!, status: "pending" as const, label: `Vehículo ${d.vehicleId}` }));
    const geometries = allDests.flatMap((d) => (d.legGeometry as [number, number][] | null) ?? []);

    return (
        <AppShell user={user} section="admin">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="eyebrow text-ruo-600">Flota · {date}</p>
                    <h1 className="font-display text-3xl font-extrabold uppercase">Panel del día</h1>
                </div>
                <form className="flex items-end gap-2">
                    <div>
                        <label className="label">Fecha</label>
                        <input type="date" name="fecha" defaultValue={date} className="input py-1.5" />
                    </div>
                    <button className="btn btn-secondary py-1.5">Ver</button>
                    <Link href="/admin/pedidos" className="btn btn-primary py-1.5">Pool de pedidos →</Link>
                </form>
            </div>

            {sp.ok && <p className="mb-4 border border-done bg-done-50 px-3 py-2 text-sm text-done">{sp.ok}</p>}
            {sp.error && <p className="mb-4 border border-alert bg-alert-50 px-3 py-2 text-sm text-alert">{sp.error}</p>}

            <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
                <div className="flex flex-col gap-4">
                    {fleet.map((vehicle) => {
                        const day = days.find((d) => d.vehicleId === vehicle.id);
                        const dests = allDests.filter((d) => d.workdayId === day?.id);
                        const done = dests.filter((d) => d.status === DestinationStatus.Completed).length;
                        const failed = dests.filter((d) => d.status === DestinationStatus.Failed).length;
                        return (
                            <div key={vehicle.id} className="corners border border-neutral-200 bg-white p-5">
                                <div className="mb-3 flex items-center justify-between">
                                    <div>
                                        <h2 className="font-display text-lg font-bold uppercase">{vehicle.name}</h2>
                                        <p className="text-xs text-neutral-500">{vehicle.plate}{vehicle.depotAddress ? ` · ⌂ ${vehicle.depotAddress}` : ""}</p>
                                    </div>
                                    <span className={`tag ${day?.status === WorkdayStatus.InProgress ? "tag-accent" : day?.status === WorkdayStatus.Completed ? "tag-done" : "tag-outline"}`}>
                                        {day ? workdayStatusLabel[day.status as WorkdayStatus] : "Sin jornada"}
                                    </span>
                                </div>
                                {dests.length > 0 && (
                                    <div className="mb-3">
                                        <div className="mb-1 flex justify-between text-xs"><span>{done}/{dests.length} entregados{failed ? ` · ${failed} fallidos` : ""}</span><span>{Math.round((done / dests.length) * 100)}%</span></div>
                                        <div className="h-[4px] bg-neutral-100"><div className="h-full bg-ruo-600" style={{ width: `${(done / dests.length) * 100}%` }} /></div>
                                    </div>
                                )}
                                {day?.lastLatitude != null && (
                                    <p className="text-xs text-neutral-500">📍 Última posición: {day.lastPositionAt ? new Date(day.lastPositionAt).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                                )}
                                {day && dests.some((d) => d.status === DestinationStatus.Pending) && (
                                    <form action={optimizeRoute} className="mt-3">
                                        <input type="hidden" name="workday_id" value={day.id} />
                                        <input type="hidden" name="date" value={date} />
                                        <button className="btn btn-secondary py-1 text-xs">Reoptimizar ruta</button>
                                    </form>
                                )}
                            </div>
                        );
                    })}
                    {fleet.length === 0 && (
                        <div className="corners border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
                            Sin vehículos aún. <Link href="/admin/vehiculos" className="text-ruo-600 underline">Crea el primero →</Link>
                        </div>
                    )}
                </div>
                <RouteMap
                    stops={liveStops}
                    geometry={geometries.length ? geometries : null}
                    height={520}
                />
            </div>
        </AppShell>
    );
}
