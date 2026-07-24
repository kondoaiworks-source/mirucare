-- 原本の3層リテンション（Phase1）
-- 既定: 監査完了後すぐ削除 / オプション: 最大7日保持

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS keep_original_days INTEGER NOT NULL DEFAULT 0
    CHECK (keep_original_days IN (0, 7)),
  ADD COLUMN IF NOT EXISTS retention_consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_purge_after TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS original_purged_at TIMESTAMPTZ;

COMMENT ON COLUMN public.documents.keep_original_days IS
  '原本保持日数。0=監査完了後すぐ削除、7=最大7日（同意時のみ）';
COMMENT ON COLUMN public.documents.retention_consent_at IS
  '原本保持ポリシーへの同意日時';
COMMENT ON COLUMN public.documents.original_purge_after IS
  '原本ファイルの削除予定時刻（UTC）。経過後に Cron / 完了処理で削除';
COMMENT ON COLUMN public.documents.original_purged_at IS
  'Storage から原本を削除した日時。NULL=未削除';

CREATE INDEX IF NOT EXISTS documents_original_purge_idx
  ON public.documents (original_purge_after)
  WHERE original_purged_at IS NULL
    AND deleted_at IS NULL
    AND file_path IS NOT NULL
    AND file_path <> '';
