import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/PublicShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Truck, Users, MapPin, Award } from "lucide-react";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <PublicShell>
      <section className="bg-zinc-950 py-16 text-zinc-50">
        <div className="mx-auto max-w-4xl px-4">
          <h1 className="font-heading text-4xl font-extrabold md:text-5xl">
            About <span className="text-primary">Aliship</span> Logistics
          </h1>
          <p className="mt-4 text-lg text-zinc-300">
            We help businesses and individuals move parcels across Kenya with confidence — every shipment scanned, tracked, and delivered with proof.
          </p>
        </div>
      </section>

      <section className="bg-background py-14">
        <div className="mx-auto grid max-w-5xl gap-6 px-4 md:grid-cols-2">
          <Card className="border-border/60 p-6">
            <h2 className="font-heading text-2xl font-bold">Our story</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Aliship Logistics was founded to simplify last-mile delivery for retailers and small businesses. We saw too many parcels lost in handoffs, customers calling for updates, and riders without tools. So we built our own tracking system from scratch — the same one you can use right now.
            </p>
          </Card>
          <Card className="border-border/60 p-6">
            <h2 className="font-heading text-2xl font-bold">What we do</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• Same-day pickup and delivery within Nairobi</li>
              <li>• Country-wide express and LTL freight</li>
              <li>• Cash on delivery (COD) reconciliation</li>
              <li>• Real-time WhatsApp updates to your customers</li>
              <li>• Proof of delivery on every drop</li>
            </ul>
          </Card>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 px-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { i: Truck, k: "10k+", v: "Parcels delivered" },
            { i: Users, k: "200+", v: "Active senders" },
            { i: MapPin, k: "47", v: "Counties served" },
            { i: Award, k: "98%", v: "On-time rate" },
          ].map((s) => (
            <Card key={s.v} className="border-border/60 p-5 text-center">
              <s.i className="mx-auto h-6 w-6 text-primary" />
              <div className="mt-2 font-heading text-3xl font-extrabold text-primary">{s.k}</div>
              <div className="text-xs text-muted-foreground">{s.v}</div>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-primary py-12 text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 text-center md:flex-row md:text-left">
          <h3 className="font-heading text-2xl font-bold">Have a parcel to track?</h3>
          <Link to="/track">
            <Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
              Track a parcel →
            </Button>
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}