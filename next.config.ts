import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` rejects the HMR WebSocket from any host other than localhost,
  // and without it the dev runtime never loads the orbit chunk, so a phone on
  // the local network stays on the spinner. These cover the private IPv4 ranges;
  // the wildcard cannot express 172.16–31, so it allows all of 172.*.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // Only the Docker build (Dockerfile) sets NEXT_STANDALONE: its image runs
  // the traced server in .next/standalone instead of `next start` over the
  // whole node_modules. Everywhere else `next start` serves the build (the
  // e2e tests), and Next warns that it does not work with standalone output.
  ...(process.env.NEXT_STANDALONE ? { output: "standalone" as const } : {}),
  reactCompiler: true,
  // Every internal href is checked against the app's routes (lib/routes.ts).
  typedRoutes: true,
  // The lesson lived at /aprende before its URL named the law.
  redirects() {
    return Promise.resolve([
      {
        source: "/aprende/:path*",
        destination: "/ley-gravitacion-universal-newton/:path*",
        permanent: true,
      },
    ]);
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
