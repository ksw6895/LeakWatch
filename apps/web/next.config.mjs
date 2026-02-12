/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['@shopify/polaris'],
  },
  async rewrites() {
    return [
      {
        source: '/v1/:path*',
        destination: 'http://localhost:4000/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
