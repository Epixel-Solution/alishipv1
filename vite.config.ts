import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    TanStackRouterVite(),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "Aliship Logistics",
        short_name: "Aliship",
        description: "Sorted. Shipped. Simple. — Parcel logistics & tracking.",
        theme_color: "#FF6600",
        background_color: "#1a1a1a",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api/, /^\/~oauth/],
        // Force a hard reload when a new service worker is waiting
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "html", networkTimeoutSeconds: 3 },
          },
          {
            // JS and CSS: NetworkFirst so new deploys take effect immediately
            // Falls back to cache only when offline
            urlPattern: ({ request }) =>
              ["script", "style", "worker"].includes(request.destination),
            handler: "NetworkFirst",
            options: { cacheName: "scripts", networkTimeoutSeconds: 5 },
          },
          {
            // Images and fonts: StaleWhileRevalidate is fine (they don't change logic)
            urlPattern: ({ request }) =>
              ["image", "font"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "static-assets" },
          },
        ],
      },
    }),
  ],
});
