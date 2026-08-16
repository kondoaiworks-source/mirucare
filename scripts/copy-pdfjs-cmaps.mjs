/**
 * pdfjs-dist の日本語 CMap を public に置き、本番サーバーレスでも HTTP で読めるようにする。
 */
import { cpSync, existsSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const requireFromProject = createRequire(join(root, "package.json"))

function sourceDir() {
  try {
    return join(dirname(requireFromProject.resolve("pdfjs-dist/package.json")), "cmaps")
  } catch {
    return join(root, "node_modules", "pdfjs-dist", "cmaps")
  }
}

const src = sourceDir()
const dest = join(root, "public", "pdfjs", "cmaps")

if (!existsSync(src)) {
  console.warn("[copy-pdfjs-cmaps] source missing, skip")
  process.exit(0)
}

mkdirSync(join(root, "public", "pdfjs"), { recursive: true })
cpSync(src, dest, { recursive: true })
