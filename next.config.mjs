const pdfRuntimeAssets = [
  "./node_modules/pdf-parse/**",
  "./node_modules/pdfjs-dist/package.json",
  "./node_modules/pdfjs-dist/cmaps/**",
  "./node_modules/pdfjs-dist/standard_fonts/**",
  "./node_modules/pdfjs-dist/build/**",
  "./node_modules/pdfjs-dist/legacy/**",
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
    },
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },
}

export default nextConfig
