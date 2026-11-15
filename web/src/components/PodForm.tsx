"use client";

import { useRef, useState } from "react";
import { completeDestination, failDestination } from "@/app/chofer/actions";
import { failureReasons } from "@/lib/domain";

/**
 * Formulario de prueba de entrega: foto, firma en canvas, receptor, nota y GPS.
 * Captura la posición del chofer al abrir el formulario.
 */
export function PodForm({ destinationId, workdayId }: { destinationId: number; workdayId: number }) {
    const [open, setOpen] = useState<"complete" | "fail" | null>(null);
    const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);

    const locate = (mode: "complete" | "fail") => {
        setOpen(open === mode ? null : mode);
        navigator.geolocation?.getCurrentPosition(
            (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => {},
            { enableHighAccuracy: true, timeout: 8000 },
        );
    };

    const canvasPoint = (e: React.PointerEvent) => {
        const canvas = canvasRef.current!;
        const rect = canvas.getBoundingClientRect();
        return [e.clientX - rect.left, e.clientY - rect.top] as const;
    };

    const startDraw = (e: React.PointerEvent) => {
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
        const [x, y] = canvasPoint(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };

    // Serializa la firma del canvas a un File antes de enviar el form.
    const attachSignature = (form: HTMLFormElement) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        canvas.toBlob((blob) => {
            if (!blob || blob.size < 500) return;
            const file = new File([blob], "firma.png", { type: "image/png" });
            const dt = new DataTransfer();
            dt.items.add(file);
            const input = form.querySelector<HTMLInputElement>('input[name="signature"]');
            if (input) input.files = dt.files;
        });
    };

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-2">
                <button type="button" onClick={() => locate("complete")} className="btn btn-success px-3 py-1.5 text-xs">✓ Entregar</button>
                <button type="button" onClick={() => locate("fail")} className="btn btn-alert px-3 py-1.5 text-xs">✕ Falló</button>
            </div>

            {open === "complete" && (
                <form
                    action={completeDestination}
                    className="flex flex-col gap-3 border border-done/30 bg-done-50/40 p-4"
                    onSubmit={(e) => attachSignature(e.currentTarget)}
                >
                    <input type="hidden" name="id" value={destinationId} />
                    <input type="hidden" name="workday_id" value={workdayId} />
                    <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
                    <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
                    <input type="hidden" name="signature" />

                    <div>
                        <label className="label">Foto de entrega</label>
                        <input name="photo" type="file" accept="image/*" capture="environment" className="input py-1.5 text-xs" />
                    </div>
                    <div>
                        <label className="label">Recibió</label>
                        <input name="recipient_name" className="input" placeholder="Nombre de quien recibe" />
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
                        <input name="pod_note" className="input" placeholder="Dejado en portería…" />
                    </div>
                    <p className="text-[11px] text-neutral-500">{coords ? `📍 GPS ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "📍 Obteniendo GPS…"}</p>
                    <button className="btn btn-success py-2">Confirmar entrega</button>
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
                    <button className="btn btn-alert py-2">Marcar como fallida</button>
                </form>
            )}
        </div>
    );
}
