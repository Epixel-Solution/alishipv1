import { createFileRoute } from "@tanstack/react-router";
import { RoleGuard } from "@/components/RoleGuard";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { statusBadgeClass, type ParcelStatus } from "@/lib/parcel-status";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/rider/list")({
  component: () => (
    <RoleGuard allow={["rider"]}>
      <RiderList />
    </RoleGuard>
  ),
});

const FILTERS: { label: string; value: "all" | ParcelStatus }[] = [
  { label: "All", value: "all" },
  { label: "OFD", value: "Out for Delivery" },
  { label: "Delivered", value: "Delivered" },
  { label: "Exception", value: "Exception" },
  { label: "Rescheduled", value: "Rescheduled" },
  { label: "Picked Up", value: "Picked Up" },
];

function RiderList() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | ParcelStatus>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("parcels")
        .select("id, tracking_number, external_tracking_number, receiver_name, receiver_location, status, updated_at, scheduled_date")
        .eq("assigned_rider_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(300);
      setItems(data || []);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((p) => {
      if (filter !== "all" && p.status !== filter) return false;
      if (!needle) return true;
      return (
        (p.tracking_number || "").toLowerCase().includes(needle) ||
        (p.external_tracking_number || "").toLowerCase().includes(needle) ||
        (p.receiver_name || "").toLowerCase().includes(needle) ||
        (p.receiver_location || "").toLowerCase().includes(needle)
      );
    });
  }, [items, filter, q]);

  const groups = useMemo(() => {
    // Compute fresh on every render so dates don't go stale
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayStr = now.toISOString().slice(0, 10);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(now.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().slice(0, 10);

    const todays: any[] = [];
    const tomorrows: any[] = [];
    const others: any[] = [];

    for (const p of filtered) {
      const sd = p.scheduled_date as string | null;

      // Active statuses always go to Today regardless of scheduled_date
      if (
        p.status === "Out for Delivery" ||
        p.status === "Arrived" ||
        p.status === "Picked Up"
      ) {
        todays.push(p);
        continue;
      }

      // Rescheduled: bucket by scheduled date
      if (p.status === "Rescheduled") {
        if (!sd || sd === todayStr) {
          todays.push(p);
        } else if (sd === tomorrowStr) {
          tomorrows.push(p);
        } else {
          others.push(p);
        }
        continue;
      }

      // Everything else (Delivered, Exception, Return Delivered, etc.)
      others.push(p);
    }

    return { todays, tomorrows, others };
  }, [filtered]);

  return (
    <div className="space-y-3">
      <h1 className="text-2xl">My Parcels</h1>
      <div className="flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tracking, name, area"
        />
        <Button variant="outline" type="button" tabIndex={-1}>
          <Search className="h-4 w-4" />
        </Button>
      </div>
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === f.value
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-background text-muted-foreground hover:border-primary/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Card className="border-border/60 bg-card/60 p-4 text-sm text-muted-foreground">
          {items.length === 0 ? "Nothing assigned yet." : "No parcels match your filters."}
        </Card>
      ) : (
        <div className="space-y-5">
          <ParcelGroup title={`Today (${groups.todays.length})`} items={groups.todays} />
          <ParcelGroup title={`Tomorrow — Rescheduled (${groups.tomorrows.length})`} items={groups.tomorrows} />
          <ParcelGroup title={`Other (${groups.others.length})`} items={groups.others} />
        </div>
      )}
    </div>
  );
}

function ParcelGroup({ title, items }: { title: string; items: any[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((p) => (
          <Link key={p.id} to="/rider/parcels/$id" params={{ id: p.id }}>
            <Card className="h-full border-border/60 bg-card p-3 transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-xs text-muted-foreground">{p.tracking_number}</div>
                  <div className="truncate text-sm font-medium">{p.receiver_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.receiver_location}</div>
                  {p.status === "Rescheduled" && p.scheduled_date && (
                    <div className="mt-1 text-[10px] text-warning-foreground">
                      Scheduled: {p.scheduled_date}
                    </div>
                  )}
                </div>
                <Badge className={statusBadgeClass(p.status)}>{p.status}</Badge>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}