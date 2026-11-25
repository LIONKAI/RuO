import { redirect } from "next/navigation";
import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { vehicles, profiles } from "@/db/schema";
import { currentUser } from "@/lib/supabase";
import { AppShell } from "@/components/AppShell";
import { createVehicle, deleteVehicle } from "../actions";
import { UserRole } from "@/lib/domain";

export const instant = false;

export default async function VehiculosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    // Render por request: la página usa la fecha/hora actual (hoy en Bolivia, ETA).
    await connection();
    const user = await currentUser();
    if (!user) redirect("/login");
    if (user.role !== UserRole.Admin) redirect("/chofer");
    const sp = await searchParams;

    const fleet = await db.select({ v: vehicles, driver: profiles })
        .from(vehicles)
        .leftJoin(profiles, eq(vehicles.driverId, profiles.id))
        .orderBy(vehicles.id);

    return (
        <AppShell user={user} section="admin">
            <p className="eyebrow mb-1 text-ruo-600">Gestión</p>
            <h1 className="mb-6 font-display text-3xl font-extrabold uppercase">Vehículos</h1>
            {sp.error && <p className="mb-4 border border-alert bg-alert-50 px-3 py-2 text-sm text-alert">{sp.error}</p>}

            <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
                <div className="corners corners-accent border border-neutral-200 bg-white p-5">
                    <h2 className="mb-4 font-display text-lg font-bold uppercase">Nuevo vehículo</h2>
                    <form action={createVehicle} className="flex flex-col gap-3">
                        <div>
                            <label className="label">Nombre</label>
                            <input name="name" required className="input" placeholder="Camioneta 1" />
                        </div>
                        <div>
                            <label className="label">Placa</label>
                            <input name="plate" required className="input" placeholder="4520-KLX" />
                        </div>
                        <div>
                            <label className="label">Consumo (L/km)</label>
                            <input name="fuel_liters_per_km" type="number" step="0.001" defaultValue="0.10" className="input" />
                        </div>
                        <div>
                            <label className="label">Correo del chofer <span className="text-neutral-400 normal-case">(opcional)</span></label>
                            <input name="driver_email" type="email" className="input" placeholder="chofer1@ruo.com" />
                        </div>
                        <div>
                            <label className="label">Base / depósito <span className="text-neutral-400 normal-case">(dirección, opcional)</span></label>
                            <input name="depot_address" className="input" placeholder="Av. Santos Dumont km 4, Santa Cruz" />
                        </div>
                        <button className="btn btn-primary">+ Registrar vehículo</button>
                    </form>
                </div>

                <div className="flex flex-col gap-3">
                    {fleet.map(({ v, driver }) => (
                        <div key={v.id} className="corners flex items-center justify-between border border-neutral-200 bg-white p-5">
                            <div>
                                <p className="font-display text-lg font-bold uppercase">{v.name} <span className="text-sm font-normal text-neutral-500">{v.plate}</span></p>
                                <p className="text-xs text-neutral-500">
                                    {driver ? `Chofer: ${driver.name}` : "Sin chofer asignado"}
                                    {` · ${v.fuelLitersPerKm} L/km`}
                                    {v.depotAddress ? ` · ⌂ ${v.depotAddress}` : " · sin base"}
                                </p>
                            </div>
                            <form action={deleteVehicle}>
                                <input type="hidden" name="id" value={v.id} />
                                <button className="btn btn-ghost px-3 py-2 text-xs text-alert">Eliminar</button>
                            </form>
                        </div>
                    ))}
                    {fleet.length === 0 && <div className="corners border border-neutral-200 bg-white p-6 text-sm text-neutral-500">Sin vehículos registrados.</div>}
                </div>
            </div>
        </AppShell>
    );
}
