/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "wdtsweetheart.wpengine.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "irjyhbnwelupvsxulrzm.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

module.exports = nextConfig;
