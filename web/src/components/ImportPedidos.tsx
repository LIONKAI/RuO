"use client";

import { useRef, useState } from "react";
import readXlsxFile from "read-excel-file";

type Row = { address: string; reference: string; phone: string | null; latitude: number | null; longitude: number | null; amount: number | null };

type Fase =
    | { paso: "inicial" }
    | { paso: "preview"; rows: Row[]; sinCoords: number }
    | { paso: "geocodificando"; hechas: number; total: number }
    | { paso: "error"; mensaje: string };

const norm = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");

function columnIndexes(header: string[]) {
    const keys = header.map((h) => norm(String(h ?? "")));
    const find = (...names: string[]) => keys.findIndex((k) => names.some((n) => k.includes(n)));
    return {
        address: find("direccion", "address", "dir"),
        reference: find("referencia", "reference", "cliente", "nombre", "pedido"),
        phone: find("telefono", "phone", "celular", "cel", "whatsapp"),
        lat: find("latitud", "lat"),
        lng: find("longitud", "lng", "lon"),
        amount: find("monto", "cobrar", "total", "importe"),
    };
}

function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (c === '"') inQuotes = false;
            else cell += c;
        } else if (c === '"') inQuotes = true;
        else if (c === "," || c === ";") { row.push(cell.trim()); cell = ""; }
        else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(cell.trim()); cell = "";
            if (row.some((v) => v !== "")) rows.push(row);
            row = [];
        } else cell += c;
    }
    row.push(cell.trim());
    if (row.some((v) => v !== "")) rows.push(row);
    return rows;
}

const cellStr = (v: unknown): string => (v == null ? "" : String(v)).trim();

function rowsFromMatrix(matrix: unknown[][]): Row[] {
    if (matrix.length < 2) return [];
    const idx = columnIndexes(matrix[0].map((h) => cellStr(h)));
    if (idx.address === -1) return [];
    const out: Row[] = [];
    for (const raw of matrix.slice(1)) {
        const get = (i: number) => (i === -1 ? "" : cellStr(raw[i]));
        const address = get(idx.address);
        if (!address) continue;
        const lat = Number(get(idx.lat).replace(",", "."));
        const lng = Number(get(idx.lng).replace(",", "."));
        out.push({
            address,
            reference: get(idx.reference) || address.slice(0, 40),
            phone: get(idx.phone) || null,
            latitude: Number.isFinite(lat) && get(idx.lat) !== "" && Math.abs(lat) <= 90 ? lat : null,
            longitude: Number.isFinite(lng) && get(idx.lng) !== "" && Math.abs(lng) <= 180 ? lng : null,
            amount: Number.isFinite(Number(get(idx.amount).replace(",", "."))) && Number(get(idx.amount).replace(",", ".")) > 0 ? Number(get(idx.amount).replace(",", ".")) : null,
        });
    }
    return out.slice(0, 200);
}

