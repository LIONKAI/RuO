import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const barlow = Barlow({
    variable: "--font-barlow",
    subsets: ["latin"],
    weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
    variable: "--font-barlow-condensed",
    subsets: ["latin"],
    weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
    title: "RuO · Ruta Óptima",
    description:
        "El administrador carga los destinos del día y RuO genera la ruta más eficiente para cada vehículo. El chofer la sigue en tiempo real desde su teléfono.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="es" className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
            <body className="min-h-full bg-white font-sans text-neutral-900">{children}</body>
        </html>
    );
}
