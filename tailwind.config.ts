import type { Config } from "tailwindcss";

/**
 * Tailwind v4 ではトークンの本体は globals.css の @theme inline に定義。
 * このファイルは content パスと補足設定の参照用として残す。
 */
const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

export default config;
