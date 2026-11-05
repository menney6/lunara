import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* All health data is read live from SQLite behind cookie-based auth, so every
     route is rendered on demand — caching layers would only add staleness here. */
  cacheComponents: false,
  partialPrefetching: false,
  /* Pin the workspace root: a sibling project in the parent directory also has
     a package-lock.json, which Turbopack would otherwise pick up as the root.
     npm scripts run from this package, so cwd is the project directory. */
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
