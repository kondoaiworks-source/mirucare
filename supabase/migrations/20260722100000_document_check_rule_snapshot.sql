-- Phase C/D: チェック実行時の適用ルール版スナップショット
-- いつの基準で見たか説明できるようにする（上書き再チェック対応）

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS check_as_of DATE,
  ADD COLUMN IF NOT EXISTS applied_rule_version_ids UUID[] DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS applied_rules_snapshot JSONB;

COMMENT ON COLUMN public.documents.check_as_of IS
  'チェック実行時の基準日（いつの版で見たか）';
COMMENT ON COLUMN public.documents.applied_rule_version_ids IS
  'チェック時に Dify へ渡した承認済み ai_check_rule_versions.id の配列';
COMMENT ON COLUMN public.documents.applied_rules_snapshot IS
  '適用ルールの要約スナップショット（UI・トレーサビリティ用）';
