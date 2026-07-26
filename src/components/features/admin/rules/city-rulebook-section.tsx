import type { ReactNode } from "react"

type Props = {
  headingId: string
  icon: ReactNode
  title: string
  countLabel?: string
  description: string
  action?: ReactNode
  children?: ReactNode
}

/**
 * 市ルールブックの各大ブロック（チェックルール／新ルール判定／自治体ルール設定）の外枠。
 * 見出しサイズと余白を揃え、ひとまとまりに見えるようにする。
 */
export function CityRulebookSection({
  headingId,
  icon,
  title,
  countLabel,
  description,
  action,
  children,
}: Props) {
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-[#F6F8FA] p-5 shadow-subtle md:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h2
            id={headingId}
            className="flex flex-wrap items-center gap-2 text-xl font-bold text-primary-dark"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {icon}
            </span>
            {title}
            {countLabel ? (
              <span className="font-normal text-muted-foreground tabular-nums">
                {countLabel}
              </span>
            ) : null}
          </h2>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-4 space-y-4">{children}</div> : null}
    </section>
  )
}
