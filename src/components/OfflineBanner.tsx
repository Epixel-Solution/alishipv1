import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

export function OfflineBanner() {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  if (online) return null;
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-destructive px-3 py-1.5 text-xs text-destructive-foreground">
      <WifiOff className="h-3.5 w-3.5" /> You're offline — actions will fail until you reconnect.
    </div>
  );
}
