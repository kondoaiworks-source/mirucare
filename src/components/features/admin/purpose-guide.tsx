import { ArrowDown, Info, ListOrdered } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PurposeGuideProps = {
  /** 「この画面で行うこと」本文（2〜3行以内） */
  purpose: string
  /** 操作手順（3〜5ステップ） */
  steps: string[]
  className?: string
}

/**
 * 目的別画面の導入カード。
 * 「ここで行うこと」＋「操作手順」を初心者向けに明示する。
 */
export function PurposeGuide({ purpose, steps, className }: PurposeGuideProps) {
  return (
    <div className={className ? `space-y-4 ${className}` : "space-y-4"}>
      <Card className="rounded-xl border-primary/20 bg-primary/[0.03] shadow-subtle">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-primary-dark">
            <Info className="size-5 shrink-0 text-primary" aria-hidden />
            この画面で行うこと
          </CardTitle>
          <CardDescription className="text-base leading-relaxed text-foreground/80">
            {purpose}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-primary-dark">
            <ListOrdered className="size-5 shrink-0 text-primary" aria-hidden />
            操作手順
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2 sm:gap-y-2">
            {steps.map((step, index) => (
              <li key={step} className="flex items-center gap-2">
                <span className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-muted px-3 py-2 text-base text-foreground">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-sm font-bold tabular-nums text-primary-dark"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  {step}
                </span>
                {index < steps.length - 1 ? (
                  <ArrowDown
                    className="size-4 shrink-0 text-muted-foreground sm:rotate-[-90deg]"
                    aria-hidden
                  />
                ) : null}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
