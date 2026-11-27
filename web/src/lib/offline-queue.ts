"use client";

/**
 * Cola offline del chofer en IndexedDB. Cuando no hay señal, las entregas se
 * guardan aquí con foto y firma incluidas, y se reenvían a /api/chofer/sync
 * cuando vuelve la conexión. Sin dependencias: IndexedDB nativo.
 */

const DB_NAME = "ruo-offline";
const STORE = "entregas";

export interface QueuedDelivery {
    id?: number;
    tipo: "completar" | "fallar";
    destinationId: number;
    workdayId: number;
    referencia: string;
    fields: Record<string, string>;
    photo: Blob | null;
    signature: Blob | null;
    queuedAt: number;
}

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function queueDelivery(item: Omit<QueuedDelivery, "id" | "queuedAt">): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).add({ ...item, queuedAt: Date.now() });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
    notifyChange();
}

export async function pendingCount(): Promise<number> {
    try {
        const db = await openDb();
        const count = await new Promise<number>((resolve, reject) => {
            const req = db.transaction(STORE, "readonly").objectStore(STORE).count();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        db.close();
        return count;
    } catch {
        return 0;
    }
}

async function allQueued(): Promise<QueuedDelivery[]> {
    const db = await openDb();
    const items = await new Promise<QueuedDelivery[]>((resolve, reject) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result as QueuedDelivery[]);
        req.onerror = () => reject(req.error);
    });
    db.close();
    return items;
}

async function remove(id: number): Promise<void> {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

/** Listeners simples para que el badge de sincronización se actualice. */
const listeners = new Set<() => void>();
export function onQueueChange(fn: () => void): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}
function notifyChange() {
    listeners.forEach((fn) => fn());
}

let draining = false;

/**
 * Reenvía la cola al servidor en orden. Devuelve cuántas quedaron pendientes.
 * Las que el servidor descarta (ya cerradas por otro camino) se eliminan igual.
 */
export async function drainQueue(): Promise<number> {
    if (draining || !navigator.onLine) return pendingCount();
    draining = true;
    try {
        const items = await allQueued();
        for (const item of items) {
            const fd = new FormData();
            fd.set("tipo", item.tipo);
            fd.set("id", String(item.destinationId));
            fd.set("workday_id", String(item.workdayId));
            for (const [k, v] of Object.entries(item.fields)) fd.set(k, v);
            if (item.photo) fd.set("photo", item.photo, "entrega.jpg");
            if (item.signature) fd.set("signature", item.signature, "firma.png");

            try {
                const res = await fetch("/api/chofer/sync", { method: "POST", body: fd });
                const data = (await res.json().catch(() => ({}))) as { ok?: boolean; descartar?: boolean };
                if (data.ok || data.descartar) {
                    await remove(item.id!);
                    notifyChange();
                } else if (res.status === 401) {
                    break; // sesión caída: reintentar después, no tiene sentido seguir
                }
                // errores 500: se queda en cola para el próximo intento pero seguimos con las demás
            } catch {
                break; // sin conexión real: parar hasta el próximo evento online
            }
        }
        return pendingCount();
    } finally {
        draining = false;
    }
}
