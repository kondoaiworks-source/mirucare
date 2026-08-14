-- チェック領域マスタと、サービス×領域×自治体のルールブック下書き。
-- 「全て」は行にしない（運用中領域のまとめ選択）。

CREATE TABLE IF NOT EXISTS public.rule_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  keywords TEXT[] NOT NULL DEFAULT '{}'::text[],
  template_categories TEXT[] NOT NULL DEFAULT '{}'::text[],
  template_codes TEXT[] NOT NULL DEFAULT '{}'::text[],
  sort_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rule_domains_slug_unique UNIQUE (slug),
  CONSTRAINT rule_domains_slug_format CHECK (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    AND char_length(slug) BETWEEN 2 AND 48
  )
);

CREATE INDEX IF NOT EXISTS rule_domains_status_idx
  ON public.rule_domains (status, sort_order);

COMMENT ON TABLE public.rule_domains IS
  'チェック領域マスタ。生成画面の選択軸。全ては仮想選択肢';
COMMENT ON COLUMN public.rule_domains.slug IS
  '内部キー。作成後は変更しない';
COMMENT ON COLUMN public.rule_domains.is_system IS
  'true=初期領域。削除不可（停止は可）';
COMMENT ON COLUMN public.rule_domains.status IS
  'active=運用中。retired=停止（新規生成の選択肢から外す）';

DROP TRIGGER IF EXISTS rule_domains_set_updated_at ON public.rule_domains;
CREATE TRIGGER rule_domains_set_updated_at
  BEFORE UPDATE ON public.rule_domains
  FOR EACH ROW EXECUTE FUNCTION public.set_rule_engine_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_rule_domain_slug_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'rule_domains.slug is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rule_domains_slug_immutable ON public.rule_domains;
CREATE TRIGGER rule_domains_slug_immutable
  BEFORE UPDATE ON public.rule_domains
  FOR EACH ROW EXECUTE FUNCTION public.prevent_rule_domain_slug_change();

ALTER TABLE public.ai_check_rules
  ADD COLUMN IF NOT EXISTS domain_id UUID
    REFERENCES public.rule_domains (id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS ai_check_rules_domain_idx
  ON public.ai_check_rules (domain_id);

COMMENT ON COLUMN public.ai_check_rules.domain_id IS
  '所属するチェック領域。ルールブック生成の軸';

CREATE TABLE IF NOT EXISTS public.rulebook_compose_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type public.service_type NOT NULL,
  domain_id UUID
    REFERENCES public.rule_domains (id) ON DELETE SET NULL,
  domain_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  jurisdiction_id UUID NOT NULL
    REFERENCES public.rule_jurisdictions (id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'confirmed', 'discarded')),
  created_by UUID,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rulebook_compose_jobs_open_idx
  ON public.rulebook_compose_jobs (service_type, jurisdiction_id, status);

COMMENT ON TABLE public.rulebook_compose_jobs IS
  'サービス×領域×市のルールブック下書き。確定するまでチェックに使わない';
COMMENT ON COLUMN public.rulebook_compose_jobs.domain_id IS
  '単一領域のときそのID。全て選択は NULL で domain_ids に実体';

DROP TRIGGER IF EXISTS rulebook_compose_jobs_set_updated_at
  ON public.rulebook_compose_jobs;
CREATE TRIGGER rulebook_compose_jobs_set_updated_at
  BEFORE UPDATE ON public.rulebook_compose_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_rule_engine_updated_at();

CREATE TABLE IF NOT EXISTS public.rulebook_compose_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL
    REFERENCES public.rulebook_compose_jobs (id) ON DELETE CASCADE,
  rule_id UUID NOT NULL
    REFERENCES public.ai_check_rules (id) ON DELETE CASCADE,
  domain_id UUID
    REFERENCES public.rule_domains (id) ON DELETE SET NULL,
  origin TEXT NOT NULL
    CHECK (origin IN ('existing', 'template', 'manual')),
  included BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rulebook_compose_items_job_rule_uidx UNIQUE (job_id, rule_id)
);

CREATE INDEX IF NOT EXISTS rulebook_compose_items_job_idx
  ON public.rulebook_compose_items (job_id);

COMMENT ON TABLE public.rulebook_compose_items IS
  '下書きルールブックの1行。人が外す・追加してから確定する';

ALTER TABLE public.rule_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rulebook_compose_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rulebook_compose_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rule_domains_select_operator ON public.rule_domains;
DROP POLICY IF EXISTS rule_domains_insert_operator ON public.rule_domains;
DROP POLICY IF EXISTS rule_domains_update_operator ON public.rule_domains;
DROP POLICY IF EXISTS rule_domains_delete_operator ON public.rule_domains;

CREATE POLICY rule_domains_select_operator
  ON public.rule_domains FOR SELECT TO authenticated
  USING (public.is_platform_operator());
CREATE POLICY rule_domains_insert_operator
  ON public.rule_domains FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rule_domains_update_operator
  ON public.rule_domains FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rule_domains_delete_operator
  ON public.rule_domains FOR DELETE TO authenticated
  USING (public.is_platform_operator());

DROP POLICY IF EXISTS rulebook_compose_jobs_select_operator
  ON public.rulebook_compose_jobs;
