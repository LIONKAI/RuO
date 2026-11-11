import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "./Logo";
import { supabaseServer, type SessionUser } from "@/lib/supabase";

async function logout() {
    "use server";
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
}

const adminNav = [
    ["/admin", "Flota"],
    ["/admin/pedidos", "Pedidos"],
    ["/admin/vehiculos", "Vehículos"],
    ["/admin/resumen", "Resumen"],
] as const;

const driverNav = [["/chofer", "Mi ruta"]] as const;

export function AppShell({ user, section, children }: { user: SessionUser; section: "admin" | "chofer"; children: React.ReactNode }) {
    const nav = section === "admin" ? adminNav : driverNav;

    return (
        <div className="flex min-h-screen flex-col bg-ruo-50">
            <header className="sticky top-0 z-50 flex h-15 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-10">
                <Link href="/"><Logo size={24} /></Link>
                <nav className="flex items-center gap-1 sm:gap-4">
                    {nav.map(([href, label]) => (
                        <Link key={href} href={href} className="px-2 py-1 text-sm text-neutral-600 hover:text-ruo-700">{label}</Link>
                    ))}
                    <span className="hidden text-xs text-neutral-400 sm:inline">{user.name}</span>
                    <form action={logout}>
                        <button type="submit" className="btn btn-ghost px-2 py-1 text-sm">Salir</button>
                    </form>
                </nav>
            </header>
            <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        </div>
    );
}
