/**
 * チェック結果画面の文言セット（断定表現禁止）
 * 「違反です」「不正です」等はここに置かないこと。
 */

export const CHECK_UI = {
  summaryWithFindings: (count: number) =>
    `気になる点が ${count}件 ありました`,
  summaryWithFindingsNote:
    "断定ではありません。「〜の可能性」としてご確認ください。未アップロードや読めない箇所は未検証です。最終判断・提出は貴施設の責任で行ってください。",
  summaryZero: "今回は気になる点は見つかりませんでした",
  summaryZeroNote:
    "見落としがないことを保証するものではありません。未検証の範囲が残っている可能性があります。最終判断・提出は貴施設の責任で行ってください。",
  summaryFallback:
    "AIが確認できませんでした。運営が確認します",
  summaryFallbackBody:
    "自動チェックの結果をうまく読み取れませんでした。運営側で内容を確認し、必要に応じてご連絡します。お手数ですが、書類の内容もあわせてご確認ください。",
  summaryUnreadable: "画像のため確認できませんでした",
  summaryUnreadableBody:
    "書類が画像（スキャンPDFなど）として扱われ、本文を十分に読み取れなかった可能性があります。文字の入ったPDF・CSVでの再アップロードか、画像が鮮明かご確認ください。",
  pendingReview:
    "運営が結果を確認しています。公開までしばらくお待ちください。",
  checking: "書類を確認しています。完了まで少々お待ちください。",
  checkingHint: "通常は数分以内に結果が表示されます。",
  basisLabel: "根拠",
  appliedRulesTitle: "このチェックで使った基準",
  appliedRulesHint: (count: number, truncated: boolean) =>
    truncated
      ? `基準日時点の承認済みルール版を参照しています（表示は先頭 ${count}件。件数が多いため一部のみ）。断定ではありません。`
      : count > 0
        ? `基準日時点の承認済みルール版 ${count}件を参照しています。AIの指摘根拠とあわせてご確認ください。`
        : "基準日は記録されていますが、承認済みルール版の参照はありませんでした。未設定の範囲は未検証です。",
  appliedRulesEmpty:
    "承認済みのAI判定ルールがまだないか、この書類種別に該当するものがありませんでした。",
  appliedRulesMissing:
    "この書類には、まだ適用ルール版の記録がありません（再チェック後に表示されます）。最終判断は貴施設の責任で行ってください。",
  regulatoryBasisLabel: "参照した行政資料（タイトル）",
  suggestionLabel: "修正の参考案",
  actionFixed: "対応した",
  actionLater: "あとで",
  actionDismiss: "これは違うと思う",
  actionFixedDone: "「対応した」にしました",
  actionLaterDone: "あとで確認に移しました。「あとで確認」メニューから一覧できます",
  actionDismissDone: "「違う指摘だった」として記録しました",
  copySuggestion: "参考案をコピーする",
  copied: "コピーしました",
  completeTitle: "今日のWチェックが完了しました",
  completeBody:
    "指摘への対応記録が残りました。月次レポートで振り返ることができます。合否や返還は保証しません。",
  backToList: "書類一覧に戻る",
  sectionOpen: "これから確認",
  sectionLater: "あとで確認",
  sectionDismissed: "違う指摘だった",
  sectionFixed: "対応した",
  sectionLaterHint: "一覧は「あとで確認」メニューからも見られます",
  statusLater: "あとで確認",
  statusDismissed: "違う指摘だった",
  statusDismissedHint: "AIの指摘が当てはまらないと判断",
  statusFixed: "対応した",
  statusFixedHint: "書類を直した／確認した",
  remainingLabel: (open: number, later: number, total: number) =>
    `これから確認 ${open}件 · あとで ${later}件 / 全${total}件`,
  laterListTitle: "あとで確認",
  laterListDescription:
    "「あとで」を押した指摘がここに集まります。時間のあるときに結果画面から対応できます。",
  laterListEmptyTitle: "あとで確認の指摘はありません",
  laterListEmptyDescription:
    "チェック結果で「あとで」を押すと、ここに入ります。",
  laterListOpenResult: "結果を開く",
  severityHigh: "高",
  severityMid: "中",
  severityLow: "低",
  severityHighHint: "優先してご確認ください",
  severityMidHint: "確認をおすすめします",
  severityLowHint: "参考としてご確認ください",
} as const

/** 専門用語の短い補足 */
export const TERM_GLOSSARY: Record<string, string> = {
  実地指導: "行政が事業所を訪れて書類などを確認すること（運営指導）",
  運営指導: "行政が事業所を訪れて書類などを確認すること",
  加算: "基本報酬に上乗せされる料金の項目",
  常勤換算: "職員の人数の数え方（パートも含めた換算）",
  同意: "利用者・家族の署名や同意の記録",
  個別援助計画: "利用者ごとの支援内容を書いた計画書",
}

/**
 * 本文中の用語に補足を付ける（簡易：既知用語を括弧補足）
 */
export function annotateTerms(text: string): string {
  let result = text
  for (const [term, gloss] of Object.entries(TERM_GLOSSARY)) {
    if (!result.includes(term)) continue
    // すでに補足付きならスキップ
    if (result.includes(`${term}（`)) continue
    result = result.replaceAll(term, `${term}（${gloss}）`)
  }
  return result
}

/** 断定表現の簡易チェック（開発・テスト用） */
export const FORBIDDEN_ASSERTIONS = [
  "違反です",
  "不正です",
  "違法です",
  "必ず返還",
  "確定で指摘",
  "全自動で防ぐ",
  "返還を防ぐ",
  "返還を保証",
] as const

export function containsForbiddenAssertion(text: string): boolean {
  return FORBIDDEN_ASSERTIONS.some((w) => text.includes(w))
}
