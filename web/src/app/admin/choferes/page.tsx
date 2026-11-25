import { connection } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles, vehicles } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { CompanyError, createDriver } from "@/lib/companies";
import { AppShell } from "@/components/AppShell";
import { UserRole } from "@/lib/domain";

export const instant = false;

const back = "/admin/choferes";
const withMsg = (key: "ok" | "error", msg: string) => `${back}?${key}=${encodeURIComponent(msg)}`;

async function createDriverAction(formData: FormData) {
    "use server";
    const { companyId } = await requireAdmin();

    const input = {
        companyId,
        name: String(formData.get("name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
    };

    let target: string;
    try {
        await createDriver(input);
        revalidatePath(back);
        target = withMsg("ok", `Chofer «${input.name.trim()}» creado. Pásale su correo y contraseña.`);
    } catch (error) {
        console.error("[createDriver]", error);
        target = withMsg("error", error instanceof CompanyError ? error.message : "No se pudo crear el chofer.");
    }

    redirect(target);
}

export default async function ChoferesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    await connection();
    const { user, companyId } = await requireAdmin();
    const sp = await searchParams;

    const drivers = await db.select({
        p: profiles,
        vehicle: vehicles,
    })
        .from(profiles)
        .leftJoin(vehicles, eq(vehicles.driverId, profiles.id))
        .where(and(eq(profiles.companyId, companyId), eq(profiles.role, UserRole.Driver)))
        .orderBy(profiles.name);

    return (
        <AppShell user={user} section="admin">
            <p className="eyebrow mb-1 text-ruo-600">Equipo</p>
            <h1 className="mb-6 font-display text-3xl font-extrabold uppercase">Choferes</h1>

            {sp.ok && <p className="mb-4 border border-done bg-done-50 px-3 py-2 text-sm text-done">{sp.ok}</p>}
            {sp.error && <p className="mb-4 border border-alert bg-alert-50 px-3 py-2 text-sm text-alert">{sp.error}</p>}

            <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
                <div className="corners corners-accent border border-neutral-200 bg-white p-5">
                    <h2 className="mb-1 font-display text-lg font-bold uppercase">Nuevo chofer</h2>
                    <p className="mb-4 text-xs text-neutral-500">La cuenta queda lista al instante: el chofer entra a /chofer con este correo y contraseña.</p>
                    <form action={createDriverAction} className="flex flex-col gap-3">
                        <div>
                            <label className="label">Nombre</label>
                            <input name="name" required className="input" placeholder="Juan Pérez" />
                        </div>
                        <div>
                            <label className="label">Correo</label>
                            <input name="email" type="email" required className="input" placeholder="juan@empresa.com" />
                        </div>
                        <div>
                            <label className="label">Contraseña <span className="normal-case text-neutral-400">(mín. 8 caracteres)</span></label>
                            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="••••••••" />
                        </div>
                        <button className="btn btn-primary">+ Crear chofer</button>
                    </form>
                </div>

                <div className="flex flex-col gap-3">
                    {drivers.map(({ p, vehicle }) => (
                        <div key={p.id} className="corners flex items-center justify-between border border-neutral-200 bg-white p-5">
                            <div>
                                <p className="font-display text-lg font-bold uppercase">{p.name}</p>
                                <p className="text-xs text-neutral-500">
                                    {vehicle ? `Vehículo: ${vehicle.name} (${vehicle.plate})` : "Sin vehículo — asígnale uno en la sección Vehículos"}
                                </p>
                            </div>
                            <span className={`tag ${vehicle ? "tag-accent" : "tag-outline"}`}>{vehicle ? "Asignado" : "Libre"}</span>
                        </div>
                    ))}
                    {drivers.length === 0 && (
                        <div className="corners border border-neutral-200 bg-white p-6 text-sm text-neutral-500">
                            Aún no hay choferes. Crea el primero con el formulario.
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}
