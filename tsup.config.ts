import { defineConfig } from "tsup"

export default defineConfig({
  clean: true,
  // tsup's dts stage injects baseUrl internally, which TypeScript 6 flags as
  // deprecated (TS5101) — silence only inside the dts build, until tsup stops
  // setting it or TS 7 removes the option.
  dts: { compilerOptions: { ignoreDeprecations: "6.0" } },
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
