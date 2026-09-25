import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site moved from tims-music.vercel.app; send old links to the new address.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "tims-music.vercel.app" }],
        destination: "https://myechochamber.vercel.app/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
