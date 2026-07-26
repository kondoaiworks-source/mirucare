import type { Metadata } from "next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { RiskBadge } from "@/components/features/risk-badge"
import { EmptyState } from "@/components/features/empty-state"
import { ToastDemo } from "@/components/features/styleguide/toast-demo"
import { AlertCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "スタイルガイド",
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-primary-dark">{title}</h2>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {children}
    </section>
  )
}

export default function StyleguidePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-12">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          スタイルガイド
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          「信頼のプロフェッショナル」デザインシステムの確認用ページです。色・角丸・影・フォントがトークンに従っているかを確認できます。表題は PageHeader（h1: 2xl/md:3xl・補足: text-base）、カードは SectionCard／CardTitleWithIcon（size-9 アイコン枠）、角丸は rounded-lg に揃えます。
        </p>
      </div>

      <Section
        title="カラー"
        description="primary / warning / danger / 背景のトークン一覧"
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { name: "primary", className: "bg-primary text-primary-foreground" },
            {
              name: "primary-dark",
              className: "bg-primary-dark text-primary-foreground",
            },
            {
              name: "warning",
              className: "bg-warning text-warning-foreground",
            },
            { name: "danger", className: "bg-danger text-danger-foreground" },
            {
              name: "surface",
              className: "bg-surface text-foreground border border-border",
            },
            {
              name: "background",
              className: "bg-background text-foreground border border-border",
            },
          ].map((swatch) => (
            <div
              key={swatch.name}
              className={`flex h-20 items-end rounded-lg p-3 text-sm font-medium ${swatch.className}`}
            >
              {swatch.name}
            </div>
          ))}
        </div>
      </Section>

      <Separator />

      <Section
        title="ボタン"
        description="主要導線は動詞で。タップ領域は44px以上。Tabキーでフォーカスリングを確認できます。"
      >
        <div className="flex flex-wrap gap-3">
          <Button type="button">今日の分をチェックする</Button>
          <Button type="button" variant="secondary">
            下書きを保存する
          </Button>
          <Button type="button" variant="outline">
            キャンセルする
          </Button>
          <Button type="button" variant="ghost">
            詳細を見る
          </Button>
          <Button type="button" variant="destructive">
            削除する
          </Button>
          <Button type="button" variant="link">
            ヘルプを開く
          </Button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button type="button" size="sm">
            小さいボタン
          </Button>
          <Button type="button" size="default">
            標準ボタン
          </Button>
          <Button type="button" size="lg">
            大きいボタン
          </Button>
        </div>
      </Section>

      <Separator />

      <Section
        title="リスクバッジ"
        description="色だけに頼らず、アイコン＋テキストラベルを併記します。"
      >
        <div className="flex flex-wrap gap-3">
          <RiskBadge level="high" />
          <RiskBadge level="medium" />
          <RiskBadge level="low" />
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <RiskBadge level="high" showDescription />
          <RiskBadge level="medium" showDescription />
          <RiskBadge level="low" showDescription />
        </div>
      </Section>

      <Separator />

      <Section
        title="カード"
        description="角丸12px・控えめな影。1カード1目的。"
      >
        <Card className="max-w-md rounded-lg shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">未チェックの書類</CardTitle>
            <CardDescription className="text-base leading-relaxed">
              本日アップロードされた書類のうち、まだ確認していない件数です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold tabular-nums text-primary-dark">
              12
              <span className="ml-1 text-base font-medium text-muted-foreground">
                件
              </span>
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/documents">書類を確認する</Link>
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Separator />

      <Section
        title="テーブル"
        description="チェック結果一覧の表示イメージです。"
      >
        <Card className="rounded-lg shadow-subtle">
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>書類名</TableHead>
                  <TableHead>リスク</TableHead>
                  <TableHead className="text-right">指摘候補</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">
                    訪問介護計画書_2026-07
                  </TableCell>
                  <TableCell>
                    <RiskBadge level="high" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    3
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">
                    サービス提供記録_6月
                  </TableCell>
                  <TableCell>
                    <RiskBadge level="medium" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    1
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">同意書スキャン</TableCell>
                  <TableCell>
                    <RiskBadge level="low" />
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-bold">
                    0
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Section>

      <Separator />

      <Section
        title="アラート"
        description="断定せず「可能性があります」の表現で案内します。"
      >
        <Alert className="rounded-lg">
          <AlertCircle />
          <AlertTitle>署名欄が空欄の可能性があります</AlertTitle>
          <AlertDescription>
            実地指導（運営指導）で確認されることがあります。原本をご確認ください。
          </AlertDescription>
        </Alert>
      </Section>

      <Separator />

      <Section
        title="空状態（Empty State）"
        description="データがないときの案内。次のアクションを動詞で示します。"
      >
        <EmptyState
          title="まだチェック結果がありません"
          description="書類をアップロードすると、指摘されやすい不備の可能性を確認できます。"
          action={
            <Button asChild>
              <Link href="/documents">書類をアップロードする</Link>
            </Button>
          }
        />
      </Section>

      <Separator />

      <Section
        title="トースト"
        description="操作結果のフィードバック。画面上部中央に表示されます。"
      >
        <ToastDemo />
      </Section>

      <Separator />

      <Section
        title="タイポグラフィ"
        description="Noto Sans JP・本文16px以上・行間1.6以上。数字は大きく太く（tabular-nums）。"
      >
        <div className="space-y-4 rounded-lg border border-border bg-background p-6 shadow-subtle">
          <p className="text-3xl font-bold text-primary-dark">見出し（太字）</p>
          <p className="text-base leading-relaxed text-foreground">
            本文サンプルです。常勤換算（＝職員の人数の数え方）など、専門用語には短い補足を添えます。
          </p>
          <p className="text-muted-foreground">
            補足テキスト（muted）。コントラスト比4.5:1以上を維持します。
          </p>
          <div className="flex gap-8">
            <div>
              <p className="text-sm text-muted-foreground">指摘候補</p>
              <p className="text-4xl font-bold tabular-nums text-primary-dark">
                24
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">残日数</p>
              <p className="text-4xl font-bold tabular-nums text-warning">7</p>
            </div>
          </div>
        </div>
      </Section>
    </div>
  )
}
