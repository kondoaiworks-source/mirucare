-- 下書き作成時の、国／県／市ごとの公式資料抽出結果
ALTER TABLE public.rulebook_compose_jobs
  ADD COLUMN IF NOT EXISTS extraction_notes jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.rulebook_compose_jobs.extraction_notes IS
  '国・県・市の公式資料から観点を出した結果（了承画面に出す）';
