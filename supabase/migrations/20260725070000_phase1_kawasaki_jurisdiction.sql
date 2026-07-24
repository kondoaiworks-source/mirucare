-- Phase1 対象市: 逗子を外し、川崎を入れる

-- 逗子: サポート対象外（レコードは履歴として残す）
UPDATE public.rule_jurisdictions
SET
  is_supported = false,
  updated_at = now()
WHERE code = 'JP-14-14208';

-- 川崎市を追加（地方公共団体コード 14130）
INSERT INTO public.rule_jurisdictions (
  code, level, name, parent_id, prefecture_name, municipality_name,
  is_supported, sort_order
)
SELECT
  'JP-14-14130',
  'municipality',
  '川崎市',
  p.id,
  '神奈川県',
  '川崎市',
  true,
  14130
FROM public.rule_jurisdictions p
WHERE p.code = 'JP-14'
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  municipality_name = EXCLUDED.municipality_name,
  is_supported = true,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

-- 川崎 × 訪問介護 の draft セット
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
WHERE j.code = 'JP-14-14130'
AND NOT EXISTS (
  SELECT 1
  FROM public.rule_sets rs
  WHERE rs.jurisdiction_id = j.id
    AND rs.service_type = '訪問介護'::public.service_type
    AND rs.fiscal_year IS NOT DISTINCT FROM 2026
);
