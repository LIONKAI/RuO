import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { supabaseServer } from "@/lib/supabase";
import { UserRole } from "@/lib/domain";

export const instant = false;

async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        redirect("/login?error=credenciales");
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user!.id).single();

    redirect(profile?.role === UserRole.Admin ? "/admin" : "/chofer");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
    const { error } = await searchParams;

    return (
        <div className="flex min-h-screen flex-col bg-ruo-50">
            <header className="flex h-15 items-center border-b border-neutral-200 bg-white px-4 sm:px-16">
                <Link href="/"><Logo size={26} /></Link>
            </header>

            <main className="flex flex-1 items-center justify-center px-4 py-12">
                <div className="corners corners-accent w-full max-w-sm border border-neutral-200 bg-white p-8">
                    <p className="eyebrow mb-1 text-ruo-600">Acceso</p>
                    <h1 className="mb-6 font-display text-3xl font-extrabold uppercase">Ingresar a RuO</h1>

                    {error && (
                        <p className="mb-4 border border-alert bg-alert-50 px-3 py-2 text-sm text-alert">
                            Credenciales incorrectas. Verifica tu correo y contraseña.
                        </p>
                    )}

                    <form action={login} className="flex flex-col gap-4">
                        <div>
                            <label htmlFor="email" className="label">Correo</label>
                            <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="admin@ruo.com" />
                        </div>
                        <div>
                            <label htmlFor="password" className="label">Contraseña</label>
                            <input id="password" name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••" />
                        </div>
                        <button type="submit" className="btn btn-primary mt-2 w-full py-2.5">Ingresar →</button>
                    </form>
                </div>
            </main>
        </div>
    );
}
