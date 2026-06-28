import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, homeForRole } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PublicShell } from "@/components/PublicShell";
import { Search, Truck, Shield, Clock, MapPin, PackageCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [waybill, setWaybill] = useState("");

  useEffect(() => {
    if (loading) return;
    if (user && role) navigate({ to: homeForRole(role), replace: true });
  }, [user, role, loading, navigate]);

  // Show spinner while auth resolves or redirect is pending — prevents
  // landing page from flashing under the dashboard on slow Android phones
  if (loading || (user && role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const onTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const t = waybill.trim();
    if (!t) return;
    navigate({ to: "/track", search: { waybill: t } as any });
  };

  return (
    <PublicShell>
      <section className="relative overflow-hidden bg-zinc-950 text-zinc-50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_color-mix(in_oklab,_var(--primary)_30%,_transparent),_transparent_60%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              Trusted parcel delivery
            </span>
            <h1 className="mt-4 font-heading text-4xl font-extrabold leading-tight md:text-6xl">
              Sorted. <span className="text-primary">Shipped.</span> Simple.
            </h1>
            <p className="mt-4 max-w-lg text-zinc-300">
              Aliship Logistics moves your parcels across Kenya — same-day pickups, real-time tracking, and proof of delivery on every drop.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/about">
                <Button variant="outline" className="border-zinc-700 bg-transparent text-zinc-100 hover:bg-zinc-900">
                  Learn about us
                </Button>
              </Link>
              <Link to="/login">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Staff sign in
                </Button>
              </Link>
            </div>
          </div>
          <Card className="border-zinc-800 bg-zinc-900/80 p-6 text-zinc-50 backdrop-blur">
            <h2 className="text-xl font-semibold">Track your parcel</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Enter the waybill / tracking number to see live status.
            </p>
            <form onSubmit={onTrack} className="mt-4 flex gap-2">
              <Input
                value={waybill}
                onChange={(e) => setWaybill(e.target.value)}
                placeholder="e.g. ALS-20260506-1234"
                className="border-zinc-700 bg-zinc-950 text-zinc-50 placeholder:text-zinc-500"
              />
              <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Search className="mr-1 h-4 w-4" /> Track
              </Button>
            </form>
            <p className="mt-3 text-xs text-zinc-500">
              Anyone with a waybill number can track. No account required.
            </p>
          </Card>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-heading text-3xl font-bold">Why Aliship</h2>
          <p className="mx-auto mt-2 max-w-xl text-center text-muted-foreground">
            Built for retailers, businesses, and individuals who need parcels to just arrive — on time, every time.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Truck, title: "Door-to-door", text: "Pickups from your location, delivered straight to the recipient." },
              { icon: Clock, title: "Same-day options", text: "Express service available for urgent shipments within Nairobi." },
              { icon: Shield, title: "Secure handling", text: "Every parcel scanned at every stage with proof of delivery." },
              { icon: MapPin, title: "Live tracking", text: "Customers track in real time using only the waybill number." },
            ].map((f) => (
              <Card key={f.title} className="border-border/60 p-5">
                <f.icon className="h-6 w-6 text-primary" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-zinc-950 py-16 text-zinc-100">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center font-heading text-3xl font-bold">How it works</h2>
          <ol className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
            {[
              { n: "01", t: "Book", d: "Request a pickup from our office or via WhatsApp." },
              { n: "02", t: "Scan", d: "We pick up, scan, and bag your parcel for the route." },
              { n: "03", t: "Track & deliver", d: "Recipient gets WhatsApp updates and signs on delivery." },
            ].map((s) => (
              <li key={s.n} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
                <div className="font-mono text-xs text-primary">{s.n}</div>
                <div className="mt-2 text-lg font-semibold">{s.t}</div>
                <p className="mt-1 text-sm text-zinc-400">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-primary py-12 text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-center md:flex-row md:text-left">
          <div>
            <h3 className="font-heading text-2xl font-bold">Ready to ship with us?</h3>
            <p className="text-primary-foreground/85">Talk to our team — we'll arrange pickup the same day.</p>
          </div>
          <Link to="/about">
            <Button variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10">
              <PackageCheck className="mr-2 h-4 w-4" /> Learn more
            </Button>
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
