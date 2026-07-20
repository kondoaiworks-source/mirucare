-- =========================================================
-- マスタールールエンジン（第1弾：DBのみ・画面なし）
-- 法令 / 自治体ルール / 監査項目 / AI判定ルール（版管理）
-- - knowledge_*・findings・Auth・Stripe は変更しない
-- - SELECT/更新は運営オペレータのみ（施設は直接参照しない）
-- - 初期シード: 国・神奈川県・横浜/藤沢/鎌倉/逗子/茅ヶ崎 + 訪問介護セット(draft)
-- =========================================================

-- ---- 1) 管轄マスタ（全国拡張の軸）----
CREATE TABLE IF NOT EXISTS public.rule_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  level TEXT NOT NULL
    CHECK (level IN ('national', 'prefecture', 'municipality')),
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.rule_jurisdictions (id) ON DELETE RESTRICT,
  prefecture_name TEXT,
  municipality_name TEXT,
  is_supported BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rule_jurisdictions_code_unique UNIQUE (code),
  CONSTRAINT rule_jurisdictions_parent_level CHECK (
    (level = 'national' AND parent_id IS NULL)
    OR (level <> 'national' AND parent_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS rule_jurisdictions_parent_idx
  ON public.rule_jurisdictions (parent_id);
CREATE INDEX IF NOT EXISTS rule_jurisdictions_municipality_name_idx
  ON public.rule_jurisdictions (municipality_name)
  WHERE municipality_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS rule_jurisdictions_supported_idx
  ON public.rule_jurisdictions (is_supported)
  WHERE is_supported = true;

COMMENT ON TABLE public.rule_jurisdictions IS
  'ルール適用の管轄マスタ（国/都道府県/市区町村）。全国対応は行追加で拡張する';
COMMENT ON COLUMN public.rule_jurisdictions.code IS
  '安定キー。例: JP / JP-14 / JP-14-14100';
COMMENT ON COLUMN public.rule_jurisdictions.is_supported IS
  'プロダクトとしてチェック対象にしているか。第1弾は湘南5市相当を true';
COMMENT ON COLUMN public.rule_jurisdictions.municipality_name IS
  'organizations.municipality との照合用（例: 横浜市）';

-- ---- 2) 根拠ソース（メタ。本文は knowledge_* 側）----
CREATE TABLE IF NOT EXISTS public.rule_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL
    REFERENCES public.rule_jurisdictions (id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  source_kind TEXT NOT NULL
    CHECK (source_kind IN ('law', 'notification', 'manual', 'other')),
  official_url TEXT,
  knowledge_document_id UUID
    REFERENCES public.knowledge_documents (id) ON DELETE SET NULL,
  published_on DATE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rule_sources_jurisdiction_idx
  ON public.rule_sources (jurisdiction_id);
CREATE INDEX IF NOT EXISTS rule_sources_knowledge_doc_idx
  ON public.rule_sources (knowledge_document_id)
  WHERE knowledge_document_id IS NOT NULL;

COMMENT ON TABLE public.rule_sources IS
  '法令・通知・マニュアル根拠のメタ。PDF本文は knowledge_documents 側で管理';

-- ---- 3) 適用セット ----
CREATE TABLE IF NOT EXISTS public.rule_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID NOT NULL
    REFERENCES public.rule_jurisdictions (id) ON DELETE RESTRICT,
  service_type public.service_type NOT NULL DEFAULT '訪問介護',
  title TEXT NOT NULL,
  fiscal_year INT
    CHECK (fiscal_year IS NULL OR (fiscal_year >= 2000 AND fiscal_year <= 2100)),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'retired')),
  effective_from DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rule_sets_effective_range CHECK (
    effective_to IS NULL
    OR effective_from IS NULL
    OR effective_to >= effective_from
  )
);

-- fiscal_year が NULL の重複を避けるため、COALESCE で一意化
CREATE UNIQUE INDEX IF NOT EXISTS rule_sets_jurisdiction_service_year_uidx
  ON public.rule_sets (
    jurisdiction_id,
    service_type,
    COALESCE(fiscal_year, 0)
  );

CREATE INDEX IF NOT EXISTS rule_sets_jurisdiction_idx
  ON public.rule_sets (jurisdiction_id);
CREATE INDEX IF NOT EXISTS rule_sets_status_idx
  ON public.rule_sets (status);

COMMENT ON TABLE public.rule_sets IS
  '管轄×サービス種別×年度のルール束。監査項目・判定ルールの親';

