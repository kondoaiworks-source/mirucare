import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckRunner } from "@/components/features/check/check-runner"
import { FindingsResultView } from "@/components/features/check/findings-result-view"
import { ApproveFindingsButton } from "@/components/features/check/approve-findings-button"
import { ZeroFindingsComplete } from "@/components/features/check/zero-findings-complete"
import { getDocumentWithFindingsAction } from "@/app/actions/findings"
import { getCurrentProfile } from "@/app/actions/auth"
import { CHECK_UI } from "@/lib/copy/check-ui"
import { DOC_TYPE_OPTIONS } from "@/lib/documents"
import { AlertCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "チェック結果",
}

type PageProps = {
  params: { documentId: string }
}

export default async function CheckResultPage({ params }: PageProps) {
  const result = await getDocumentWithFindingsAction(params.documentId)

  if (!result.ok || !result.data) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 pb-16">
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle />
          <AlertTitle>結果を表示できませんでした</AlertTitle>
          <AlertDescription>
            {result.error ??
              "書類が見つからないか、権限がありません。書類一覧から再度お試しください。"}
          </AlertDescription>
        </Alert>
        <Button asChild size="lg">
          <Link href="/documents">書類一覧に戻る</Link>
        </Button>
      </div>
    )
  }

  const {
    document,
    findings,
    pendingReviewCount,
    allAddressed,
    setupHint,
  } = result.data
  const typeMeta = DOC_TYPE_OPTIONS.find((o) => o.value === document.doc_type)
  const profile = await getCurrentProfile()
  const isAdmin = profile?.role === "admin"

  const openFindings = findings.filter((f) => f.status === "open")
  const countForSummary = openFindings.length || findings.length

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16">
      <div>
        <p className="text-sm text-muted-foreground">
          {typeMeta?.title ?? document.doc_type} · {document.original_name}
        </p>

        {setupHint ? (
          <Alert className="mt-4 rounded-lg border-warning/40 bg-warning/10 text-foreground">
            <AlertCircle className="text-warning" />
            <AlertTitle>セットアップが必要です</AlertTitle>
            <AlertDescription className="leading-relaxed">
              {setupHint}
            </AlertDescription>
          </Alert>
        ) : null}

        {document.status === "checking" && !setupHint ? (
          <>
            <h1 className="mt-3 text-2xl font-bold text-primary-dark">
              {CHECK_UI.checking}
            </h1>
            <div className="mt-6">
              <CheckRunner documentId={document.id} />
            </div>
          </>
        ) : null}

        {document.status === "checking" && setupHint ? (
          <>
            <h1 className="mt-3 text-2xl font-bold text-primary-dark">
              チェックを開始できません
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              上記のマイグレーションを適用したあと、書類一覧から再度この書類を開いてください。
            </p>
            <Button asChild size="lg" className="mt-6">
              <Link href="/documents">書類一覧に戻る</Link>
            </Button>
          </>
        ) : null}

        {document.status !== "checking" &&
        pendingReviewCount > 0 &&
        findings.length === 0 ? (
          <>
            <h1 className="mt-3 text-2xl font-bold text-primary-dark">
              {CHECK_UI.pendingReview}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              チェックは完了しています。公開前の確認が終わるまで、指摘は表示されません。
            </p>
            {isAdmin ? (
              <div className="mt-6">
                <ApproveFindingsButton documentId={document.id} />
              </div>
            ) : null}
          </>
        ) : null}

        {document.status !== "checking" &&
        !setupHint &&
        (findings.length > 0 || pendingReviewCount === 0) ? (
          <>
            {findings.length === 0 ? (
              <>
                <h1 className="mt-3 text-3xl font-bold leading-tight text-primary-dark tabular-nums">
                  {CHECK_UI.summaryZero}
                </h1>
                <p className="mt-3 text-base leading-relaxed text-muted-foreground">
                  {CHECK_UI.summaryZeroNote}
                </p>
              </>
            ) : (
              <h1 className="mt-3 text-3xl font-bold leading-tight text-primary-dark tabular-nums">
                {CHECK_UI.summaryWithFindings(countForSummary)}
              </h1>
            )}

            {findings.length > 0 ? (
              <div className="mt-8">
                <FindingsResultView
                  documentId={document.id}
                  initialFindings={findings}
                  initialAllAddressed={allAddressed}
                />
              </div>
            ) : (
              <div className="mt-8">
                <ZeroFindingsComplete
                  documentId={document.id}
                  alreadyDone={document.status === "done"}
                />
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
