import { defineConfig } from "vite";
import path from "node:path";

// Vite configuration specifically for building frontend assets (CSS, JS)
export default defineConfig({
  // No need for dts plugin for frontend assets
  plugins: [],
  resolve: {
    // Keep existing resolve extensions
    extensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
  },
  build: {
    // Output assets to public/assets, so they can be served statically
    outDir: path.resolve(__dirname, "public/assets"),
    sourcemap: true, // Generate sourcemaps for easier debugging
    emptyOutDir: true, // Clean the output directory before build
    // Define the frontend entry point
    lib: {
      entry: path.resolve(__dirname, "src/web/main.client.ts"), // Updated entry point
      // Use 'es' format for modern browsers
      formats: ["es"],
      // Define a fixed output filename for the JS bundle
      fileName: () => "main.js",
    },
    rollupOptions: {
      // Unlike the backend build, we DO NOT externalize frontend dependencies
      // They should be bundled into main.js
      external: [], // Ensure no dependencies are externalized
      output: {
        // Ensure CSS is output as a separate file named main.css
        assetFileNames: "main.css", // Directly name the CSS output
      },
    },
    // Target modern browsers
    target: "esnext",
    // This is NOT an SSR build
    ssr: false,
  },
  // Ensure Vite processes CSS with PostCSS (Tailwind)
  // Vite does this automatically if postcss.config.js exists,
  // but explicitly defining it can help clarity.
  css: {
    postcss: path.resolve(__dirname, "postcss.config.cjs"),
  },
});
