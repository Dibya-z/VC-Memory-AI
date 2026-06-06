/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse is a CommonJS lib that should run only on the server (API routes),
  // never bundled into client components. (On Next 14 this lives under
  // `experimental`; it was promoted to top-level `serverExternalPackages` in 15.)
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse"],
  },
};

export default nextConfig;
