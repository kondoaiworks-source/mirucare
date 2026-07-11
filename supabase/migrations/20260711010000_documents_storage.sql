-- =========================================================
-- 監査のミカタ STEP 3: 書類アップロード + Storage
-- =========================================================

CREATE TYPE public.doc_type AS ENUM (
  'ケアプラン',
  '提供記録',
  '勤務表',
  '請求データ',
  'その他'
);

CREATE TYPE public.document_status AS ENUM (
  'uploaded',
  'checking',
  'reviewed',
  'done'
);

-- =========================================================
-- documents
-- =========================================================
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  uploaded_by UUID NOT NULL REFERENCES public.profiles (id),
  doc_type public.doc_type NOT NULL DEFAULT 'その他',
  file_path TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  status public.document_status NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX documents_org_created_idx
  ON public.documents (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX documents_status_idx
  ON public.documents (organization_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_select_own_org
  ON public.documents FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY documents_insert_own_org
  ON public.documents FOR INSERT
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND uploaded_by = auth.uid()
  );

CREATE POLICY documents_update_own_org
  ON public.documents FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
  );

-- =========================================================
-- Storage: private バケット documents
-- パス規約: {organization_id}/{document_id}/{filename}
-- =========================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  20971520, -- 20MB
  ARRAY[
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/heic-sequence',
    'image/heif-sequence'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 自事業所フォルダのみ SELECT（署名付きURL発行時に使用）
CREATE POLICY documents_storage_select
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
  );

CREATE POLICY documents_storage_insert
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
  );

CREATE POLICY documents_storage_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
  );

CREATE POLICY documents_storage_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = public.current_organization_id()::text
  );

-- 論理削除の物理削除対象に documents を追加
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_rows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.documents
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';

  DELETE FROM public.invitations
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';

  DELETE FROM public.profiles
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';

  DELETE FROM public.organizations
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';
END;
$$;
