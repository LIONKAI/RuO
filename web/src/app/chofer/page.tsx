import { redirect } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { currentUser } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { PodForm } from "@/components/PodForm";
import { GpsReporter } from "@/components/GpsReporter";
import { RouteMap } from "@/components/MapLoader";
import { destinationsOf, workdayFor, etaFor } from "@/lib/queries";
import { DestinationStatus, UserRole, WorkdayStatus, formatTime, todayIso, workdayStatusLabel, type OsrmLegStep } from "@/lib/domain";
import { activeStop } from "@/lib/guards";

export const instant = false;

const tagOf = (s: string) =>
    s === DestinationStatus.Completed ? "tag-done" : s === DestinationStatus.Failed ? "tag-alert" : "tag-accent";

export default async function DriverPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    // Render por request: la página usa la fecha/hora actual (hoy en Bolivia, ETA).
    await connection();
    const user = await currentUser();
    if (!user) redirect("/login");
    if (user.role !== UserRole.Driver) redirect("/admin");
    const sp = await searchParams;
    const date = todayIso();

    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, user.id));
    const workday = vehicle ? await workdayFor(vehicle.id, date) : null;
    const dests = workday ? await destinationsOf(workday.id) : [];
    const active = activeStop(dests);

    const geometry = dests.flatMap((d) => (d.legGeometry as [number, number][] | null) ?? []);
    const stops = [
        ...(vehicle?.depotLatitude != null ? [{ latitude: vehicle.depotLatitude, longitude: vehicle.depotLongitude!, status: "depot" as const, label: "Base" }] : []),
        ...dests.map((d) => ({ latitude: d.latitude, longitude: d.longitude, status: d.status as "pending" | "completed" | "failed", label: d.reference })),
    ];

    return (
        <AppShell user={user} section="chofer">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="eyebrow text-ruo-600">{vehicle?.name ?? "Sin vehículo"} · {date}</p>
                    <h1 className="font-display text-3xl font-extrabold uppercase">Mi ruta</h1>
                </div>
                <div className="flex items-center gap-2">
                    {workday && <span className={`tag ${workday.status === WorkdayStatus.Completed ? "tag-done" : workday.status === WorkdayStatus.InProgress ? "tag-accent" : "tag-outline"}`}>{workdayStatusLabel[workday.status as WorkdayStatus]}</span>}
                    {workday && workday.status === WorkdayStatus.InProgress && <GpsReporter workdayId={workday.id} />}
                </div>
            </div>

            {sp.ok && <p className="mb-4 border border-done bg-done-50 px-3 py-2 text-sm text-done">{sp.ok}</p>}
            {sp.error && <p className="mb-4 border border-alert bg-alert-50 px-3 py-2 text-sm text-alert">{sp.error}</p>}

            {!vehicle && <div className="corners border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Tu cuenta no tiene vehículo asignado. Pide al administrador que te asigne uno.</div>}

            {vehicle && workday && (
                <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
                    <div className="flex flex-col gap-3">
                        {dests.length === 0 && <div className="corners border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Sin paradas asignadas hoy.</div>}
                        {dests.map((d) => {
                            const eta = etaFor(dests, d);
                            const steps = (d.legSteps as OsrmLegStep[] | null) ?? [];
                            return (
                                <div key={d.id} className={`corners border bg-white p-5 ${d.status === DestinationStatus.Pending ? "border-ruo-200" : "border-neutral-200 opacity-75"}`}>
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-3">
                                            <span className="flex size-8 items-center justify-center bg-ruo-600 font-display text-base font-bold text-white">{d.position ?? "•"}</span>
                                            <div>
                                                <p className="text-sm font-semibold">{d.reference}</p>
                                                <p className="text-xs text-neutral-500">{d.address}{d.phone ? ` · 📞 ${d.phone}` : ""}</p>
                                            </div>
                                        </div>
                                        <span className={`tag ${tagOf(d.status)}`}>{d.status === DestinationStatus.Completed ? "Entregado" : d.status === DestinationStatus.Failed ? "Fallido" : eta ? `ETA ${formatTime(eta)}` : "Pendiente"}</span>
                                    </div>
                                    {d.legDistanceMeters != null && d.status === DestinationStatus.Pending && (
                                        <p className="mb-2 text-xs text-neutral-500">
                                            Tramo: {(d.legDistanceMeters / 1000).toFixed(1)} km · ~{Math.round((d.legDurationSeconds ?? 0) / 60)} min
                                        </p>
                                    )}
                                    {steps.length > 0 && d.status === DestinationStatus.Pending && (
                                        <details className="mb-2 text-xs text-neutral-600">
                                            <summary className="cursor-pointer text-ruo-600">Indicaciones ({steps.length})</summary>
                                            <ol className="mt-1 flex flex-col gap-1 pl-4">
                                                {steps.map((s, i) => <li key={i}>· {s.text} <span className="text-neutral-400">({s.distanceMeters} m)</span></li>)}
                                            </ol>
                                        </details>
                                    )}
                                    {d.id === active?.id && workday.status === WorkdayStatus.InProgress && (
                                        <PodForm destinationId={d.id} workdayId={workday.id} />
                                    )}
                                    {d.status === DestinationStatus.Failed && d.failureReason && (
                                        <p className="text-xs text-alert">Motivo: {d.failureReason}</p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    <RouteMap stops={stops} geometry={geometry.length ? geometry : null} height={560} mobileHeight={280} />
                </div>
            )}
        </AppShell>
    );
}
