import { defineConfig } from "vite";

export default defineConfig({
  base: "/EAIDS/",
  server: { fs: { allow: [".."] } },
  build: { target: "es2020", assetsInlineLimit: 0 },
});
