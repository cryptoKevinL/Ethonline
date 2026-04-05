import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim();

  const server: {
    host: string;
    port: number;
    proxy?: Record<string, { target: string; changeOrigin: boolean }>;
  } = {
    host: "::",
    port: 8080,
  };

  // Only proxy when set — otherwise Vite would always call 127.0.0.1:3000 and throw ECONNREFUSED
  // if you are not running `vercel dev` there. To split dev: run `vercel dev` (e.g. :3000) and set
  // VITE_API_PROXY_TARGET=http://127.0.0.1:3000 in .env.local
  if (apiProxyTarget) {
    server.proxy = {
      "/api/mydata": { target: apiProxyTarget, changeOrigin: true },
      "/mydata": { target: apiProxyTarget, changeOrigin: true },
    };
  }

  return {
    server,
    plugins: [
      react(),
      nodePolyfills({
        // Whether to polyfill `node:` protocol imports.
        protocolImports: true,
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "process.env": {},
      global: "globalThis",
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
  };
});