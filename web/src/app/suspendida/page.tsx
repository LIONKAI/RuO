import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { supabaseServer } from "@/lib/supabase";

export const instant = false;

async function logout() {
    "use server";
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
}

export default function SuspendidaPage() {
    return (
        <div className="flex min-h-screen flex-col bg-ruo-50">
            <header className="flex h-15 items-center border-b border-neutral-200 bg-white px-4 sm:px-16">
                <Link href="/"><Logo size={26} /></Link>
            </header>
            <main className="flex flex-1 items-center justify-center px-4">
                <div className="corners corners-accent w-full max-w-sm border border-neutral-200 bg-white p-8 text-center">
                    <p className="eyebrow mb-1 text-alert">Cuenta suspendida</p>
                    <h1 className="mb-3 font-display text-2xl font-extrabold uppercase">Servicio pausado</h1>
                    <p className="mb-5 text-sm text-neutral-500">
                        La cuenta de tu empresa está temporalmente suspendida. Contacta al equipo de RuO para reactivarla.
                    </p>
                    <form action={logout}>
                        <button type="submit" className="btn btn-ghost px-3 py-2 text-xs">Cerrar sesión</button>
                    </form>
                </div>
            </main>
        </div>
    );
}
