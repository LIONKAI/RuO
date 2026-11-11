"use client";

/** Año actual — debe usarse detrás de <Suspense> para que no se prerenderice. */
export function CurrentYear() {
    return <>{new Date().getFullYear()}</>;
}
