import type { Metadata } from "next"
import { Noto_Sans_JP } from "next/font/google"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"
import "./globals.css"

const notoSansJp = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-jp",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "監査のミカタ",
    template: "%s | 監査のミカタ",
  },
  description:
    "介護事業所向けAI書類Wチェック。実地指導で指摘されやすい不備を根拠付きで確認できます。",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={cn(notoSansJp.variable)}>
      <body className="min-h-dvh font-sans antialiased">
        <TooltipProvider>
          {children}
          <Toaster position="top-center" richColors closeButton />
        </TooltipProvider>
      </body>
    </html>
  )
}
