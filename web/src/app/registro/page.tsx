import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { CompanyError, registerCompany } from "@/lib/companies";

export const instant = false;

const withMsg = (key: "ok" | "error", msg: string) => `/registro?${key}=${encodeURIComponent(msg)}`;

async function signup(formData: FormData) {
    "use server";

    const input = {
        companyName: String(formData.get("company_name") ?? ""),
        adminName: String(formData.get("admin_name") ?? ""),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
    };

    let target: string;
    try {
        await registerCompany(input);
        target = "/login?ok=cuenta-creada";
    } catch (error) {
        console.error("[signup]", error);
        target = withMsg("error", error instanceof CompanyError ? error.message : "No se pudo completar el registro.");
    }

    redirect(target);
}

export default async function RegistroPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    const { error } = await searchParams;

    return (
        <div className="flex min-h-screen flex-col bg-ruo-50">
            <header className="flex h-15 items-center border-b border-neutral-200 bg-white px-4 sm:px-16">
                <Link href="/"><Logo size={26} /></Link>
            </header>

            <main className="flex flex-1 items-center justify-center px-4 py-12">
                <div className="corners corners-accent w-full max-w-sm border border-neutral-200 bg-white p-8">
                    <p className="eyebrow mb-1 text-ruo-600">Nueva empresa</p>
                    <h1 className="mb-2 font-display text-3xl font-extrabold uppercase">Registra tu empresa</h1>
                    <p className="mb-6 text-sm text-neutral-500">Crea tu cuenta de administrador y empieza a repartir hoy.</p>

                    {error && (
                        <p className="mb-4 border border-alert bg-alert-50 px-3 py-2 text-sm text-alert">{error}</p>
                    )}

                    <form action={signup} className="flex flex-col gap-4">
                        <div>
                            <label htmlFor="company_name" className="label">Nombre de la empresa</label>
                            <input id="company_name" name="company_name" required className="input" placeholder="Distribuidora La Paz" />
                        </div>
                        <div>
                            <label htmlFor="admin_name" className="label">Tu nombre</label>
                            <input id="admin_name" name="admin_name" required className="input" placeholder="María Rojas" />
                        </div>
                        <div>
                            <label htmlFor="email" className="label">Correo</label>
                            <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="maria@empresa.com" />
                        </div>
                        <div>
                            <label htmlFor="password" className="label">Contraseña <span className="normal-case text-neutral-400">(mín. 8 caracteres)</span></label>
                            <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="••••••••" />
                        </div>
                        <button type="submit" className="btn btn-primary mt-2 w-full py-2.5">Crear cuenta →</button>
                    </form>

                    <p className="mt-4 text-center text-xs text-neutral-500">
                        ¿Ya tienes cuenta? <Link href="/login" className="text-ruo-600 underline">Ingresa aquí</Link>
                    </p>
                </div>
            </main>
        </div>
    );
}
