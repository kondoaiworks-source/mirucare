import { ShieldAlert } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PRODUCT_CHARTER } from "@/lib/copy/product-charter"
import { cn } from "@/lib/utils"

type ProductCharterBannerProps = {
  className?: string
  /** 追加の一文（例：未検証範囲の注意） */
  extra?: string
  compact?: boolean
}

/**
 * 施設向け画面に憲章の一文を明示する。
 */
export function ProductCharterBanner({
  className,
  extra,
  compact = false,
}: ProductCharterBannerProps) {
  return (
    <Alert
      className={cn(
        "rounded-xl border-primary/20 bg-primary/[0.03]",
        className
      )}
    >
      <ShieldAlert className="text-primary" aria-hidden />
      <AlertTitle className="text-primary-dark">
        {PRODUCT_CHARTER.positionTitle}
      </AlertTitle>
      <AlertDescription
        className={cn(
          "leading-relaxed text-foreground/80",
          compact ? "text-sm" : "text-base"
        )}
      >
        <p>{PRODUCT_CHARTER.positionShort}</p>
        <p className="mt-1">{PRODUCT_CHARTER.facilityJudgment}</p>
        {extra ? <p className="mt-2 text-muted-foreground">{extra}</p> : null}
      </AlertDescription>
    </Alert>
  )
}
