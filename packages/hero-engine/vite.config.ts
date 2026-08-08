import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "HeroEngine",
      formats: ["es", "umd"],
      fileName: (format) => `hero-engine.${format}.js`,
    },
    rollupOptions: {
      external: ["three", "gsap"],
      output: {
        globals: {
          three: "THREE",
          gsap: "gsap",
        },
      },
    },
  },
  optimizeDeps: {
    include: ["three", "gsap"],
  },
});