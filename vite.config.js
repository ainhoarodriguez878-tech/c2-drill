import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base relativa: funciona igual en GitHub Pages, Netlify o abierto en local
export default defineConfig({
  plugins: [react()],
  base: "./",
});