-- ---- 4) 監査項目 ----
CREATE TABLE IF NOT EXISTS public.audit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_set_id UUID NOT NULL
    REFERENCES public.rule_sets (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'その他'
    CHECK (category IN (
      '契約', '計画', '記録', '人員', '加算', '請求', 'その他'
    )),
  risk_level TEXT NOT NULL DEFAULT 'mid'
    CHECK (risk_level IN ('high', 'mid', 'low')),
  sort_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired')),
  source_id UUID
    REFERENCES public.rule_sources (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_items_set_code_unique UNIQUE (rule_set_id, code)
);

CREATE INDEX IF NOT EXISTS audit_items_rule_set_idx
  ON public.audit_items (rule_set_id, sort_order);

COMMENT ON TABLE public.audit_items IS
  '監査官が実際に確認する項目（構造化）。AI判定ルールの親';

-- ---- 5) AI判定ルール（ヘッダ）----
CREATE TABLE IF NOT EXISTS public.ai_check_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_item_id UUID NOT NULL
    REFERENCES public.audit_items (id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  target_doc_types TEXT[] NOT NULL DEFAULT '{}'::text[],
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_check_rules_item_code_unique UNIQUE (audit_item_id, code)
);

CREATE INDEX IF NOT EXISTS ai_check_rules_audit_item_idx
  ON public.ai_check_rules (audit_item_id);

COMMENT ON TABLE public.ai_check_rules IS
  'AI判定ルールの論理ID。具体内容は ai_check_rule_versions で版管理';
COMMENT ON COLUMN public.ai_check_rules.target_doc_types IS
  '対象書類種別（documents.doc_type 等）。空配列は未指定';

-- ---- 6) AI判定ルール版 ----
CREATE TABLE IF NOT EXISTS public.ai_check_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL
    REFERENCES public.ai_check_rules (id) ON DELETE CASCADE,
  version_no INT NOT NULL CHECK (version_no >= 1),
  check_logic JSONB NOT NULL DEFAULT '{}'::jsonb,
  guidance_text TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'mid'
    CHECK (severity IN ('high', 'mid', 'low')),
  effective_from DATE NOT NULL,
  effective_to DATE,
  review_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (review_status IN (
      'draft', 'pending_review', 'approved', 'rejected'
    )),
  reviewed_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  change_summary TEXT,
  knowledge_change_draft_id UUID
    REFERENCES public.knowledge_document_change_drafts (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_check_rule_versions_rule_ver_unique UNIQUE (rule_id, version_no),
  CONSTRAINT ai_check_rule_versions_effective_range CHECK (
    effective_to IS NULL OR effective_to >= effective_from
  ),
  CONSTRAINT ai_check_rule_versions_review_consistency CHECK (
    (review_status IN ('draft', 'pending_review')
      AND reviewed_by IS NULL
      AND reviewed_at IS NULL)
    OR (review_status IN ('approved', 'rejected')
      AND reviewed_by IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND review_reason IS NOT NULL
      AND btrim(review_reason) <> '')
  )
);

CREATE INDEX IF NOT EXISTS ai_check_rule_versions_rule_idx
  ON public.ai_check_rule_versions (rule_id, version_no DESC);
CREATE INDEX IF NOT EXISTS ai_check_rule_versions_effective_idx
  ON public.ai_check_rule_versions (effective_from, effective_to)
  WHERE review_status = 'approved';
CREATE INDEX IF NOT EXISTS ai_check_rule_versions_pending_idx
  ON public.ai_check_rule_versions (created_at DESC)
  WHERE review_status = 'pending_review';

COMMENT ON TABLE public.ai_check_rule_versions IS
  'AI判定ルールの版。上書きせず version_no を増やす。承認後に適用日で有効化';
COMMENT ON COLUMN public.ai_check_rule_versions.check_logic IS
  '判定条件JSON。第1弾はヒューリスティック指示。将来機械照合を拡張';
COMMENT ON COLUMN public.ai_check_rule_versions.knowledge_change_draft_id IS
  'Step3差分ドラフトとの任意紐づけ（法改正トリガー追跡用）';

-- ---- 7) updated_at トリガ ----
CREATE OR REPLACE FUNCTION public.set_rule_engine_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rule_jurisdictions_set_updated_at ON public.rule_jurisdictions;
CREATE TRIGGER rule_jurisdictions_set_updated_at
  BEFORE UPDATE ON public.rule_jurisdictions
  FOR EACH ROW EXECUTE FUNCTION public.set_rule_engine_updated_at();

