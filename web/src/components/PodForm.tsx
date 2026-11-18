"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { completeDestination, failDestination } from "@/app/chofer/actions";
import { failureReasons } from "@/lib/domain";

/** Lado mayor de la foto tras comprimir: una foto de celular (3–8 MB) queda en ~200–500 KB. */
const PHOTO_MAX_SIDE = 1600;

/**
 * Reduce y recomprime la foto en el navegador antes de subirla. Las server
 * actions aceptan hasta 4 MB y Vercel corta los requests a 4,5 MB, así que una
 * foto original del celular fallaría. Si el navegador no puede leer el formato
 * se envía la original y el servidor la valida.
 */
async function compressPhoto(file: File): Promise<File> {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();

        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.75));
        return blob ? new File([blob], "entrega.jpg", { type: "image/jpeg" }) : file;
    } catch {
        return file;
    }
}

function SubmitButton({ className, children }: { className: string; children: React.ReactNode }) {
    const { pending } = useFormStatus();
    return (
        <button className={className} disabled={pending} aria-busy={pending}>
            {pending ? "Enviando…" : children}
        </button>
    );
}

/**
 * Formulario de prueba de entrega: foto, firma en canvas, receptor, nota y GPS.
 * Captura la posición del chofer al abrir el formulario.
 */
export function PodForm({ destinationId, workdayId }: { destinationId: number; workdayId: number }) {
    const [open, setOpen] = useState<"complete" | "fail" | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const signed = useRef(false);

    const locate = (mode: "complete" | "fail") => {
        setOpen(open === mode ? null : mode);
        navigator.geolocation?.getCurrentPosition(
            (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => {},
            { enableHighAccuracy: true, timeout: 8000 },
        );
    };

    // Convierte la posición del puntero a coordenadas internas del canvas
    // (el canvas se muestra al 100 % del ancho, no a sus 280 px nativos).
    const canvasPoint = (e: React.PointerEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return [
            ((e.clientX - rect.left) * canvas.width) / rect.width,
            ((e.clientY - rect.top) * canvas.height) / rect.height,
        ] as const;
    };

    const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drawing.current = true;
        const ctx = canvasRef.current?.getContext("2d");
        const [x, y] = canvasPoint(e);
        ctx?.beginPath();
        ctx?.moveTo(x, y);
    };

    const draw = (e: React.PointerEvent) => {
        if (!drawing.current) return;
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        ctx.strokeStyle = "#1e3a5f";
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        const [x, y] = canvasPoint(e);
        ctx.lineTo(x, y);
        ctx.stroke();
        signed.current = true;
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
        signed.current = false;
    };

    // Acción del lado del cliente: prepara foto y firma y recién entonces
    // llama a la server action (antes la firma se adjuntaba tarde y se perdía).
    const submitDelivery = async (formData: FormData) => {
        const photo = formData.get("photo");
        if (photo instanceof File && photo.size > 0) {
            formData.set("photo", await compressPhoto(photo));
        } else {
            formData.delete("photo");
        }

        const canvas = canvasRef.current;
        if (signed.current && canvas) {
            const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
            if (blob) formData.set("signature", new File([blob], "firma.png", { type: "image/png" }));
        }

        await completeDestination(formData);
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2">
                <button type="button" onClick={() => locate("complete")} className="btn btn-success px-3 py-1.5 text-xs">✓ Entregar</button>
                <button type="button" onClick={() => locate("fail")} className="btn btn-alert px-3 py-1.5 text-xs">✕ Falló</button>
            </div>

            {open === "complete" && (
                <form action={submitDelivery} className="flex flex-col gap-3 border border-done/30 bg-done-50/40 p-4">
                    <input type="hidden" name="id" value={destinationId} />
                    <input type="hidden" name="workday_id" value={workdayId} />
                    <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
                    <input type="hidden" name="longitude" value={coords?.lng ?? ""} />

                    <div>
                        <label className="label">Foto de entrega</label>
                        <input name="photo" type="file" accept="image/*" capture="environment" className="input py-1.5 text-xs" />
                    </div>
                    <div>
                        <label className="label">Recibió</label>
                        <input name="recipient_name" maxLength={120} className="input" placeholder="Nombre de quien recibe" />
                    </div>
                    <div>
                        <label className="label">Firma <span className="text-neutral-400 normal-case">(dibuja aquí)</span></label>
                        <canvas
                            ref={canvasRef}
                            width={280}
                            height={110}
                            className="w-full border border-neutral-300 bg-white"
                            style={{ touchAction: "none" }}
                            onPointerDown={startDraw}
                            onPointerMove={draw}
                            onPointerUp={() => (drawing.current = false)}
                            onPointerLeave={() => (drawing.current = false)}
                        />
                        <button type="button" onClick={clearSignature} className="mt-1 text-xs text-neutral-500 underline">Limpiar firma</button>
                    </div>
                    <div>
                        <label className="label">Nota <span className="text-neutral-400 normal-case">(opcional)</span></label>
                        <input name="pod_note" maxLength={500} className="input" placeholder="Dejado en portería…" />
                    </div>
                    <p className="text-[11px] text-neutral-500">{coords ? `📍 GPS ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "📍 Obteniendo GPS…"}</p>
                    <SubmitButton className="btn btn-success py-2">Confirmar entrega</SubmitButton>
                </form>
            )}

            {open === "fail" && (
                <form action={failDestination} className="flex flex-col gap-3 border border-alert/30 bg-alert-50/40 p-4">
                    <input type="hidden" name="id" value={destinationId} />
                    <input type="hidden" name="workday_id" value={workdayId} />
                    <div>
                        <label className="label">Motivo de la falla</label>
                        <select name="failure_reason" required className="input">
                            <option value="">Selecciona…</option>
                            {Object.entries(failureReasons).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>
                    <SubmitButton className="btn btn-alert py-2">Marcar como fallida</SubmitButton>
                </form>
            )}
        </div>
    );
}
