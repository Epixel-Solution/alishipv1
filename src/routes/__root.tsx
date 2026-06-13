import { Outlet, createRootRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth";
import { PWARegister } from "@/components/PWARegister";
import { useEffect } from "react";
import { startOfflineQueueWatcher } from "@/lib/offline-queue";

function NotFoundComponent() {
  const path = window.location.pathname;
  let backTo: "/" | "/office" | "/admin" | "/rider" = "/";
  let backLabel = "Go home";
  if (path.startsWith("/admin")) { backTo = "/admin"; backLabel = "Back to Admin"; }
  else if (path.startsWith("/office")) { backTo = "/office"; backLabel = "Back to Office"; }
  else if (path.startsWith("/rider")) { backTo = "/rider"; backLabel = "Back to Rider"; }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-heading text-7xl font-extrabold text-primary">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <a href={backTo}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            {backLabel}
          </a>
          {backTo !== "/" && (
            <a href="/"
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent">
              Home
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  useEffect(() => {
    startOfflineQueueWatcher();
  }, []);

  return (
    <AuthProvider>
      <PWARegister />
      <Outlet />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}