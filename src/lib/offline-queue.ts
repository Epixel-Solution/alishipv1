// Lightweight offline queue for scan/finalize actions.
// When the network is down, scans are stored in localStorage and replayed
// once the rider reconnects. Server-side RLS still applies on replay.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KEY = "aliship.offline.scans.v1";

export interface QueuedScan {
  id: string;
  parcelId: string;
  tracking: string;
  update: Record<string, any>;
  queuedAt: number;
}

function read(): QueuedScan[] {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function write(items: QueuedScan[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function queueLength(): number {
  return read().length;
}

export function enqueueScan(item: Omit<QueuedScan, "id" | "queuedAt">) {
  const items = read();
  items.push({ ...item, id: crypto.randomUUID(), queuedAt: Date.now() });
  write(items);
}

export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const items = read();
  if (items.length === 0) return { ok: 0, failed: 0 };
  let ok = 0;
  let failed = 0;
  const remaining: QueuedScan[] = [];
  for (const it of items) {
    const { error } = await supabase
      .from("parcels")
      .update(it.update as never)
      .eq("id", it.parcelId);
    if (error) {
      failed++;
      remaining.push(it);
    } else {
      ok++;
    }
  }
  write(remaining);
  return { ok, failed };
}

/** Mount once at app start to auto-flush on reconnect. */
export function startOfflineQueueWatcher() {
  if (typeof window === "undefined") return;
  const flush = async () => {
    if (!navigator.onLine) return;
    const { ok, failed } = await flushQueue();
    if (ok > 0) toast.success(`Synced ${ok} offline scan${ok > 1 ? "s" : ""}`);
    if (failed > 0) toast.error(`${failed} scan${failed > 1 ? "s" : ""} failed to sync`);
  };
  window.addEventListener("online", flush);
  // Periodic retry while online (every 30s)
  setInterval(flush, 30_000);
  flush();
}
