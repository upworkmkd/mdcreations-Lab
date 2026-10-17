import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The base and battery cover STL files are read from disk when a download is built.
  outputFileTracingIncludes: {
    '/api/**': ['./private/**/*'],
  },
  poweredByHeader: false,
};

export default nextConfig;
