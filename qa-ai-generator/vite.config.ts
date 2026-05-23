import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { createApiMiddleware } from "./server/api.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        name: "qacopilot-node-api",
        configureServer(server) {
          server.middlewares.use(createApiMiddleware(env));
        },
      },
    ],
  };
});
