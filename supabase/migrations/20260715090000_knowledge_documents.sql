-- 行政マニュアル（PDF）ナレッジ台帳
-- Dify Knowledge / Dataset 連携用。事業所横断のマスタ（運営オペレータが管理）

CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_operator = true
      AND p.deleted_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO authenticated;

COMMENT ON FUNCTION public.is_platform_operator IS
  'profiles.is_operator = true の運営ユーザーかどうか（ナレッジ台帳RLS用）';

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  jurisdiction_level TEXT NOT NULL
    CHECK (jurisdiction_level IN ('国', '都道府県', '市区町村')),
  region_name TEXT,
  applicable_year INTEGER NOT NULL
    CHECK (applicable_year >= 2000 AND applicable_year <= 2100),
  dify_document_id TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_documents_region_required CHECK (
    (jurisdiction_level = '国' AND (region_name IS NULL OR btrim(region_name) = ''))
    OR (jurisdiction_level <> '国' AND region_name IS NOT NULL AND btrim(region_name) <> '')
  )
);

CREATE INDEX IF NOT EXISTS knowledge_documents_status_idx
  ON public.knowledge_documents (status);

CREATE INDEX IF NOT EXISTS knowledge_documents_jurisdiction_year_idx
  ON public.knowledge_documents (jurisdiction_level, applicable_year DESC);

CREATE INDEX IF NOT EXISTS knowledge_documents_dify_document_id_idx
  ON public.knowledge_documents (dify_document_id)
  WHERE dify_document_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_knowledge_documents_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS knowledge_documents_set_updated_at
  ON public.knowledge_documents;
CREATE TRIGGER knowledge_documents_set_updated_at
  BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.set_knowledge_documents_updated_at();

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

-- ログインユーザーは台帳を参照可（チェックエンジン／設定画面の将来拡張用）
CREATE POLICY knowledge_documents_select_authenticated
  ON public.knowledge_documents
  FOR SELECT
  TO authenticated
  USING (true);

-- 更新系は運営オペレータのみ
CREATE POLICY knowledge_documents_insert_operator
  ON public.knowledge_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_operator());

CREATE POLICY knowledge_documents_update_operator
  ON public.knowledge_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());

CREATE POLICY knowledge_documents_delete_operator
  ON public.knowledge_documents
  FOR DELETE
  TO authenticated
  USING (public.is_platform_operator());

COMMENT ON TABLE public.knowledge_documents IS
  '行政マニュアル等のナレッジ台帳。dify_document_id で Dify API と連携する。';
COMMENT ON COLUMN public.knowledge_documents.dify_document_id IS
  'Dify Knowledge / Dataset 上のドキュメントID';
COMMENT ON COLUMN public.knowledge_documents.jurisdiction_level IS
  '管轄レベル: 国 / 都道府県 / 市区町村';
COMMENT ON COLUMN public.knowledge_documents.status IS
  'active=有効 / archived=無効（アーカイブ）';
