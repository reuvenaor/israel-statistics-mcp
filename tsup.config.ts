import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts"],
  format: ["esm"],
  sourcemap: true,
  // Server code ships to npm — keep stack traces readable
  minify: false,
  target: "node20",
  outDir: "dist",
  treeshake: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  platform: "node",
})
