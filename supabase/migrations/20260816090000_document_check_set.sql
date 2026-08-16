-- 今回一緒に上げた書類を1セットとして突合する
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS check_set_id UUID;

CREATE INDEX IF NOT EXISTS documents_check_set_idx
  ON public.documents (organization_id, check_set_id)
  WHERE deleted_at IS NULL AND check_set_id IS NOT NULL;

COMMENT ON COLUMN public.documents.check_set_id IS
  '同じアップロードでチェックを開始した書類のまとまり。書類同士の突合に使う';

ALTER TABLE public.findings
  ADD COLUMN IF NOT EXISTS source_kind TEXT NOT NULL DEFAULT 'ai';

ALTER TABLE public.findings
  DROP CONSTRAINT IF EXISTS findings_source_kind_check;

ALTER TABLE public.findings
  ADD CONSTRAINT findings_source_kind_check
  CHECK (source_kind IN ('ai', 'alignment'));

COMMENT ON COLUMN public.findings.source_kind IS
  'ai=ルールブック経由のAI指摘 / alignment=書類同士の標準観点';
