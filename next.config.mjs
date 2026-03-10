/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cricclubs.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium"],
  },
};

export default nextConfig;
