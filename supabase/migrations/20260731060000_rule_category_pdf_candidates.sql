-- =========================================================
-- 監査カテゴリ × 公開情報PDF（候補・採用リンク）
-- - 候補: 自動検索／手動追加 → 人が採用／不採用
-- - 採用: rule_sources へ紐付け＋台帳監視開始
-- - 不採用: 候補を削除（一覧から外す）
-- =========================================================

CREATE TABLE IF NOT EXISTS public.rule_source_category_links (
  source_id UUID NOT NULL REFERENCES public.rule_sources (id) ON DELETE CASCADE,
  audit_category_slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  PRIMARY KEY (source_id, audit_category_slug)
);

CREATE INDEX IF NOT EXISTS rule_source_category_links_slug_idx
  ON public.rule_source_category_links (audit_category_slug);

COMMENT ON TABLE public.rule_source_category_links IS
  '公開情報（rule_sources）と監査カテゴリの採用リンク';

CREATE TABLE IF NOT EXISTS public.rule_category_pdf_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type public.service_type NOT NULL DEFAULT '訪問介護'::public.service_type,
  city_slug TEXT NOT NULL,
  audit_category_slug TEXT NOT NULL,
  jurisdiction_id UUID NULL REFERENCES public.rule_jurisdictions (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  parent_page_url TEXT,
  direct_file_url TEXT,
  -- 既存の公開情報から候補化した場合
  existing_source_id UUID NULL REFERENCES public.rule_sources (id) ON DELETE SET NULL,
  discovery_method TEXT NOT NULL DEFAULT 'keyword_match'
    CHECK (discovery_method IN ('keyword_match', 'manual', 'crawl')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'adopted', 'rejected')),
  adopted_source_id UUID NULL REFERENCES public.rule_sources (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_category_pdf_candidates_lookup_idx
  ON public.rule_category_pdf_candidates (
    service_type,
    city_slug,
    audit_category_slug,
    status
  );

CREATE UNIQUE INDEX IF NOT EXISTS rule_category_pdf_candidates_active_source_uidx
  ON public.rule_category_pdf_candidates (
    service_type,
    city_slug,
    audit_category_slug,
    existing_source_id
  )
  WHERE existing_source_id IS NOT NULL
    AND status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS rule_category_pdf_candidates_active_url_uidx
  ON public.rule_category_pdf_candidates (
    service_type,
    city_slug,
    audit_category_slug,
    (coalesce(direct_file_url, parent_page_url))
  )
  WHERE existing_source_id IS NULL
    AND status = 'pending'
    AND coalesce(direct_file_url, parent_page_url) IS NOT NULL;

COMMENT ON TABLE public.rule_category_pdf_candidates IS
  '監査カテゴリ向け関連PDF候補。採用で台帳監視開始、不採用で一覧から外す';

ALTER TABLE public.rule_source_category_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_category_pdf_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rule_source_category_links_select ON public.rule_source_category_links;
CREATE POLICY rule_source_category_links_select
  ON public.rule_source_category_links
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

DROP POLICY IF EXISTS rule_source_category_links_write ON public.rule_source_category_links;
CREATE POLICY rule_source_category_links_write
  ON public.rule_source_category_links
  FOR ALL
  TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());

DROP POLICY IF EXISTS rule_category_pdf_candidates_select ON public.rule_category_pdf_candidates;
CREATE POLICY rule_category_pdf_candidates_select
  ON public.rule_category_pdf_candidates
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

DROP POLICY IF EXISTS rule_category_pdf_candidates_write ON public.rule_category_pdf_candidates;
CREATE POLICY rule_category_pdf_candidates_write
  ON public.rule_category_pdf_candidates
  FOR ALL
  TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
