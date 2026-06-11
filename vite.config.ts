import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const BASE_PATH = env.VITE_BASE_PATH ?? "/transit";

  return {
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
  };
});
