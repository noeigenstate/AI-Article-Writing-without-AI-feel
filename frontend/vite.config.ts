import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The backend deliberately binds to IPv4 loopback. Using `localhost` here can
// resolve to `::1` first on Windows, which makes an otherwise healthy backend
// look offline to Vite's proxy.
const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8787";
const frontendPort = Number(process.env.FRONTEND_PORT ?? "51773");

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: frontendPort,
    strictPort: true,
    proxy: {
      "/api": backendUrl,
    },
  },
});
