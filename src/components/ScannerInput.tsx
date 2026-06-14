import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Camera, X, ScanLine } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onScan: (code: string) => void | Promise<void>;
  disabled?: boolean;
}

export function ScannerInput({ onScan, disabled }: Props) {
  const [manual, setManual] = useState("");
  const [active, setActive] = useState(false);
  const ref = useRef<Html5Qrcode | null>(null);
  const containerId = "qr-reader";

  useEffect(() => {
    return () => {
      if (ref.current) {
        ref.current.stop().catch(() => {});
        ref.current.clear();
        ref.current = null;
      }
    };
  }, []);

  const extractCode = (raw: string): string => {
    const trimmed = raw.trim();
    try {
      const url = new URL(trimmed);
      const waybill = url.searchParams.get("waybill");
      if (waybill) return waybill;
    } catch {
      // Not a URL — use as-is
    }
    return trimmed;
  };

  const start = async () => {
    try {
      setActive(true);
      await new Promise((r) => setTimeout(r, 50));
      const instance = new Html5Qrcode(containerId);
      ref.current = instance;
      await instance.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          await instance.stop();
          instance.clear();
          ref.current = null;
          setActive(false);
          await onScan(extractCode(decoded));
        },
        () => {},
      );
    } catch (e: any) {
      setActive(false);
      toast.error(e.message || "Camera unavailable. Use manual entry.");
    }
  };

  const stop = async () => {
    if (ref.current) {
      await ref.current.stop().catch(() => {});
      ref.current.clear();
      ref.current = null;
    }
    setActive(false);
  };

  const submitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manual.trim()) return;
    await onScan(extractCode(manual));
    setManual("");
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60 bg-card p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium">
          <Camera className="h-4 w-4 text-primary" /> Camera scan
        </div>
        {active ? (
          <>
            <div id={containerId} className="overflow-hidden rounded-lg bg-black" />
            <Button
              variant="outline"
              onClick={stop}
              className="mt-3 w-full"
              type="button"
            >
              <X className="mr-2 h-4 w-4" /> Stop camera
            </Button>
          </>
        ) : (
          <Button
            type="button"
            onClick={start}
            disabled={disabled}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <ScanLine className="mr-2 h-4 w-4" /> Open camera
          </Button>
        )}
      </Card>

      <Card className="border-border/60 bg-card p-4">
        <div className="mb-3 text-sm font-medium">Or enter tracking number</div>
        <form onSubmit={submitManual} className="flex gap-2">
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="ALS-YYYYMMDD-XXXX"
            disabled={disabled}
            className="font-mono"
          />
          <Button type="submit" disabled={disabled || !manual.trim()}>
            Submit
          </Button>
        </form>
      </Card>
    </div>
  );
}