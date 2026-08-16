const pdfRuntimeAssets = [
  "./node_modules/pdf-parse/**",
  "./node_modules/pdfjs-dist/package.json",
  "./node_modules/pdfjs-dist/cmaps/**",
  "./node_modules/pdfjs-dist/standard_fonts/**",
  "./node_modules/pdfjs-dist/build/**",
  "./node_modules/pdfjs-dist/legacy/**",
  "./node_modules/@napi-rs/canvas/**",
  "./node_modules/@napi-rs/canvas-linux-x64-gnu/**",
  "./node_modules/@napi-rs/canvas-linux-x64-musl/**",
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "heic-convert",
      "pdf-parse",
      "pdfjs-dist",
      "@napi-rs/canvas",
    ],
    outputFileTracingIncludes: {
      "/*": pdfRuntimeAssets,
      "/**": pdfRuntimeAssets,
      "/admin/**": pdfRuntimeAssets,
      "/api/**": pdfRuntimeAssets,
      "/check/**": pdfRuntimeAssets,
      "/admin/rules/services/[serviceSlug]/sources": pdfRuntimeAssets,
      "/admin/rules/documents": pdfRuntimeAssets,
      "/api/cron/knowledge-sync": pdfRuntimeAssets,
      "/api/check": pdfRuntimeAssets,
    },
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
}

export default nextConfig
