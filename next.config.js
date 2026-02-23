/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@google/generative-ai'],
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

module.exports = nextConfig;
