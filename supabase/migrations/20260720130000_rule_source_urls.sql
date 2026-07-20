-- =========================================================
-- 自治体別参照URLマスタ（rule_sources 拡張）
-- - 原文URL/ファイルを正本として管理（AI要約は正本にしない）
-- - 資料カテゴリ別に分類（訪問介護・総合事業等）
-- - source_key で seed の再実行耐性を確保
-- =========================================================

-- ---- 1) カラム追加 ----
ALTER TABLE public.rule_sources
  ADD COLUMN IF NOT EXISTS source_key TEXT,
  ADD COLUMN IF NOT EXISTS service_type public.service_type
    NOT NULL DEFAULT '訪問介護'::public.service_type,
  ADD COLUMN IF NOT EXISTS material_category TEXT,
  ADD COLUMN IF NOT EXISTS parent_page_url TEXT,
  ADD COLUMN IF NOT EXISTS direct_file_url TEXT,
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_last_updated_on DATE,
  ADD COLUMN IF NOT EXISTS file_type TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS human_review_status TEXT NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS memo TEXT;

-- CHECK 制約（既存行との互換のため NULL 許容）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rule_sources_material_category_check'
  ) THEN
    ALTER TABLE public.rule_sources
      ADD CONSTRAINT rule_sources_material_category_check CHECK (
        material_category IS NULL
        OR material_category IN (
          '訪問介護',
          '総合事業訪問型',
          '事故報告',
          '過誤申立',
          '加算届',
          'サービスコード表'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rule_sources_file_type_check'
  ) THEN
    ALTER TABLE public.rule_sources
      ADD CONSTRAINT rule_sources_file_type_check CHECK (
        file_type IS NULL
        OR file_type IN ('pdf', 'html', 'doc', 'xlsx', 'zip', 'other')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rule_sources_human_review_status_check'
  ) THEN
    ALTER TABLE public.rule_sources
      ADD CONSTRAINT rule_sources_human_review_status_check CHECK (
        human_review_status IN (
          'unverified',
          'verified',
          'needs_review',
          'outdated'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rule_sources_priority_range_check'
  ) THEN
    ALTER TABLE public.rule_sources
      ADD CONSTRAINT rule_sources_priority_range_check CHECK (
        priority >= 1 AND priority <= 999
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS rule_sources_source_key_uidx
  ON public.rule_sources (source_key)
  WHERE source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS rule_sources_material_category_idx
  ON public.rule_sources (material_category)
  WHERE material_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS rule_sources_service_type_idx
  ON public.rule_sources (service_type);

CREATE INDEX IF NOT EXISTS rule_sources_human_review_idx
  ON public.rule_sources (human_review_status);

COMMENT ON COLUMN public.rule_sources.source_key IS
  'seed 用安定キー。例: JP-14-14100:訪問介護:訪問介護';
COMMENT ON COLUMN public.rule_sources.material_category IS
  '資料カテゴリ（訪問介護・総合事業訪問型・事故報告等）';
COMMENT ON COLUMN public.rule_sources.parent_page_url IS
  '親ページURL（一覧・索引ページ）。正本参照用';
COMMENT ON COLUMN public.rule_sources.direct_file_url IS
  '直接ファイルURL（PDF等）。正本参照用';
COMMENT ON COLUMN public.rule_sources.source_last_updated_on IS
  '原文資料の最終更新日（自治体サイト等に記載の日付）';
COMMENT ON COLUMN public.rule_sources.content_hash IS
  '原文ファイルのハッシュ（変更検知用。手動または将来のクロールで更新）';
COMMENT ON COLUMN public.rule_sources.human_review_status IS
  '人間確認ステータス: unverified / verified / needs_review / outdated';
COMMENT ON COLUMN public.rule_sources.last_verified_at IS
  '運営が最後にURL・内容を確認した日時';
