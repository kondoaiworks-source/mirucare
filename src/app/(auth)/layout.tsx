import Link from "next/link"
import { AppFooter } from "@/components/features/layout/app-footer"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-border bg-background px-4 py-4">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            監
          </span>
          <span>
            <span className="block text-base font-bold text-primary-dark">
              監査のミカタ
            </span>
            <span className="block text-xs text-muted-foreground">
              AI書類Wチェック
            </span>
          </span>
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-8">
        {children}
      </main>
      <AppFooter />
    </div>
  )
}
