import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.200'],   // allow requests from your PC's IP
  experimental: {
    ppr: 'incremental',
  },
  async rewrites() {
    return [
      {
        source: "/reservation-confirmed",
        destination: "/shopper/orders/reservation-confirmed",
      },
    ];
  },
};

export default nextConfig;