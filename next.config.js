/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: "dist",
  serverExternalPackages: ["better-sqlite3"],
};

module.exports = nextConfig;
