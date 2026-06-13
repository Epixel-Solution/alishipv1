import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { PublicShell } from "@/components/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { getPublicTracking } from "@/fns/tracking.functions";
import { formatTimelineLine } from "@/lib/parcel-format";
import {
  DELIVERY_TYPE_LABEL,
  GOODS_TYPE_LABEL,
  PRODUCT_SERVICE_LABEL,
  SETTLEMENT_TYPE_LABEL,
  SERVICE_CLASS_LABEL,
  type DeliveryType,
  type GoodsType,
  type ProductService,
  type SettlementType,
  type ServiceClass,
} from "@/lib/waybill-options";

export const Route = createFileRoute("/track")({
  component: TrackPage,
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ waybill: z.string().trim().optional() }).parse(s),
});

type Result = Awaited<ReturnType<typeof getPublicTracking>>;

function TrackPage() {
  const search = Route.useSearch();
  const [waybill, setWaybill] = useState(search.waybill ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const runSearch = async (value: string) => {
    const t = value.trim();
    if (!t) return;
    setLoading(true);
    try {
      const r = await getPublicTracking({ waybill: t });
      setResult(r);
      if (!r.found) toast.error("No parcel found for that waybill");
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch tracking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (search.waybill) runSearch(search.waybill);
  }, [search.waybill]);

  const onSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    runSearch(waybill);
  };

  return (
    <PublicShell>
      <div className="mx-auto max-w-screen-md px-4 py-8">
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold">Track your parcel</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter the waybill, carrier tracking, or order number to see live status.
          </p>
        </div>

        <form
          onSubmit={onSearch}
          className="mt-6 rounded-xl border border-border bg-card p-3 shadow-sm"
        >
          <Input
            value={waybill}
            onChange={(e) => setWaybill(e.target.value)}
            placeholder="e.g. ALS-20260506-1234 or Alimall order #"
            className="h-12 text-base"
            autoFocus
          />
          <Button
            type="submit"
            disabled={loading || !waybill.trim()}
            className="mx-auto mt-3 block h-11 rounded-full bg-primary px-10 text-primary-foreground hover:bg-primary/90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-2">
                <Search className="h-4 w-4" /> Search
              </span>
            )}
          </Button>
        </form>

        <div className="mt-6">
          {!result && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Enter your waybill number above to see your parcel status.
            </p>
          )}
          {result && !result.found && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No parcel found. Please check the waybill or order number.
            </Card>
          )}
          {result?.found && <ResultView result={result} />}
        </div>
      </div>
    </PublicShell>
  );
}

function ResultView({ result }: { result: Extract<Result, { found: true }> }) {
  const p = result.parcel;
  return (
    <Tabs defaultValue="logistics" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="logistics">Logistics Info</TabsTrigger>
        <TabsTrigger value="basic">Basic Information</TabsTrigger>
      </TabsList>

      <TabsContent value="logistics" className="mt-3">
        <div className="mb-2 text-sm text-muted-foreground">
          Waybill No.: <span className="font-mono">{p.tracking_number}</span>
        </div>
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-mono text-sm">{p.tracking_number}</div>
            {p.has_pod && (
              <Badge variant="outline" className="border-primary/40 text-primary">
                POD
              </Badge>
            )}
          </div>
          <ol className="space-y-4 border-l-2 border-primary/30 pl-4">
            {result.timeline.map((e, i) => (
              <li key={e.id} className="relative">
                <span className={`absolute -left-[1.4rem] mt-1 block h-3 w-3 rounded-full border-2 ${
                  i === 0 ? "border-primary bg-primary" : "border-muted bg-background"
                }`} />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(e.created_at).toLocaleString()}</span>
                  <Badge variant="outline" className="border-primary/30 text-primary">
                    {e.status}
                  </Badge>
                </div>
                <div className="mt-1 text-sm leading-relaxed">
                  {formatTimelineLine(e, p.receiver_name)}
                </div>
                {(e.actor_name || e.site_to_name || e.site_from_name) && (
                  <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    {e.actor_name && (
                      <div>
                        Courier: <span className="font-medium text-foreground">{e.actor_name}</span>
                        {e.actor_phone && <span className="ml-1 font-mono">{e.actor_phone}</span>}
                      </div>
                    )}
                    {(e.site_from_name || e.site_to_name) && (
                      <div>
                        {e.site_from_name && <>From <span className="font-medium text-foreground">{e.site_from_name}</span></>}
                        {e.site_from_name && e.site_to_name && " → "}
                        {e.site_to_name && <>To <span className="font-medium text-foreground">{e.site_to_name}</span></>}
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
            {result.timeline.length === 0 && (
              <li className="text-sm text-muted-foreground">No status updates yet.</li>
            )}
          </ol>
        </Card>
      </TabsContent>

      <TabsContent value="basic" className="mt-3 space-y-3">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">📋 Basic Information</h3>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Cell label="Description" value={p.description || "—"} />
            <Cell label="Order Weight" value={`${p.weight}KG`} />
            <Cell label="Express Type" value={SERVICE_CLASS_LABEL[(p.service_class as ServiceClass) || "express"]} />
            <Cell label="COD" value={Number(p.cod_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
            <Cell label="Freight" value={Number(p.actual_freight).toLocaleString(undefined, { minimumFractionDigits: 2 })} />
            <Cell label="Settlement Type" value={SETTLEMENT_TYPE_LABEL[(p.settlement_type as SettlementType) || "cash"]} />
            <Cell label="Delivery Type" value={DELIVERY_TYPE_LABEL[(p.delivery_type as DeliveryType) || "door"]} />
            <Cell label="Goods Type" value={GOODS_TYPE_LABEL[(p.goods_type as GoodsType) || "normal"]} />
            <Cell label="Product Service" value={PRODUCT_SERVICE_LABEL[(p.product_service as ProductService) || "standard"]} />
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">↗ Shipping Info</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Cell label="Name" value={p.sender_name} />
            <Cell label="Telephone" value={p.sender_phone} />
            <div className="col-span-2">
              <Cell label="Address" value={p.sender_location} />
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-medium">📥 Receiving Information</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Cell label="Name" value={p.receiver_name} />
            <Cell label="Telephone" value={p.receiver_phone} />
            <div className="col-span-2">
              <Cell label="Address" value={p.receiver_location} />
            </div>
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function Cell({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}