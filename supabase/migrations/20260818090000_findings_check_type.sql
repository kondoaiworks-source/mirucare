-- =========================================================
-- 指摘の分類（書類同士の整合性 / ルール適合）と適用ルール追跡
-- 旧データは NULL（画面は「分類未設定」）
-- =========================================================

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS check_type TEXT,
  ADD COLUMN IF NOT EXISTS rule_code TEXT,
  ADD COLUMN IF NOT EXISTS rule_version_id TEXT,
  ADD COLUMN IF NOT EXISTS rule_title TEXT,
  ADD COLUMN IF NOT EXISTS rule_version_no INT,
  ADD COLUMN IF NOT EXISTS audit_item TEXT,
  ADD COLUMN IF NOT EXISTS finding_check_as_of DATE,
  ADD COLUMN IF NOT EXISTS check_meta JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.findings
  DROP CONSTRAINT IF EXISTS findings_check_type_check;

ALTER TABLE public.findings
  ADD CONSTRAINT findings_check_type_check
  CHECK (check_type IS NULL OR check_type IN ('consistency', 'rule'));

COMMENT ON COLUMN public.findings.check_type IS
  'consistency=書類・CSV同士の不整合 / rule=適用ルールまたは根拠資料 / NULL=旧データ（未分類）';
COMMENT ON COLUMN public.findings.rule_code IS
  'check_type=rule のとき、根拠にしたルールコード';
COMMENT ON COLUMN public.findings.check_meta IS
  '比較内容など。個人名は入れない。将来のチェック項目単位メタ用';

CREATE INDEX IF NOT EXISTS findings_check_type_idx
  ON public.findings (organization_id, check_type)
  WHERE deleted_at IS NULL;
