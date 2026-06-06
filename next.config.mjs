/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // pdf-parse is a CommonJS lib that should run only on the server (API routes),
  // never bundled into client components.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
