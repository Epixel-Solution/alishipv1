import { Link } from "@tanstack/react-router";
import {
  FileText, Printer, PackageOpen, Truck, MapPin, CheckCheck,
  ArrowDownToLine, CreditCard, PackageCheck, PauseCircle,
  Lock, Unlock, AlertTriangle, PackagePlus,
} from "lucide-react";
import { Card } from "@/components/ui/card";import { Link } from "@tanstack/react-router";
import {
  FileText, Printer, PackageOpen, Truck, MapPin, CheckCheck,
  ArrowDownToLine, CreditCard, PackageCheck, PauseCircle,
  Lock, Unlock, AlertTriangle, PackagePlus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { statusBadgeClass } from "@/lib/parcel-status";
import { Badge } from "@/components/ui/badge";

function buildTiles(basePath: string) {
  return [
    { to: `${basePath}/waybill`, label: "Waybill Entry", icon: FileText },
    { to: `${basePath}/external`, label: "External Waybill", icon: PackagePlus },
    { to: `${basePath}/parcels`, label: "Print", icon: Printer },
    { to: `${basePath}/scan/pickup`, label: "Pick-up Scan", icon: PackageOpen },
    { to: `${basePath}/scan/departure`, label: "Departure", icon: Truck },
    { to: `${basePath}/scan/arrival`, label: "Arrival", icon: MapPin },
    { to: `${basePath}/scan/ready`, label: "Ready Collection", icon: CheckCheck },
    { to: `${basePath}/scan/out_for_delivery`, label: "Out for Delivery", icon: ArrowDownToLine },
    { to: `${basePath}/dispatch`, label: "Batch Dispatch", icon: Truck },
    { to: `${basePath}/scan/payment`, label: "Online Payment", icon: CreditCard },
    { to: `${basePath}/scan/delivered`, label: "Delivered", icon: PackageCheck },
    { to: `${basePath}/scan/hold`, label: "Hold", icon: PauseCircle },
    { to: `${basePath}/scan/vehicle_sealing`, label: "Vehicle Sealing", icon: Lock },
    { to: `${basePath}/scan/unsealing`, label: "Unsealing", icon: Unlock },
    { to: `${basePath}/scan/exception`, label: "Exception", icon: AlertTriangle },
    { to: "/office/bags", label: "Bags", icon: PackagePlus },
    { to: "/office/pending", label: "Pending Waybills", icon: FileText },
    { to: "/office/cod", label: "COD Recon", icon: CreditCard },
  ];
}

// All dashboard data in one object — batched into a single setState
// so React only re-renders the page ONCE when data loads, preventing
// the ghost/stacking glitch on slow Android GPUs.
interface DashData {
  yetToArrive: number;
  arrivedPending: number;
  pendingPickup: number;
  outForDelivery: number;
  todaysExceptions: number;
  recentExceptions: any[];
  outForDeliveryList: any[];
  pendingPickupList: any[];
}

const EMPTY: DashData = {
  yetToArrive: 0, arrivedPending: 0, pendingPickup: 0,
  outForDelivery: 0, todaysExceptions: 0,
  recentExceptions: [], outForDeliveryList: [], pendingPickupList: [],
};

export function OfficeHome({ basePath = "/office" }: { basePath?: string }) {
  const TILES = buildTiles(basePath);
  const [data, setData] = useState<DashData>(EMPTY);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    (async () => {
      // Fire all 8 queries in parallel, then set state ONCE
      const [
        { count: yetToArrive },
        { count: arrivedPending },
        { count: pendingPickup },
        { count: outForDelivery },
        { count: todaysExceptions },
        { data: ex },
        { data: ofd },
        { data: pp },
      ] = await Promise.all([
        supabase.from("parcels").select("*", { count: "exact", head: true }).in("status", ["Departed"]),
        supabase.from("parcels").select("*", { count: "exact", head: true }).eq("status", "Arrived"),
        supabase.from("parcels").select("*", { count: "exact", head: true }).eq("status", "Created"),
        supabase.from("parcels").select("*", { count: "exact", head: true }).eq("status", "Out for Delivery"),
        supabase.from("parcels").select("*", { count: "exact", head: true }).eq("status", "Exception").gte("updated_at", todayIso),
        supabase.from("parcels").select("id, tracking_number, receiver_name, status, updated_at, notes")
          .eq("status", "Exception").gte("updated_at", todayIso).order("updated_at", { ascending: false }).limit(5),
        supabase.from("parcels").select("id, tracking_number, receiver_name, receiver_location, status")
          .eq("status", "Out for Delivery").order("updated_at", { ascending: false }).limit(5),
        supabase.from("parcels").select("id, tracking_number, sender_name, sender_location, status")
          .eq("status", "Created").order("created_at", { ascending: false }).limit(5),
      ]);

      // Single setState = single re-render
      setData({
        yetToArrive: yetToArrive ?? 0,
        arrivedPending: arrivedPending ?? 0,
        pendingPickup: pendingPickup ?? 0,
        outForDelivery: outForDelivery ?? 0,
        todaysExceptions: todaysExceptions ?? 0,
        recentExceptions: ex || [],
        outForDeliveryList: ofd || [],
        pendingPickupList: pp || [],
      });
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="-mx-4 -mt-4 bg-zinc-950 px-4 pb-6 pt-5 text-zinc-50 sm:rounded-b-2xl">
        <h1 className="font-heading text-2xl font-bold text-zinc-50">Operations</h1>
        <p className="text-sm text-zinc-400">Tap an action to begin.</p>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-2 text-center"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-primary">
              <t.icon className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium leading-tight">{t.label}</span>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg">Inbound</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Yet to Arrive</div>
            <div className="mt-1 font-heading text-3xl font-bold text-primary">{data.yetToArrive}</div>
          </Card>
          <Card className="border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Arrived · Pending</div>
            <div className="mt-1 font-heading text-3xl font-bold text-primary">{data.arrivedPending}</div>
          </Card>
        </div>
      </section>

      <ListSection title={`Pending Pickup (${data.pendingPickup})`} items={data.pendingPickupList}
        renderItem={(p) => (<><div className="font-mono text-xs">{p.tracking_number}</div><div className="text-sm">{p.sender_name}</div><div className="text-xs text-muted-foreground">{p.sender_location}</div></>)}
        emptyText="No pickups pending." />

      <ListSection title={`Out for Delivery (${data.outForDelivery})`} items={data.outForDeliveryList}
        renderItem={(p) => (<><div className="font-mono text-xs">{p.tracking_number}</div><div className="text-sm">{p.receiver_name}</div><div className="text-xs text-muted-foreground">{p.receiver_location}</div></>)}
        emptyText="Nothing out for delivery." />

      <ListSection title={`Today's Exceptions (${data.todaysExceptions})`} items={data.recentExceptions}
        renderItem={(p) => (<><div className="flex items-center justify-between"><div className="font-mono text-xs">{p.tracking_number}</div><Badge className={statusBadgeClass(p.status)}>{p.status}</Badge></div><div className="text-sm">{p.receiver_name}</div>{p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}</>)}
        emptyText="No exceptions today." />
    </div>
  );
}

function ListSection({ title, items, renderItem, emptyText }: {
  title: string; items: any[]; renderItem: (p: any) => any; emptyText: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg">{title}</h2>
      {items.length === 0 ? (
        <Card className="border-border bg-card p-4 text-sm text-muted-foreground">{emptyText}</Card>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <Link key={p.id} to="/office/parcels/$id" params={{ id: p.id }}>
              <Card className="border-border bg-card p-3">
                {renderItem(p)}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { statusBadgeClass } from "@/lib/parcel-status";
import { Badge } from "@/components/ui/badge";

function buildTiles(basePath: string) {
  return [
    { to: `${basePath}/waybill`, label: "Waybill Entry", icon: FileText },
    { to: `${basePath}/external`, label: "External Waybill", icon: PackagePlus },
    { to: `${basePath}/parcels`, label: "Print", icon: Printer },
    { to: `${basePath}/scan/pickup`, label: "Pick-up Scan", icon: PackageOpen },
    { to: `${basePath}/scan/departure`, label: "Departure", icon: Truck },
    { to: `${basePath}/scan/arrival`, label: "Arrival", icon: MapPin },
    { to: `${basePath}/scan/ready`, label: "Ready Collection", icon: CheckCheck },
    { to: `${basePath}/scan/out_for_delivery`, label: "Out for Delivery", icon: ArrowDownToLine },
    { to: `${basePath}/dispatch`, label: "Batch Dispatch", icon: Truck },
    { to: `${basePath}/scan/payment`, label: "Online Payment", icon: CreditCard },
    { to: `${basePath}/scan/delivered`, label: "Delivered", icon: PackageCheck },
    { to: `${basePath}/scan/hold`, label: "Hold", icon: PauseCircle },
    { to: `${basePath}/scan/vehicle_sealing`, label: "Vehicle Sealing", icon: Lock },
    { to: `${basePath}/scan/unsealing`, label: "Unsealing", icon: Unlock },
    { to: `${basePath}/scan/exception`, label: "Exception", icon: AlertTriangle },
    { to: "/office/bags", label: "Bags", icon: PackagePlus },
    { to: "/office/pending", label: "Pending Waybills", icon: FileText },
    { to: "/office/cod", label: "COD Recon", icon: CreditCard },
  ];
}

interface Counts {
  yetToArrive: number;
  arrivedPending: number;
  pendingPickup: number;
  outForDelivery: number;
  todaysExceptions: number;
}

export function OfficeHome({ basePath = "/office" }: { basePath?: string }) {
  const TILES = buildTiles(basePath);
  const [counts, setCounts] = useState<Counts>({
    yetToArrive: 0, arrivedPending: 0, pendingPickup: 0, outForDelivery: 0, todaysExceptions: 0,
  });
  const [recentExceptions, setRecentExceptions] = useState<any[]>([]);
  const [outForDeliveryList, setOutForDeliveryList] = useState<any[]>([]);
  const [pendingPickupList, setPendingPickupList] = useState<any[]>([]);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    (async () => {
      const queries = await Promise.all([
        supabase.from("parcels").select("*", { count: "exact", head: true }).in("status", ["Departed"]),
        supabase.from("parcels").select("*", { count: "exact", head: true }).eq("status", "Arrived"),
        supabase.from("parcels").select("*", { count: "exact", head: true }).eq("status", "Created"),
        supabase.from("parcels").select("*", { count: "exact", head: true }).eq("status", "Out for Delivery"),
        supabase.from("parcels").select("*", { count: "exact", head: true }).eq("status", "Exception").gte("updated_at", todayIso),
      ]);
      setCounts({
        yetToArrive: queries[0].count ?? 0,
        arrivedPending: queries[1].count ?? 0,
        pendingPickup: queries[2].count ?? 0,
        outForDelivery: queries[3].count ?? 0,
        todaysExceptions: queries[4].count ?? 0,
      });
      const [{ data: ex }, { data: ofd }, { data: pp }] = await Promise.all([
        supabase.from("parcels").select("id, tracking_number, receiver_name, status, updated_at, notes")
          .eq("status", "Exception").gte("updated_at", todayIso).order("updated_at", { ascending: false }).limit(5),
        supabase.from("parcels").select("id, tracking_number, receiver_name, receiver_location, status")
          .eq("status", "Out for Delivery").order("updated_at", { ascending: false }).limit(5),
        supabase.from("parcels").select("id, tracking_number, sender_name, sender_location, status")
          .eq("status", "Created").order("created_at", { ascending: false }).limit(5),
      ]);
      setRecentExceptions(ex || []);
      setOutForDeliveryList(ofd || []);
      setPendingPickupList(pp || []);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div className="-mx-4 -mt-4 bg-zinc-950 px-4 pb-6 pt-5 text-zinc-50 sm:rounded-b-2xl">
        <h1 className="font-heading text-2xl font-bold text-zinc-50">Operations</h1>
        <p className="text-sm text-zinc-400">Tap an action to begin.</p>
      </div>

      {/* Grid tiles — removed transition-all, active:scale-95, and CSS-var shadows
          These trigger GPU compositing on weak Android GPUs causing the ghost/stack glitch */}
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-5">
        {TILES.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            className="group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-border bg-card p-2 text-center"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 text-primary">
              <t.icon className="h-5 w-5" />
            </div>
            <span className="text-[11px] font-medium leading-tight">{t.label}</span>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-lg">Inbound</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Yet to Arrive</div>
            <div className="mt-1 font-heading text-3xl font-bold text-primary">{counts.yetToArrive}</div>
          </Card>
          <Card className="border-border bg-card p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Arrived · Pending</div>
            <div className="mt-1 font-heading text-3xl font-bold text-primary">{counts.arrivedPending}</div>
          </Card>
        </div>
      </section>

      <ListSection title={`Pending Pickup (${counts.pendingPickup})`} items={pendingPickupList}
        renderItem={(p) => (<><div className="font-mono text-xs">{p.tracking_number}</div><div className="text-sm">{p.sender_name}</div><div className="text-xs text-muted-foreground">{p.sender_location}</div></>)}
        emptyText="No pickups pending." />

      <ListSection title={`Out for Delivery (${counts.outForDelivery})`} items={outForDeliveryList}
        renderItem={(p) => (<><div className="font-mono text-xs">{p.tracking_number}</div><div className="text-sm">{p.receiver_name}</div><div className="text-xs text-muted-foreground">{p.receiver_location}</div></>)}
        emptyText="Nothing out for delivery." />

      <ListSection title={`Today's Exceptions (${counts.todaysExceptions})`} items={recentExceptions}
        renderItem={(p) => (<><div className="flex items-center justify-between"><div className="font-mono text-xs">{p.tracking_number}</div><Badge className={statusBadgeClass(p.status)}>{p.status}</Badge></div><div className="text-sm">{p.receiver_name}</div>{p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}</>)}
        emptyText="No exceptions today." />
    </div>
  );
}

function ListSection({ title, items, renderItem, emptyText }: {
  title: string; items: any[]; renderItem: (p: any) => any; emptyText: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg">{title}</h2>
      {items.length === 0 ? (
        <Card className="border-border bg-card p-4 text-sm text-muted-foreground">{emptyText}</Card>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <Link key={p.id} to="/office/parcels/$id" params={{ id: p.id }}>
              <Card className="border-border bg-card p-3">
                {renderItem(p)}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
