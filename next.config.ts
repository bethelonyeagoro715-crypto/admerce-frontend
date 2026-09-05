import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.0.200'],
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