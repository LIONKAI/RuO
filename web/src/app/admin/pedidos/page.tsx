import { connection } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { createDestination, deleteDestination, distribute, requeueDestination } from "../actions";
import { poolFor, failedFor, trackingUrl } from "@/lib/queries";
import { trackingLink } from "@/lib/services/whatsapp";
import { todayIso, isIsoDate } from "@/lib/domain";
import { RouteMap } from "@/components/MapLoader";

export const instant = false;

export default async function PedidosPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    // Render por request: la página usa la fecha/hora actual (hoy en Bolivia, ETA).
    await connection();
    const { user, companyId } = await requireAdmin();

    const sp = await searchParams;
    const date = isIsoDate(sp.fecha) ? sp.fecha : todayIso();
    const pool = await poolFor(date, companyId);
    const failed = await failedFor(date, companyId);
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000";

    return (
        <AppShell user={user} section="admin">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="eyebrow text-ruo-600">Pool · {date}</p>
                    <h1 className="font-display text-3xl font-extrabold uppercase">Pedidos sin asignar</h1>
                </div>
                <div className="flex items-end gap-2">
                    <form className="flex items-end gap-2">
                        <div>
                            <label className="label">Fecha de servicio</label>
                            <input type="date" name="fecha" defaultValue={date} className="input py-1.5" />
                        </div>
                        <button className="btn btn-secondary py-1.5">Ver</button>
                    </form>
                    <form action={distribute}>
                        <input type="hidden" name="date" value={date} />
                        <button className="btn btn-primary py-1.5" disabled={pool.length === 0}>⇄ Repartir en flota ({pool.length})</button>
                    </form>
                </div>
            </div>

            {sp.ok && <p className="mb-4 border border-done bg-done-50 px-3 py-2 text-sm text-done">{sp.ok}</p>}
            {sp.error && <p className="mb-4 border border-alert bg-alert-50 px-3 py-2 text-sm text-alert">{sp.error}</p>}

            <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
                <div className="flex flex-col gap-4">
                    <div className="corners corners-accent border border-neutral-200 bg-white p-5">
                        <h2 className="mb-4 font-display text-lg font-bold uppercase">Cargar pedido</h2>
                        <form action={createDestination} className="grid gap-3 sm:grid-cols-2">
                            <input type="hidden" name="date" value={date} />
                            <div className="sm:col-span-2">
                                <label className="label">Dirección</label>
                                <input name="address" required className="input" placeholder="Av. Busch 890, Santa Cruz" />
                            </div>
                            <div>
                                <label className="label">Referencia / cliente</label>
                                <input name="reference" required className="input" placeholder="Pedido #1042 · Farmacia" />
                            </div>
                            <div>
                                <label className="label">Teléfono (WhatsApp)</label>
                                <input name="phone" className="input" placeholder="70012345" />
                            </div>
                            <div>
                                <label className="label">Latitud <span className="text-neutral-400 normal-case">(opcional)</span></label>
                                <input name="latitude" type="number" step="any" className="input" placeholder="-17.78" />
                            </div>
                            <div>
                                <label className="label">Longitud <span className="text-neutral-400 normal-case">(opcional)</span></label>
                                <input name="longitude" type="number" step="any" className="input" placeholder="-63.18" />
                            </div>
                            <button className="btn btn-primary sm:col-span-2">+ Agregar al pool</button>
                        </form>
                    </div>

                    <div className="corners border border-neutral-200 bg-white p-5">
                        <h2 className="mb-4 font-display text-lg font-bold uppercase">En espera ({pool.length})</h2>
                        {pool.length === 0 && <p className="text-sm text-neutral-500">Pool vacío para esta fecha.</p>}
                        <div className="flex flex-col gap-2">
                            {pool.map((d) => {
                                const wa = trackingLink(d, trackingUrl(d.publicToken, base));
                                return (
                                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border border-neutral-100 px-3 py-2">
                                        <div>
                                            <p className="text-sm font-semibold">{d.reference}</p>
                                            <p className="text-xs text-neutral-500">{d.address}{d.phone ? ` · ${d.phone}` : ""}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {wa && <a href={wa} target="_blank" className="btn btn-ghost px-3 py-2 text-xs text-done">WhatsApp ↗</a>}
                                            <form action={deleteDestination}>
                                                <input type="hidden" name="id" value={d.id} />
                                                <input type="hidden" name="date" value={date} />
                                                <button className="btn btn-ghost px-3 py-2 text-xs text-alert">Quitar</button>
                                            </form>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {failed.length > 0 && (
                        <div className="corners border border-alert/40 bg-alert-50/40 p-5">
                            <h2 className="mb-4 font-display text-lg font-bold uppercase text-alert">Fallidos ({failed.length})</h2>
                            <div className="flex flex-col gap-2">
                                {failed.map((d) => (
                                    <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 border border-alert/20 bg-white px-3 py-2">
                                        <div>
                                            <p className="text-sm font-semibold">{d.reference}</p>
                                            <p className="text-xs text-neutral-500">{d.address} · motivo: {d.failureReason}</p>
                                        </div>
                                        <form action={requeueDestination} className="flex items-end gap-1">
                                            <input type="hidden" name="id" value={d.id} />
                                            <input type="hidden" name="date" value={date} />
                                            <input type="date" name="service_date" defaultValue={date} className="input px-2 py-1.5 text-xs" />
                                            <button className="btn btn-secondary px-3 py-1.5 text-xs">Reagendar</button>
                                        </form>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <RouteMap
                    stops={pool.map((d) => ({ latitude: d.latitude, longitude: d.longitude, label: d.reference }))}
                    height={560}
                    mobileHeight={300}
                />
            </div>
        </AppShell>
    );
}
