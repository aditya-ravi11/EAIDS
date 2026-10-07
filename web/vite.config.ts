import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  base: "/EAIDS/",
  server: { fs: { allow: [".."] } },
  build: {
    target: "es2020",
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        explainer: resolve(import.meta.dirname, "explainer.html"),
      },
    },
  },
});
