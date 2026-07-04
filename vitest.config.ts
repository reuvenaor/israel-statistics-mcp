import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          include: ["src/__tests__/unit/**/*.test.ts"],
          exclude: [...configDefaults.exclude],
        },
      },
      {
        test: {
          name: "live",
          include: ["src/__tests__/live/**/*.test.ts"],
          exclude: [...configDefaults.exclude],
          // Real CBS API: generous timeouts, retries, and strictly
          // sequential execution to stay polite to the public endpoint.
          testTimeout: 30_000,
          hookTimeout: 60_000,
          retry: 2,
          fileParallelism: false,
          maxConcurrency: 1,
        },
      },
    ],
  },
})
