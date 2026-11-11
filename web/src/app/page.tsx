import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { AuthLink } from "@/components/AuthLink";
import { CurrentYear } from "@/components/CurrentYear";

const problems = [
    ["01", "Rutas sin orden", "El chofer decide el orden por intuición. Genera kilómetros extra, combustible desperdiciado y entregas tardías."],
    ["02", "Cero visibilidad", "El administrador no sabe dónde está cada vehículo ni cuántos destinos faltan hasta que el chofer manda un mensaje."],
    ["03", "Excel manual", "Km y combustible se calculan a mano al final del día. Errores frecuentes, datos tardíos, ningún control real."],
] as const;

const steps = [
    ["Administrador", "1", "Carga destinos", "Ingresa las direcciones del día para cada vehículo. RuO calcula la ruta óptima automáticamente."],
    ["Chofer", "2", "Sigue la ruta", "Ve la ruta paso a paso en su teléfono y marca cada destino como completado al llegar."],
    ["Sistema", "3", "Control total", "Destino imprevisto → ruta recalculada en tiempo real. Km y combustible calculados solos al finalizar."],
] as const;

const audiences = [
    {
        who: "Administrador",
        title: <>Tú mandas<br />la flota.</>,
        items: [
            "Carga destinos del día por vehículo",
            "Panel en tiempo real con todos los vehículos",
            "Agrega imprevistos — ruta recalculada al instante",
            "Resumen de km y combustible al cierre del día",
        ],
        cta: "Ver panel admin →",
        dark: true,
    },
    {
        who: "Chofer",
        title: <>Tú sigues<br />la ruta.</>,
        items: [
            "Ruta optimizada del día en tu teléfono",
            "Marca destinos como completados al llegar",
            "Ruta actualizada automáticamente si hay cambios",
            "Resumen de jornada al finalizar",
        ],
        cta: "Ver vista chofer →",
        dark: false,
    },
] as const;

const demoBars = [
    ["Vehículo 1 — Carlos M.", "3/6", 50, "bg-ruo-500", "text-ruo-300"],
    ["Vehículo 2 — Juan P.", "5/5 ✓", 100, "bg-done", "text-done"],
    ["Vehículo 3 — Mario R.", "0/4", 0, "", "text-white/30"],
] as const;

const fallbackCta = "/login";