async function geocodeOne(address: string): Promise<{ latitude: number; longitude: number } | null> {
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=bo&q=${encodeURIComponent(address)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const data = (await res.json()) as { lat: string; lon: string }[];
        if (!data.length) return null;
        return { latitude: Number(data[0].lat), longitude: Number(data[0].lon) };
    } catch {
        return null;
    }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Importación masiva de pedidos desde Excel/CSV con geocodificación en el navegador. */
export function ImportPedidos({ action, date }: { action: (formData: FormData) => void; date: string }) {
    const [fase, setFase] = useState<Fase>({ paso: "inicial" });
    const [abierto, setAbierto] = useState(false);
    const rowsRef = useRef<Row[]>([]);
    const formRef = useRef<HTMLFormElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const onFile = async (file: File) => {
        try {
            let matrix: unknown[][];
            if (file.name.toLowerCase().endsWith(".csv")) {
                matrix = parseCsv(await file.text());
            } else {
                matrix = (await readXlsxFile(file)) as unknown[][];
            }
            const rows = rowsFromMatrix(matrix);
            if (rows.length === 0) {
                setFase({ paso: "error", mensaje: "No se encontraron filas válidas. El archivo necesita al menos la columna «dirección»." });
                return;
            }
            rowsRef.current = rows;
            setFase({ paso: "preview", rows, sinCoords: rows.filter((r) => r.latitude == null || r.longitude == null).length });
        } catch {
            setFase({ paso: "error", mensaje: "No se pudo leer el archivo. Formatos: .xlsx o .csv" });
        }
    };

    const importar = async () => {
        const rows = rowsRef.current;
        const faltantes = rows.filter((r) => r.latitude == null || r.longitude == null);

        if (faltantes.length > 0) {
            setFase({ paso: "geocodificando", hechas: 0, total: faltantes.length });
            let hechas = 0;
            for (const row of faltantes) {
                const coords = await geocodeOne(row.address);
                if (coords) {
                    row.latitude = coords.latitude;
                    row.longitude = coords.longitude;
                }
                hechas++;
                setFase({ paso: "geocodificando", hechas, total: faltantes.length });
                await sleep(1100); // política de uso de Nominatim: 1 req/segundo
            }
        }

        const listas = rows.filter((r) => r.latitude != null && r.longitude != null);
        if (inputRef.current && formRef.current) {
            inputRef.current.value = JSON.stringify(listas);
            formRef.current.requestSubmit();
        }
    };

    if (!abierto) {
        return (
            <button type="button" onClick={() => setAbierto(true)} className="btn btn-secondary py-1.5">
                ⬆ Importar Excel/CSV
            </button>
        );
    }

    return (
        <div className="corners border border-ruo-200 bg-ruo-50 p-4">
            <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold uppercase">Importar pedidos</h3>
                <button type="button" onClick={() => setAbierto(false)} className="text-xs text-neutral-400 hover:text-alert">✕ cerrar</button>
            </div>

            <p className="mt-1 text-xs text-neutral-500">
                Columnas: <b>dirección</b> (obligatoria), referencia/cliente, teléfono, monto a cobrar, latitud, longitud (las últimas opcionales — si faltan coordenadas se ubican solas).
            </p>

            {fase.paso !== "preview" && fase.paso !== "geocodificando" && (
                <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="mt-3 text-xs"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onFile(file);
                    }}
                />
            )}

            {fase.paso === "error" && <p className="mt-2 text-xs text-alert">{fase.mensaje}</p>}

            {fase.paso === "preview" && (
                <div className="mt-3">
                    <p className="text-sm">
                        <b>{fase.rows.length}</b> pedidos listos
                        {fase.sinCoords > 0
                            ? ` · ${fase.sinCoords} se ubicarán automáticamente por dirección (tarda ~${Math.ceil(fase.sinCoords * 1.2 / 60) || 1} min)`
                            : " · todos con coordenadas"}
                    </p>
                    <div className="mt-1 max-h-28 overflow-y-auto text-xs text-neutral-500">
                        {fase.rows.slice(0, 8).map((r, i) => (
                            <p key={i}>· {r.reference} — {r.address}</p>
                        ))}
                        {fase.rows.length > 8 && <p>… y {fase.rows.length - 8} más</p>}
                    </div>
                    <button type="button" onClick={importar} className="btn btn-primary mt-3 px-4 py-2 text-sm">
                        Importar {fase.rows.length} pedidos
                    </button>
                </div>
            )}

            {fase.paso === "geocodificando" && (
                <div className="mt-3">
                    <p className="text-sm">Ubicando direcciones… {fase.hechas}/{fase.total}</p>
                    <div className="mt-1 h-2 w-full bg-neutral-200">
                        <div className="h-2 bg-ruo-600 transition-all" style={{ width: `${(fase.hechas / fase.total) * 100}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-neutral-400">No cierres esta ventana.</p>
                </div>
            )}

            <form ref={formRef} action={action} className="hidden">
                <input type="hidden" name="date" value={date} />
                <input ref={inputRef} type="hidden" name="rows" />
            </form>
        </div>
    );
}
