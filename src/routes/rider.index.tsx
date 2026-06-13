import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ScanLine, Phone, Navigation, MessageCircle,
  Search, Route as RouteIcon, MapPin, Calendar,
  StopCircle,
} from "lucide-react";
import { statusBadgeClass } from "@/lib/parcel-status";
import { whatsappLinkForReceiver } from "@/lib/messaging";
import { googleMapsUrl } from "@/lib/geo";
import { haversineKm, multiStopDirections, getCurrentPosition } from "@/lib/route-geo";
import type { ParsedCoords } from "@/lib/geo";
import { toast } from "sonner";
import { ShiftCard } from "@/components/ShiftCard";
import type { Shift } from "@/components/ShiftCard";
import { useRiderAssignmentNotifications } from "@/hooks/use-rider-notifications";

export const Route = createFileRoute("/rider/")({
  component: () => (
    <RoleGuard allow={["rider"]}>
      <RiderHome />
    </RoleGuard>
  ),
});

interface Stats {
  ofd: number;
  delivered: number;
  exceptions: number;
  cod: number;
  pickups: number;
}

// ── Shift-required gate overlay ───────────────────────────────────────────

function NoShiftOverlay() {
  return (
    <Card className="border-border/60 bg-card/60 p-8 flex flex-col items-center gap-3 text-center">
      <StopCircle className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">
        Start your shift above to access deliveries, scanner, and route tools.
      </p>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────

function RiderHome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  useRiderAssignmentNotifications();

  // shift state — undefined = still loading from DB, null = no active shift
  const [activeShift, setActiveShift] = useState<Shift | null | undefined>(undefined);

  const [list, setList] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [stats, setStats] = useState<Stats>({ ofd: 0, delivered: 0, exceptions: 0, cod: 0, pickups: 0 });
  const [search, setSearch] = useState("");
  const [pos, setPos] = useState<ParsedCoords | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const shiftActive = Boolean(activeShift);

  // ── data fetch (only when shift is active) ──────────────────────────────

  const fetchData = useCallback(async () => {
    if (!user || !shiftActive) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const [{ data: active }, { data: exc }, { data: del }, { data: pickups }] = await Promise.all([
      supabase.from("parcels")
        .select("id, tracking_number, external_tracking_number, carrier, is_external, receiver_name, receiver_phone, receiver_location, receiver_landmark, receiver_lat, receiver_lng, status, amount, payment_type, scheduled_date")
        .eq("assigned_rider_id", user.id)
        .in("status", ["Out for Delivery", "Arrived", "Rescheduled"]),
      supabase.from("parcels").select("id, tracking_number, receiver_name, status, notes, updated_at")
        .eq("assigned_rider_id", user.id).eq("status", "Exception").gte("updated_at", todayIso),
      supabase.from("parcels").select("id, amount, payment_type, status")
        .eq("assigned_rider_id", user.id).eq("status", "Delivered").gte("updated_at", todayIso),
      supabase.from("parcels").select("id, status")
        .eq("assigned_rider_id", user.id).eq("status", "Picked Up").gte("updated_at", todayIso),
    ]);
    setList(active || []);
    setExceptions(exc || []);
    const codCollected = (del || [])
      .filter((p: any) => p.payment_type === "cod")
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const ofdCount = (active || []).filter((p: any) => p.status === "Out for Delivery").length;
    setStats({
      ofd: ofdCount,
      delivered: (del || []).length,
      exceptions: (exc || []).length,
      cod: codCollected,
      pickups: (pickups || []).length,
    });
  }, [user, shiftActive]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  // re-fetch parcels when shift becomes active
  useEffect(() => {
    if (shiftActive) fetchData();
    // clear parcel data when shift ends
    else { setList([]); setExceptions([]); setStats({ ofd: 0, delivered: 0, exceptions: 0, cod: 0, pickups: 0 }); }
  }, [shiftActive]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = () => setRefreshKey((k) => k + 1);
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, []);

  useEffect(() => {
    getCurrentPosition().then(setPos);
  }, []);

  // ── derived lists ───────────────────────────────────────────────────────

  const activeParcels = useMemo(() => {
    const active = list.filter((p) => p.status === "Out for Delivery" || p.status === "Arrived");
    if (!pos) return active;
    return [...active].sort((a, b) => {
      const ac = a.receiver_lat && a.receiver_lng
        ? haversineKm(pos, { lat: Number(a.receiver_lat), lng: Number(a.receiver_lng) })
        : Infinity;
      const bc = b.receiver_lat && b.receiver_lng
        ? haversineKm(pos, { lat: Number(b.receiver_lat), lng: Number(b.receiver_lng) })
        : Infinity;
      return ac - bc;
    });
  }, [list, pos]);

  const rescheduledParcels = useMemo(() => list.filter((p) => p.status === "Rescheduled"), [list]);

  const routeUrl = useMemo(() => {
    const stops = activeParcels
      .filter((p) => p.receiver_lat && p.receiver_lng)
      .map((p) => ({ lat: Number(p.receiver_lat), lng: Number(p.receiver_lng) }));
    if (stops.length === 0) return null;
    return multiStopDirections(stops, pos ?? undefined);
  }, [activeParcels, pos]);

  // ── search ──────────────────────────────────────────────────────────────

  const onSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftActive) { toast.error("Start your shift first."); return; }
    const code = search.trim();
    if (!code) return;
    const { data } = await supabase
      .from("parcels")
      .select("id")
      .or(`tracking_number.eq.${code},external_tracking_number.eq.${code}`)
      .maybeSingle();
    if (!data) { toast.error("Parcel not found"); return; }
    navigate({ to: "/rider/parcels/$id", params: { id: data.id } });
  };

  const distFor = (p: any): string | null => {
    if (!pos || !p.receiver_lat || !p.receiver_lng) return null;
    const km = haversineKm(pos, { lat: Number(p.receiver_lat), lng: Number(p.receiver_lng) });
    return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
  };

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="-mx-4 -mt-4 bg-[var(--gradient-hero)] px-4 pb-6 pt-5 text-primary-foreground sm:rounded-b-2xl">
        <h1 className="font-heading text-2xl font-bold text-4xl text-black">Rider's Dashboard</h1>
        <p className="text-sm opacity-90 text-black"  >Tap a parcel to update status.</p>
      </div>

      {/* ShiftCard — always visible so rider can start/end */}
      <ShiftCard onShiftChange={setActiveShift} />

      {/* ── Everything below is gated behind an active shift ── */}
      {!shiftActive ? (
        // Show placeholder while loading or when no shift
        activeShift === undefined ? null : <NoShiftOverlay />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-5 gap-2">
            <StatCard label="OFD" value={stats.ofd} />
            <StatCard label="Picked" value={stats.pickups} />
            <StatCard label="Delivered" value={stats.delivered} />
            <StatCard label="Exc" value={stats.exceptions} />
            <StatCard label="COD" value={`KES ${stats.cod.toLocaleString()}`} small />
          </div>

          {/* Search */}
          <form onSubmit={onSearch} className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find by tracking # (ours or carrier's)"
              className="font-mono"
            />
            <Button type="submit" variant="outline"><Search className="h-4 w-4" /></Button>
          </form>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <Link to="/rider/scan">
              <Button className="h-14 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90">
                <ScanLine className="mr-2 h-5 w-5" /> Scanner
              </Button>
            </Link>
            {routeUrl ? (
              <a href={routeUrl} target="_blank" rel="noreferrer">
                <Button variant="outline" className="h-14 w-full text-base">
                  <RouteIcon className="mr-2 h-5 w-5" /> Open route
                </Button>
              </a>
            ) : (
              <Button variant="outline" className="h-14 w-full text-base" disabled>
                <RouteIcon className="mr-2 h-5 w-5" /> No pinned stops
              </Button>
            )}
          </div>

          {/* ── Active Deliveries (OFD + Arrived) ── */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-lg">My Delivery List ({activeParcels.length})</h2>
              {pos && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                  <MapPin className="h-3 w-3 text-primary" /> sorted by distance
                </span>
              )}
            </div>
            {activeParcels.length === 0 ? (
              <Card className="border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
                No deliveries assigned.
              </Card>
            ) : (
              <div className="space-y-2">
                {activeParcels.map((p, idx) => {
                  const d = distFor(p);
                  return (
                    <Card key={p.id} className="border-border/60 bg-card p-3">
                      <Link to="/rider/parcels/$id" params={{ id: p.id }} className="block">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                                {idx + 1}
                              </span>
                              <span className="font-mono">{p.tracking_number}</span>
                              {p.is_external && p.carrier && (
                                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] uppercase text-primary">
                                  {p.carrier}
                                </span>
                              )}
                              {d && <span className="ml-auto text-[10px] text-primary">{d}</span>}
                            </div>
                            <div className="truncate text-sm font-medium">{p.receiver_name}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {p.receiver_landmark || p.receiver_location}
                            </div>
                          </div>
                          <Badge className={statusBadgeClass(p.status)}>
                            {p.status === "Arrived" ? "Arrived" : "OFD"}
                          </Badge>
                        </div>
                      </Link>
                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <a href={`tel:${p.receiver_phone}`}>
                          <Button variant="outline" size="sm" className="w-full">
                            <Phone className="mr-1 h-3 w-3" /> Call
                          </Button>
                        </a>
                        <a
                          href={whatsappLinkForReceiver({
                            name: p.receiver_name,
                            phone: p.receiver_phone,
                            tracking: p.tracking_number,
                          })}
                          target="_blank" rel="noreferrer"
                        >
                          <Button variant="outline" size="sm" className="w-full">
                            <MessageCircle className="mr-1 h-3 w-3" /> WA
                          </Button>
                        </a>
                        <a
                          href={googleMapsUrl({
                            lat: p.receiver_lat,
                            lng: p.receiver_lng,
                            landmark: p.receiver_landmark,
                            fallback: p.receiver_location,
                          })}
                          target="_blank" rel="noreferrer"
                        >
                          <Button variant="outline" size="sm" className="w-full">
                            <Navigation className="mr-1 h-3 w-3" /> Map
                          </Button>
                        </a>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Rescheduled ── */}
          {rescheduledParcels.length > 0 && (
            <section>
              <h2 className="mb-2 text-lg">Rescheduled ({rescheduledParcels.length})</h2>
              <div className="space-y-2">
                {rescheduledParcels.map((p) => (
                  <Card key={p.id} className="border-amber-500/30 bg-amber-500/5 p-3">
                    <Link to="/rider/parcels/$id" params={{ id: p.id }} className="block">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-xs text-muted-foreground">{p.tracking_number}</div>
                          <div className="truncate text-sm font-medium">{p.receiver_name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {p.receiver_landmark || p.receiver_location}
                          </div>
                          {p.scheduled_date && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-amber-600">
                              <Calendar className="h-3 w-3" />
                              {new Date(p.scheduled_date).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <Badge className={statusBadgeClass(p.status)}>Rescheduled</Badge>
                      </div>
                    </Link>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <a href={`tel:${p.receiver_phone}`}>
                        <Button variant="outline" size="sm" className="w-full">
                          <Phone className="mr-1 h-3 w-3" /> Call
                        </Button>
                      </a>
                      <a
                        href={whatsappLinkForReceiver({
                          name: p.receiver_name,
                          phone: p.receiver_phone,
                          tracking: p.tracking_number,
                        })}
                        target="_blank" rel="noreferrer"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <MessageCircle className="mr-1 h-3 w-3" /> WA
                        </Button>
                      </a>
                      <a
                        href={googleMapsUrl({
                          lat: p.receiver_lat,
                          lng: p.receiver_lng,
                          landmark: p.receiver_landmark,
                          fallback: p.receiver_location,
                        })}
                        target="_blank" rel="noreferrer"
                      >
                        <Button variant="outline" size="sm" className="w-full">
                          <Navigation className="mr-1 h-3 w-3" /> Map
                        </Button>
                      </a>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* ── Today's Exceptions ── */}
          <section>
            <h2 className="mb-2 text-lg">Today's Exceptions ({exceptions.length})</h2>
            {exceptions.length === 0 ? (
              <Card className="border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
                None today.
              </Card>
            ) : (
              <div className="space-y-2">
                {exceptions.map((p) => (
                  <Link key={p.id} to="/rider/parcels/$id" params={{ id: p.id }}>
                    <Card className="border-border/60 bg-card p-3">
                      <div className="font-mono text-xs">{p.tracking_number}</div>
                      <div className="text-sm">{p.receiver_name}</div>
                      {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: number | string; small?: boolean }) {
  return (
    <Card className="border-border/60 bg-card p-2 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-heading font-bold text-primary ${small ? "text-sm" : "text-xl"}`}>{value}</div>
    </Card>
  );
}