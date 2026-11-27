import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "RuO · Ruta Óptima",
        short_name: "RuO",
        description: "Reparto inteligente: rutas optimizadas, choferes en tiempo real y entregas con evidencia.",
        start_url: "/login",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#1e3a5f",
        theme_color: "#1e3a5f",
        icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}
