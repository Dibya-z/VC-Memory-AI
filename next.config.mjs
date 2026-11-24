/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the CommonJS PDF parser on the server rather than bundling it.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
