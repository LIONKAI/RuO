import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    serverActions: {
      // La prueba de entrega sube foto + firma. El cliente comprime la foto,
      // pero el límite por defecto (1 MB) es muy justo. Se queda por debajo de
      // los 4,5 MB que Vercel acepta por request.
      bodySizeLimit: "4mb",
    },
  },
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
