-- 判定ルールを「国・県の共通」と「市固有」に分ける。
-- コードは内部自動採番（運営は入力しない）。

CREATE SEQUENCE IF NOT EXISTS public.ai_check_rule_code_seq
  AS BIGINT
  START WITH 1
  INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.allocate_ai_check_rule_code(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  n BIGINT;
  prefix TEXT;
BEGIN
  prefix := upper(trim(COALESCE(NULLIF(p_prefix, ''), 'R')));
  prefix := regexp_replace(prefix, '[^A-Z0-9]', '', 'g');
  IF prefix = '' THEN
    prefix := 'R';
  END IF;
  n := nextval('public.ai_check_rule_code_seq');
  RETURN prefix || '-' || lpad(n::text, 6, '0');
END;
$$;

COMMENT ON FUNCTION public.allocate_ai_check_rule_code(TEXT) IS
  '判定ルールの内部コードを採番する（運営画面には出さない）';

GRANT USAGE, SELECT ON SEQUENCE public.ai_check_rule_code_seq TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.allocate_ai_check_rule_code(TEXT) TO authenticated, service_role;

ALTER TABLE public.ai_check_rules
  ADD COLUMN IF NOT EXISTS scope_kind TEXT NOT NULL DEFAULT 'shared',
  ADD COLUMN IF NOT EXISTS jurisdiction_id UUID
    REFERENCES public.rule_jurisdictions (id) ON DELETE SET NULL;

ALTER TABLE public.ai_check_rules
  DROP CONSTRAINT IF EXISTS ai_check_rules_scope_kind_chk;

ALTER TABLE public.ai_check_rules
  ADD CONSTRAINT ai_check_rules_scope_kind_chk
  CHECK (scope_kind IN ('shared', 'city'));

ALTER TABLE public.ai_check_rules
  DROP CONSTRAINT IF EXISTS ai_check_rules_city_jurisdiction_chk;

ALTER TABLE public.ai_check_rules
  ADD CONSTRAINT ai_check_rules_city_jurisdiction_chk
  CHECK (
    (scope_kind = 'shared' AND jurisdiction_id IS NULL)
    OR (scope_kind = 'city' AND jurisdiction_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS ai_check_rules_scope_idx
  ON public.ai_check_rules (scope_kind, jurisdiction_id);

COMMENT ON COLUMN public.ai_check_rules.scope_kind IS
  'shared=国・県で承認した共通ルール。city=市区町村固有';
COMMENT ON COLUMN public.ai_check_rules.jurisdiction_id IS
  'city のとき必須（その市の rule_jurisdictions）。shared は NULL';
COMMENT ON COLUMN public.ai_check_rules.code IS
  '内部自動採番。運営画面では入力・表示しない';

-- 既存ルール：市の資料・根拠から推定できるものだけ市固有へ。残りは共通。
WITH latest_ver AS (
  SELECT DISTINCT ON (v.rule_id)
    v.rule_id,
    v.check_logic,
    v.change_summary,
    v.knowledge_change_draft_id
  FROM public.ai_check_rule_versions v
  ORDER BY v.rule_id, v.version_no DESC
),
hints AS (
  SELECT
    lv.rule_id,
    COALESCE(
      kd.region_name,
      lv.check_logic #>> '{evidence,regionName}',
      lv.change_summary
    ) AS region_hint,
    COALESCE(
      kd.jurisdiction_level,
      lv.check_logic #>> '{evidence,jurisdictionLevel}'
    ) AS level_hint
  FROM latest_ver lv
  LEFT JOIN public.knowledge_document_change_drafts d
    ON d.id = lv.knowledge_change_draft_id
  LEFT JOIN public.knowledge_documents kd
    ON kd.id = d.knowledge_document_id
),
matched AS (
  SELECT DISTINCT ON (h.rule_id)
    h.rule_id,
    j.id AS jurisdiction_id
  FROM hints h
  JOIN public.rule_jurisdictions j
    ON j.level = 'municipality'
    AND COALESCE(j.municipality_name, j.name) IS NOT NULL
    AND (
      h.region_hint ILIKE '%' || COALESCE(j.municipality_name, j.name) || '%'
    )
  WHERE
    h.level_hint IN ('市区町村', 'municipality')
    OR (
      h.level_hint IS NULL
      AND h.region_hint IS NOT NULL
      AND h.region_hint NOT ILIKE '%県%'
      AND h.region_hint NOT ILIKE '%国%'
    )
  ORDER BY h.rule_id, j.sort_order
)
UPDATE public.ai_check_rules r
SET
  scope_kind = 'city',
  jurisdiction_id = m.jurisdiction_id
FROM matched m
WHERE r.id = m.rule_id;
