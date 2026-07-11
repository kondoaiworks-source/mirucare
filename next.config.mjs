/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["heic-convert", "pdf-parse"],
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
