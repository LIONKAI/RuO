import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicles, workdays } from "@/db/schema";
import { Logo } from "@/components/Logo";
import { RouteMap } from "@/components/MapLoader";
import { destinationByToken, destinationsOf, etaFor } from "@/lib/queries";
import { DestinationStatus, formatDateTime, formatTime } from "@/lib/domain";
import Link from "next/link";

export const instant = false;

export default async function TrackingPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;
    const dest = await destinationByToken(token);
    if (!dest) notFound();

    const [workday] = dest.workdayId
        ? await db.select().from(workdays).where(eq(workdays.id, dest.workdayId))
        : [];
    const [vehicle] = workday
        ? await db.select().from(vehicles).where(eq(vehicles.id, workday.vehicleId))
        : [];
    const route = workday ? await destinationsOf(workday.id) : [];
    const queue = route.filter((d) => d.status === DestinationStatus.Pending && (d.position ?? 0) < (dest.position ?? 0)).length;
    const eta = etaFor(route, dest);

    const geometry = (dest.legGeometry as [number, number][] | null) ?? null;
    const stops = [
        ...(vehicle?.depotLatitude != null ? [{ latitude: vehicle.depotLatitude, longitude: vehicle.depotLongitude!, status: "depot" as const }] : []),
        { latitude: dest.latitude, longitude: dest.longitude, status: dest.status as "pending" | "completed" | "failed", label: dest.reference },
    ];

    return (
        <div className="flex min-h-screen flex-col bg-ruo-50">
            <header className="flex h-15 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-16">
                <Link href="/"><Logo size={24} /></Link>
                <span className="tag tag-accent">Seguimiento en vivo</span>
            </header>

            <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
                <p className="eyebrow mb-1 text-ruo-600">Tu entrega</p>
                <h1 className="mb-2 font-display text-3xl font-extrabold uppercase">{dest.reference}</h1>
                <p className="mb-6 text-sm text-neutral-600">{dest.address}</p>

                <div className="corners corners-accent mb-4 border border-neutral-200 bg-white p-6">
                    {dest.status === DestinationStatus.Completed && (
                        <>
                            <p className="mb-1 font-display text-2xl font-extrabold text-done uppercase">✓ Entregado</p>
                            <p className="text-sm text-neutral-600">
                                {dest.completedAt ? formatDateTime(dest.completedAt) : ""}
                                {dest.recipientName ? ` · Recibió: ${dest.recipientName}` : ""}
                            </p>
                        </>
                    )}
                    {dest.status === DestinationStatus.Failed && (
                        <>
                            <p className="mb-1 font-display text-2xl font-extrabold text-alert uppercase">Entrega no completada</p>
                            <p className="text-sm text-neutral-600">Te contactaremos para reagendar.</p>
                        </>
                    )}
                    {dest.status === DestinationStatus.Pending && (
                        <>
                            <p className="mb-1 font-display text-2xl font-extrabold uppercase">
                                {queue === 0 ? "Eres la próxima parada" : `${queue} parada${queue > 1 ? "s" : ""} antes que tú`}
                            </p>
                            <p className="text-sm text-neutral-600">
                                {eta ? `Llegada estimada: ${formatTime(eta)}` : "Calculando tiempo de llegada…"}
                                {vehicle ? ` · ${vehicle.name}` : ""}
                            </p>
                        </>
                    )}
                </div>

                <RouteMap
                    stops={stops}
                    geometry={geometry}
                    live={workday?.lastLatitude != null ? { latitude: workday.lastLatitude, longitude: workday.lastLongitude! } : null}
                    height={380}
                />

                <p className="mt-6 text-center text-xs text-neutral-400">Recarga la página para actualizar la posición.</p>
            </main>
        </div>
    );
}
