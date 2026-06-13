import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Crosshair, Check, X } from "lucide-react";
import { parseCoords, isValidLatLng } from "@/lib/geo";
import { toast } from "sonner";

export interface LocationValue {
  landmark?: string;
  lat?: number | null;
  lng?: number | null;
  map_url?: string;
}

interface Props {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  /** Visible label prefix, e.g. "Receiver" */
  label?: string;
}

/**
 * Captures landmark + lat/lng for a parcel endpoint.
 * - Paste a Google Maps link → lat/lng auto-extracted.
 * - "Use my location" button uses the browser geolocation API.
 */
export function LocationFields({ value, onChange, label }: Props) {
  const [pasting, setPasting] = useState(false);

  const setMapUrl = (url: string) => {
    const coords = parseCoords(url);
    if (coords) {
      onChange({ ...value, map_url: url, lat: coords.lat, lng: coords.lng });
    } else {
      onChange({ ...value, map_url: url });
    }
  };

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation not supported on this device");
      return;
    }
    toast.loading("Getting current location…", { id: "geo" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        toast.dismiss("geo");
        onChange({
          ...value,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          map_url:
            value.map_url ||
            `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`,
        });
        toast.success("Location captured");
      },
      (err) => {
        toast.dismiss("geo");
        toast.error(err.message || "Could not get location");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const hasCoords =
    value.lat != null &&
    value.lng != null &&
    isValidLatLng(Number(value.lat), Number(value.lng));

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" /> {label ? `${label} pin` : "Location pin"}
        </Label>
        {hasCoords ? (
          <span className="flex items-center gap-1 text-xs text-success">
            <Check className="h-3 w-3" /> Pinned
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <X className="h-3 w-3" /> No pin
          </span>
        )}
      </div>

      <div>
        <Label className="mb-1 block text-xs">Nearest building / street</Label>
        <Input
          placeholder='e.g. "Bihi Towers, Moi Avenue"'
          value={value.landmark ?? ""}
          onChange={(e) => onChange({ ...value, landmark: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="mb-1 block text-xs">Latitude</Label>
          <Input
            inputMode="decimal"
            placeholder="-1.2921"
            value={value.lat ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? null : Number(e.target.value);
              onChange({ ...value, lat: Number.isFinite(n as number) ? (n as number) : null });
            }}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs">Longitude</Label>
          <Input
            inputMode="decimal"
            placeholder="36.8219"
            value={value.lng ?? ""}
            onChange={(e) => {
              const n = e.target.value === "" ? null : Number(e.target.value);
              onChange({ ...value, lng: Number.isFinite(n as number) ? (n as number) : null });
            }}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1 block text-xs">Paste Google Maps link (auto-extract pin)</Label>
        <Input
          placeholder="https://maps.google.com/..."
          value={value.map_url ?? ""}
          onFocus={() => setPasting(true)}
          onBlur={() => setPasting(false)}
          onChange={(e) => setMapUrl(e.target.value)}
        />
        {pasting && !hasCoords && value.map_url && (
          <p className="mt-1 text-xs text-muted-foreground">
            Tip: paste the full link from Google Maps' "Share" → "Copy link".
          </p>
        )}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={useMyLocation} className="w-full">
        <Crosshair className="mr-2 h-3.5 w-3.5" /> Use my current location
      </Button>
    </div>
  );
}