DROP TRIGGER IF EXISTS rule_sources_set_updated_at ON public.rule_sources;
CREATE TRIGGER rule_sources_set_updated_at
  BEFORE UPDATE ON public.rule_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_rule_engine_updated_at();

DROP TRIGGER IF EXISTS rule_sets_set_updated_at ON public.rule_sets;
CREATE TRIGGER rule_sets_set_updated_at
  BEFORE UPDATE ON public.rule_sets
  FOR EACH ROW EXECUTE FUNCTION public.set_rule_engine_updated_at();

DROP TRIGGER IF EXISTS audit_items_set_updated_at ON public.audit_items;
CREATE TRIGGER audit_items_set_updated_at
  BEFORE UPDATE ON public.audit_items
  FOR EACH ROW EXECUTE FUNCTION public.set_rule_engine_updated_at();

DROP TRIGGER IF EXISTS ai_check_rules_set_updated_at ON public.ai_check_rules;
CREATE TRIGGER ai_check_rules_set_updated_at
  BEFORE UPDATE ON public.ai_check_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_rule_engine_updated_at();

-- ---- 8) RLS（運営のみ）----
ALTER TABLE public.rule_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_check_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_check_rule_versions ENABLE ROW LEVEL SECURITY;

-- jurisdictions
DROP POLICY IF EXISTS rule_jurisdictions_select_operator ON public.rule_jurisdictions;
DROP POLICY IF EXISTS rule_jurisdictions_insert_operator ON public.rule_jurisdictions;
DROP POLICY IF EXISTS rule_jurisdictions_update_operator ON public.rule_jurisdictions;
DROP POLICY IF EXISTS rule_jurisdictions_delete_operator ON public.rule_jurisdictions;

CREATE POLICY rule_jurisdictions_select_operator
  ON public.rule_jurisdictions FOR SELECT TO authenticated
  USING (public.is_platform_operator());
CREATE POLICY rule_jurisdictions_insert_operator
  ON public.rule_jurisdictions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rule_jurisdictions_update_operator
  ON public.rule_jurisdictions FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rule_jurisdictions_delete_operator
  ON public.rule_jurisdictions FOR DELETE TO authenticated
  USING (public.is_platform_operator());

-- sources
DROP POLICY IF EXISTS rule_sources_select_operator ON public.rule_sources;
DROP POLICY IF EXISTS rule_sources_insert_operator ON public.rule_sources;
DROP POLICY IF EXISTS rule_sources_update_operator ON public.rule_sources;
DROP POLICY IF EXISTS rule_sources_delete_operator ON public.rule_sources;

CREATE POLICY rule_sources_select_operator
  ON public.rule_sources FOR SELECT TO authenticated
  USING (public.is_platform_operator());
CREATE POLICY rule_sources_insert_operator
  ON public.rule_sources FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rule_sources_update_operator
  ON public.rule_sources FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rule_sources_delete_operator
  ON public.rule_sources FOR DELETE TO authenticated
  USING (public.is_platform_operator());

-- sets
DROP POLICY IF EXISTS rule_sets_select_operator ON public.rule_sets;
DROP POLICY IF EXISTS rule_sets_insert_operator ON public.rule_sets;
DROP POLICY IF EXISTS rule_sets_update_operator ON public.rule_sets;
DROP POLICY IF EXISTS rule_sets_delete_operator ON public.rule_sets;

CREATE POLICY rule_sets_select_operator
  ON public.rule_sets FOR SELECT TO authenticated
  USING (public.is_platform_operator());
CREATE POLICY rule_sets_insert_operator
  ON public.rule_sets FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rule_sets_update_operator
  ON public.rule_sets FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
CREATE POLICY rule_sets_delete_operator
  ON public.rule_sets FOR DELETE TO authenticated
  USING (public.is_platform_operator());

-- audit_items
DROP POLICY IF EXISTS audit_items_select_operator ON public.audit_items;
DROP POLICY IF EXISTS audit_items_insert_operator ON public.audit_items;
DROP POLICY IF EXISTS audit_items_update_operator ON public.audit_items;
DROP POLICY IF EXISTS audit_items_delete_operator ON public.audit_items;

CREATE POLICY audit_items_select_operator
  ON public.audit_items FOR SELECT TO authenticated
  USING (public.is_platform_operator());
CREATE POLICY audit_items_insert_operator
  ON public.audit_items FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());
CREATE POLICY audit_items_update_operator
  ON public.audit_items FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
