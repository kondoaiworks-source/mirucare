"use client"

import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { REPORT_UI } from "@/lib/reports"

type PdfDownloadButtonProps = {
  disabled?: boolean
}

/**
 * ブラウザの印刷ダイアログで「PDFに保存」→ A4縦の印刷向け出力。
 * @media print でレポート本体のみを表示する。
 */
export function PdfDownloadButton({ disabled }: PdfDownloadButtonProps) {
  return (
    <div className="no-print">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full sm:w-auto"
        disabled={disabled}
        onClick={() => window.print()}
      >
        <Download className="size-5" aria-hidden />
        {REPORT_UI.pdfDownload}
      </Button>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {REPORT_UI.pdfHint}
      </p>
    </div>
  )
}