DROP POLICY IF EXISTS rulebook_compose_jobs_insert_operator
  ON public.rulebook_compose_jobs;
DROP POLICY IF EXISTS rulebook_compose_jobs_update_operator
  ON public.rulebook_compose_jobs;
DROP POLICY IF EXISTS rulebook_compose_jobs_delete_operator
  ON public.rulebook_compose_jobs;

CREATE POLICY rulebook_compose_jobs_select_operator
  ON public.rulebook_compose_jobs FOR SELECT TO authenticated
  USING (public.is_platform_operator());
CREATE POLICY rulebook_compose_jobs_insert_operator
  ON public.rulebook_compose_jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rulebook_compose_jobs_update_operator
  ON public.rulebook_compose_jobs FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rulebook_compose_jobs_delete_operator
  ON public.rulebook_compose_jobs FOR DELETE TO authenticated
  USING (public.is_platform_operator());

DROP POLICY IF EXISTS rulebook_compose_items_select_operator
  ON public.rulebook_compose_items;
DROP POLICY IF EXISTS rulebook_compose_items_insert_operator
  ON public.rulebook_compose_items;
DROP POLICY IF EXISTS rulebook_compose_items_update_operator
  ON public.rulebook_compose_items;
DROP POLICY IF EXISTS rulebook_compose_items_delete_operator
  ON public.rulebook_compose_items;

CREATE POLICY rulebook_compose_items_select_operator
  ON public.rulebook_compose_items FOR SELECT TO authenticated
  USING (public.is_platform_operator());
CREATE POLICY rulebook_compose_items_insert_operator
  ON public.rulebook_compose_items FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rulebook_compose_items_update_operator
  ON public.rulebook_compose_items FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rulebook_compose_items_delete_operator
  ON public.rulebook_compose_items FOR DELETE TO authenticated
  USING (public.is_platform_operator());

INSERT INTO public.rule_domains (
  slug,
  title,
  description,
  keywords,
  template_categories,
  template_codes,
  sort_order,
  status,
  is_system
)
VALUES
  (
    'staffing',
    '人員基準',
    '常勤換算・管理者・サービス提供責任者・資格など、配置の基準をご確認ください。',
    ARRAY['人員','常勤換算','配置','管理者','サービス提供責任者','資格','勤務形態']::text[],
    ARRAY['人員']::text[],
    ARRAY[
      'HC_GOV_STAFFING_STANDARDS',
      'HC_GOV_MANAGER_PLACEMENT',
      'HC_GOV_SERVICE_RESPONSIBLE_PERSON',
      'HC_GOV_WORK_PATTERN_LIST',
      'HC_GOV_QUALIFICATION_CERT',
      'HC_GOV_EMPLOYMENT_CONTRACT',
      'HC_GOV_TRAINING_RECORD'
    ]::text[],
    10,
    'active',
    true
  ),
  (
    'shift-table',
    '勤務表',
    'シフト・勤務表と提供記録の担当・時間の食い違いをご確認ください。',
    ARRAY['勤務表','シフト','勤務形態一覧']::text[],
    ARRAY[]::text[],
    ARRAY[
      'HC_GOV_WORK_PATTERN_LIST',
      'HC_PLAN_ASSIGNEE',
      'HC_RECORD_SERVICE_DATETIME'
    ]::text[],
    20,
    'active',
    true
  ),
  (
    'addition-reduction',
    '加算・減算',
    '加算の算定要件と、減算につながりやすい記録・体制の抜けをご確認ください。',
    ARRAY['加算','減算','特定事業所','処遇改善','初回加算','緊急時']::text[],
    ARRAY['加算']::text[],
    ARRAY['HC_BILLING_ADDITION_EVIDENCE']::text[],
    30,
    'active',
    true
  ),
  (
    'billing',
    '請求要件',
    '請求と実績・提供記録の一致、請求漏れ・過誤の可能性をご確認ください。',
    ARRAY['請求','国保連','実績','過誤','報酬']::text[],
    ARRAY['請求']::text[],
    ARRAY[]::text[],
    40,
    'active',
    true
  )
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  keywords = EXCLUDED.keywords,
  template_categories = EXCLUDED.template_categories,
  template_codes = EXCLUDED.template_codes,
  sort_order = EXCLUDED.sort_order,
  is_system = true;

-- 既存ルール：コードまたはタイトルから領域を推定（先に並んだ領域を優先）
WITH ranked AS (
  SELECT
    r.id AS rule_id,
    d.id AS domain_id,
    ROW_NUMBER() OVER (PARTITION BY r.id ORDER BY d.sort_order, d.slug) AS rn
  FROM public.ai_check_rules r
  JOIN public.rule_domains d ON (
    r.code = ANY (d.template_codes)
    OR EXISTS (
      SELECT 1
      FROM unnest(d.keywords) AS kw
      WHERE kw <> ''
        AND r.title ILIKE '%' || kw || '%'
    )
  )
  WHERE r.domain_id IS NULL
)
UPDATE public.ai_check_rules r
SET domain_id = ranked.domain_id
FROM ranked
WHERE r.id = ranked.rule_id
  AND ranked.rn = 1;
