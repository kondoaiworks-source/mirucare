"use client"

import { useEffect, useId, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { HEADER_MENU_ITEMS } from "./nav-items"

export function HeaderMenu() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }

    function onPointerDown(e: MouseEvent | TouchEvent) {
      const target = e.target as Node | null
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false)
      }
    }

    document.addEventListener("keydown", onKeyDown)
    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("touchstart", onPointerDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("touchstart", onPointerDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative shrink-0 md:hidden">
      <button
        type="button"
        className="inline-flex size-11 min-h-11 min-w-11 items-center justify-center rounded-lg text-primary-dark transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={open ? "メニューを閉じる" : "メニュー"}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <X className="size-6" aria-hidden />
        ) : (
          <Menu className="size-6" aria-hidden />
        )}
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="その他のメニュー"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-background p-1.5 shadow-subtle"
        >
          {HEADER_MENU_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  isActive
                    ? "bg-primary/10 font-bold text-primary"
                    : "text-foreground hover:bg-muted/60"
                )}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