CREATE POLICY audit_items_delete_operator
  ON public.audit_items FOR DELETE TO authenticated
  USING (public.is_platform_operator());

-- ai_check_rules
DROP POLICY IF EXISTS ai_check_rules_select_operator ON public.ai_check_rules;
DROP POLICY IF EXISTS ai_check_rules_insert_operator ON public.ai_check_rules;
DROP POLICY IF EXISTS ai_check_rules_update_operator ON public.ai_check_rules;
DROP POLICY IF EXISTS ai_check_rules_delete_operator ON public.ai_check_rules;

CREATE POLICY ai_check_rules_select_operator
  ON public.ai_check_rules FOR SELECT TO authenticated
  USING (public.is_platform_operator());
CREATE POLICY ai_check_rules_insert_operator
  ON public.ai_check_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());
CREATE POLICY ai_check_rules_update_operator
  ON public.ai_check_rules FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
CREATE POLICY ai_check_rules_delete_operator
  ON public.ai_check_rules FOR DELETE TO authenticated
  USING (public.is_platform_operator());

-- versions
DROP POLICY IF EXISTS ai_check_rule_versions_select_operator
  ON public.ai_check_rule_versions;
DROP POLICY IF EXISTS ai_check_rule_versions_insert_operator
  ON public.ai_check_rule_versions;
DROP POLICY IF EXISTS ai_check_rule_versions_update_operator
  ON public.ai_check_rule_versions;
DROP POLICY IF EXISTS ai_check_rule_versions_delete_operator
  ON public.ai_check_rule_versions;

CREATE POLICY ai_check_rule_versions_select_operator
  ON public.ai_check_rule_versions FOR SELECT TO authenticated
  USING (public.is_platform_operator());
CREATE POLICY ai_check_rule_versions_insert_operator
  ON public.ai_check_rule_versions FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());
CREATE POLICY ai_check_rule_versions_update_operator
  ON public.ai_check_rule_versions FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());
CREATE POLICY ai_check_rule_versions_delete_operator
  ON public.ai_check_rule_versions FOR DELETE TO authenticated
  USING (public.is_platform_operator());

-- ---- 9) 初期シード（再実行耐性: code で UPSERT）----
INSERT INTO public.rule_jurisdictions (
  code, level, name, parent_id, prefecture_name, municipality_name,
  is_supported, sort_order
) VALUES (
  'JP', 'national', '日本', NULL, NULL, NULL, true, 0
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = now();

INSERT INTO public.rule_jurisdictions (
  code, level, name, parent_id, prefecture_name, municipality_name,
  is_supported, sort_order
)
SELECT
  'JP-14',
  'prefecture',
  '神奈川県',
  j.id,
  '神奈川県',
  NULL,
  true,
  14
FROM public.rule_jurisdictions j
WHERE j.code = 'JP'
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  prefecture_name = EXCLUDED.prefecture_name,
  updated_at = now();

-- 市町村（地方公共団体コードベース）
INSERT INTO public.rule_jurisdictions (
  code, level, name, parent_id, prefecture_name, municipality_name,
  is_supported, sort_order
)
SELECT v.code, 'municipality', v.name, p.id, '神奈川県', v.name, true, v.sort_order
FROM public.rule_jurisdictions p
CROSS JOIN (
  VALUES
    ('JP-14-14100', '横浜市', 14100),
    ('JP-14-14205', '藤沢市', 14205),
    ('JP-14-14204', '鎌倉市', 14204),
    ('JP-14-14208', '逗子市', 14208),
    ('JP-14-14207', '茅ヶ崎市', 14207)
) AS v(code, name, sort_order)
WHERE p.code = 'JP-14'
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  municipality_name = EXCLUDED.municipality_name,
  is_supported = true,
  updated_at = now();

-- 5市 × 訪問介護 の draft セット（監査項目は空＝コンテンツは後続）
INSERT INTO public.rule_sets (
  jurisdiction_id, service_type, title, fiscal_year, status
)
SELECT
  j.id,
  '訪問介護'::public.service_type,
  j.name || ' 訪問介護 運営指導チェックセット',
  2026,
  'draft'
FROM public.rule_jurisdictions j
WHERE j.code IN (
  'JP-14-14100',
  'JP-14-14205',
  'JP-14-14204',
  'JP-14-14208',
  'JP-14-14207'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.rule_sets rs
  WHERE rs.jurisdiction_id = j.id
    AND rs.service_type = '訪問介護'::public.service_type
    AND rs.fiscal_year IS NOT DISTINCT FROM 2026
);
