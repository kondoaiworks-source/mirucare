/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["heic-convert", "pdf-parse", "pdfjs-dist"],
    outputFileTracingIncludes: {
      "/*": [
        "./node_modules/pdfjs-dist/cmaps/**",
        "./node_modules/pdfjs-dist/standard_fonts/**",
      ],
    },
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;
