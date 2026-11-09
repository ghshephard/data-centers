/** @type {import('next').NextConfig} */
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig = {
  ...(staticExport ? { output: "export" } : {}),
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