export default function Landing() {

    return (
        <>
            <header className="sticky top-0 z-50 flex h-15 items-center justify-between border-b border-neutral-200 bg-white px-4 sm:px-16">
                <Link href="/"><Logo size={26} /></Link>
                <nav className="flex items-center gap-3 sm:gap-8">
                    <a href="#como-funciona" className="hidden text-sm text-neutral-600 hover:text-ruo-700 sm:inline">Cómo funciona</a>
                    <a href="#para-quien" className="hidden text-sm text-neutral-600 hover:text-ruo-700 sm:inline">Para quién</a>
                    <Suspense fallback={<Link href={fallbackCta} className="btn btn-primary px-4 py-1.5 text-[13px]">Ingresar</Link>}>
                        <AuthLink className="btn btn-primary px-4 py-1.5 text-[13px]" authedChildren="Ir a mi panel">Ingresar</AuthLink>
                    </Suspense>
                </nav>
            </header>

            <section className="relative overflow-hidden bg-ruo-900 px-4 py-16 sm:px-16 sm:py-28">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(89,128,166,.1)_1px,transparent_1px),linear-gradient(90deg,rgba(89,128,166,.1)_1px,transparent_1px)] bg-[size:48px_48px]" />
                <div className="relative mx-auto max-w-5xl text-center">
                    <div className="mb-7 inline-flex items-center gap-2 border border-ruo-500/40 px-3.5 py-1.5 font-display text-[11px] tracking-[0.1em] text-ruo-300 uppercase">
                        <span className="live-dot inline-block size-1.5 rounded-full bg-ruo-400" />
                        Beta disponible · Bolivia
                    </div>
                    <h1 className="mb-7 font-display text-[clamp(48px,9vw,100px)] leading-[0.92] font-extrabold tracking-tight text-neutral-100 uppercase">
                        Rutas óptimas.<br /><span className="text-ruo-400">Flota bajo control.</span>
                    </h1>
                    <p className="mx-auto mb-11 max-w-xl text-base leading-relaxed text-ruo-200 sm:text-lg">
                        El administrador carga los destinos del día y RuO genera la ruta más eficiente para cada vehículo.
                        El chofer la sigue en tiempo real desde su teléfono.
                    </p>
                    <div className="mb-16 flex flex-wrap justify-center gap-3.5">
                        <Suspense fallback={<Link href={fallbackCta} className="btn btn-primary px-8 py-3 text-[15px]">Ver panel admin →</Link>}>
                            <AuthLink className="btn btn-primary px-8 py-3 text-[15px]">Ver panel admin →</AuthLink>
                        </Suspense>
                        <Suspense fallback={<Link href={fallbackCta} className="btn border-ruo-500/50 bg-transparent px-8 py-3 text-[15px] text-ruo-200 hover:border-ruo-300">Ver vista chofer →</Link>}>
                            <AuthLink className="btn border-ruo-500/50 bg-transparent px-8 py-3 text-[15px] text-ruo-200 hover:border-ruo-300">Ver vista chofer →</AuthLink>
                        </Suspense>
                    </div>

                    <div className="mx-auto grid max-w-2xl gap-4 text-left sm:grid-cols-[3fr_2fr]">
                        <div className="corners border border-ruo-500/25 bg-white/5 p-5" style={{ "--corner-color": "var(--color-ruo-500)" } as React.CSSProperties}>
                            <p className="mb-3.5 font-display text-[9px] tracking-[0.1em] text-ruo-400 uppercase">Panel administrador</p>
                            <div className="flex flex-col gap-2.5 text-[11px]">
                                {demoBars.map(([name, count, width, bar, color]) => (
                                    <div key={name}>
                                        <div className="mb-1 flex justify-between"><span className="text-neutral-100/70">{name}</span><span className={color}>{count}</span></div>
                                        <div className="h-[3px] bg-white/10"><div className={`h-full ${bar}`} style={{ width: `${width}%` }} /></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="corners border border-ruo-500/25 bg-white/5 p-5" style={{ "--corner-color": "var(--color-ruo-500)" } as React.CSSProperties}>
                            <p className="mb-2.5 font-display text-[9px] tracking-[0.1em] text-ruo-400 uppercase">Chofer</p>
                            <svg viewBox="0 0 120 82" className="block h-14 w-full" aria-hidden="true">
                                <line x1="0" y1="41" x2="120" y2="41" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
                                <line x1="60" y1="0" x2="60" y2="82" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
                                <line x1="30" y1="0" x2="30" y2="82" stroke="rgba(255,255,255,.04)" strokeWidth="4" />
                                <line x1="90" y1="0" x2="90" y2="82" stroke="rgba(255,255,255,.04)" strokeWidth="4" />
                                <polyline points="15,68 15,41 60,41 60,20 90,20 90,41" fill="none" stroke="#7298bd" strokeWidth="2" strokeDasharray="6,3" />
                                <circle cx="60" cy="20" r="4" fill="white" stroke="#7298bd" strokeWidth="1.5" />
                                <circle cx="90" cy="41" r="4" fill="#e67e22" />
                                <circle cx="15" cy="41" r="5" fill="#7298bd" />
                                <circle cx="15" cy="41" r="2" fill="white" />
                            </svg>
                            <p className="mt-1.5 text-[10px] text-neutral-100/40">3 → Av. Busch 890</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-4 py-16 sm:px-16 sm:py-24">
                <div className="mx-auto max-w-6xl">
                    <p className="eyebrow mb-3 text-ruo-600">01 — El problema</p>
                    <h2 className="mb-12 font-display text-[clamp(34px,5vw,56px)] leading-none font-extrabold uppercase">Coordinar por WhatsApp<br />no es gestión de flota.</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        {problems.map(([number, title, text]) => (
                            <div key={number} className="corners border border-neutral-200 p-6">
                                <p className="mb-4 font-display text-4xl font-extrabold text-ruo-200">{number}</p>
                                <h3 className="mb-2 font-display text-xl font-bold uppercase">{title}</h3>
                                <p className="text-sm leading-relaxed text-neutral-600">{text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="como-funciona" className="scroll-mt-16 bg-ruo-50 px-4 py-16 sm:px-16 sm:py-24">
                <div className="mx-auto max-w-6xl">
                    <p className="eyebrow mb-3 text-ruo-600">02 — Cómo funciona</p>
                    <h2 className="mb-12 font-display text-[clamp(34px,5vw,56px)] leading-none font-extrabold uppercase">Tres pasos.<br />Todo el día resuelto.</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        {steps.map(([who, number, title, text]) => (
                            <div key={number} className="corners corners-accent border border-ruo-200 bg-white p-6">
                                <div className="mb-5 flex items-center justify-between">
                                    <span className="tag tag-outline">{who}</span>
                                    <span className="flex size-9 items-center justify-center bg-ruo-600 font-display text-lg font-bold text-white">{number}</span>
                                </div>
                                <h3 className="mb-2 font-display text-xl font-bold uppercase">{title}</h3>
                                <p className="text-sm leading-relaxed text-neutral-600">{text}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section id="para-quien" className="scroll-mt-16 px-4 py-16 sm:px-16 sm:py-24">
                <div className="mx-auto max-w-6xl">
                    <p className="eyebrow mb-3 text-ruo-600">03 — Para quién</p>
                    <div className="grid gap-4 md:grid-cols-2">
                        {audiences.map(({ who, title, items, cta, dark }) => (
                            <div
                                key={who}
                                className={`corners p-8 ${dark ? "bg-ruo-900 text-neutral-100" : "border border-neutral-200"}`}
                                style={{ "--corner-color": dark ? "var(--color-ruo-500)" : "var(--color-neutral-400)" } as React.CSSProperties}
                            >
                                <p className={`eyebrow mb-3 ${dark ? "text-ruo-300" : ""}`}>{who}</p>
                                <h3 className="mb-6 font-display text-4xl leading-none font-extrabold uppercase">{title}</h3>
                                <ul className="mb-8 flex flex-col gap-3">
                                    {items.map((item) => (
                                        <li key={item} className="flex gap-3 text-sm">
                                            <span className={dark ? "text-ruo-400" : "text-ruo-600"}>→</span>
                                            <span className={dark ? "text-ruo-100" : "text-neutral-700"}>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                                <Suspense fallback={<Link href={fallbackCta} className={`btn ${dark ? "btn-primary" : "btn-secondary"}`}>{cta}</Link>}>
                                    <AuthLink className={`btn ${dark ? "btn-primary" : "btn-secondary"}`}>{cta}</AuthLink>
                                </Suspense>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="bg-ruo-600 px-4 py-16 text-center text-white sm:px-16">
                <h2 className="mb-3 font-display text-[clamp(34px,5vw,56px)] leading-none font-extrabold uppercase">¿Listo para optimizar?</h2>
                <p className="mb-8 text-ruo-100">Para flotas de 2 a 5 vehículos. Hecho para Bolivia.</p>
                <Suspense fallback={<Link href={fallbackCta} className="btn border-white bg-white px-8 py-3 text-[15px] text-ruo-800 hover:bg-ruo-50">Comenzar ahora →</Link>}>
                    <AuthLink className="btn border-white bg-white px-8 py-3 text-[15px] text-ruo-800 hover:bg-ruo-50">Comenzar ahora →</AuthLink>
                </Suspense>
            </section>

            <footer className="flex flex-col items-center justify-between gap-3 border-t border-neutral-200 px-4 py-6 text-xs text-neutral-500 sm:flex-row sm:px-16">
                <Logo size={18} />
                <span>© <Suspense fallback={null}><CurrentYear /></Suspense> RuO · Ruta Óptima · Bolivia</span>
            </footer>
        </>
    );
}
