-- =========================================================
-- ルールブック提供カタログ（サービス × 自治体の公開設定）
-- - 公開中のみ新規事業所が選択可能
-- - 非公開にしても既存事業所の設定は据え置き（アプリ側で許可）
-- - 国・県の公開情報PDFは市公開の前提（アプリ側で検証）
-- =========================================================

CREATE TABLE IF NOT EXISTS public.rulebook_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_type public.service_type NOT NULL,
  jurisdiction_id UUID NOT NULL
    REFERENCES public.rule_jurisdictions (id) ON DELETE RESTRICT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  unpublished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rulebook_offerings_service_jurisdiction_uidx
    UNIQUE (service_type, jurisdiction_id)
);

CREATE INDEX IF NOT EXISTS rulebook_offerings_published_idx
  ON public.rulebook_offerings (service_type, is_published)
  WHERE is_published = true;

CREATE INDEX IF NOT EXISTS rulebook_offerings_jurisdiction_idx
  ON public.rulebook_offerings (jurisdiction_id);

COMMENT ON TABLE public.rulebook_offerings IS
  'サービス×市区町村のルールブック提供可否。公開中のみ新規施設が選択可能';
COMMENT ON COLUMN public.rulebook_offerings.is_published IS
  'true=新規登録・設定変更で選択可。falseにしても既存施設のmunicipalityは据え置き';

DROP TRIGGER IF EXISTS rulebook_offerings_set_updated_at ON public.rulebook_offerings;
CREATE TRIGGER rulebook_offerings_set_updated_at
  BEFORE UPDATE ON public.rulebook_offerings
  FOR EACH ROW EXECUTE FUNCTION public.set_rule_engine_updated_at();

ALTER TABLE public.rulebook_offerings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rulebook_offerings_select_authenticated
  ON public.rulebook_offerings;
DROP POLICY IF EXISTS rulebook_offerings_insert_operator
  ON public.rulebook_offerings;
DROP POLICY IF EXISTS rulebook_offerings_update_operator
  ON public.rulebook_offerings;
DROP POLICY IF EXISTS rulebook_offerings_delete_operator
  ON public.rulebook_offerings;

-- 公開中は全認証ユーザーが参照可（登録時の選択肢）。運営は全件参照可。
CREATE POLICY rulebook_offerings_select_authenticated
  ON public.rulebook_offerings FOR SELECT TO authenticated
  USING (
    is_published = true
    OR public.is_platform_operator()
  );

CREATE POLICY rulebook_offerings_insert_operator
  ON public.rulebook_offerings FOR INSERT TO authenticated
  WITH CHECK (public.is_platform_operator());

CREATE POLICY rulebook_offerings_update_operator
  ON public.rulebook_offerings FOR UPDATE TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());

CREATE POLICY rulebook_offerings_delete_operator
  ON public.rulebook_offerings FOR DELETE TO authenticated
  USING (public.is_platform_operator());

-- Phase1 訪問介護×5市を公開済みとして初期投入（既存オンボーディング互換）
INSERT INTO public.rulebook_offerings (
  service_type,
  jurisdiction_id,
  is_published,
  published_at
)
SELECT
  '訪問介護'::public.service_type,
  j.id,
  true,
  now()
FROM public.rule_jurisdictions j
WHERE j.level = 'municipality'
  AND j.code IN (
    'JP-14-14100', -- 横浜
    'JP-14-14130', -- 川崎
    'JP-14-14205', -- 藤沢
    'JP-14-14204', -- 鎌倉
    'JP-14-14207'  -- 茅ヶ崎
  )
ON CONFLICT (service_type, jurisdiction_id) DO UPDATE
SET
  is_published = EXCLUDED.is_published,
  published_at = COALESCE(public.rulebook_offerings.published_at, EXCLUDED.published_at),
  unpublished_at = NULL,
  updated_at = now();

-- 通所介護は行だけ用意（非公開＝利用者には出さない）
INSERT INTO public.rulebook_offerings (
  service_type,
  jurisdiction_id,
  is_published
)
SELECT
  '通所介護'::public.service_type,
  j.id,
  false
FROM public.rule_jurisdictions j
WHERE j.level = 'municipality'
  AND j.code IN (
    'JP-14-14100',
    'JP-14-14130',
    'JP-14-14205',
    'JP-14-14204',
    'JP-14-14207'
  )
ON CONFLICT (service_type, jurisdiction_id) DO NOTHING;
