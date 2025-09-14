/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    domains: ["tcgplayer-cdn.tcgplayer.com"],
  },
};

module.exports = nextConfig;
