/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Don't fail the production build on lint errors (handy for quick Vercel deploys).
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
