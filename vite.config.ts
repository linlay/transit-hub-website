import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BASE_PATH = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base: BASE_PATH,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/admin": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
