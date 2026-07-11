-- =========================================================
-- 監査のミカタ STEP 5: 期限アラート（deadlines）
-- =========================================================

CREATE TYPE public.deadline_kind AS ENUM (
  '同意日',
  '交付日',
  '更新期限',
  'モニタリング'
);

CREATE TYPE public.deadline_status AS ENUM (
  'ok',
  'warning',
  'overdue',
  'done'
);

CREATE TABLE public.deadlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  subject TEXT NOT NULL,
  kind public.deadline_kind NOT NULL,
  due_date DATE NOT NULL,
  source_document_id UUID REFERENCES public.documents (id) ON DELETE SET NULL,
  source_finding_id UUID REFERENCES public.findings (id) ON DELETE SET NULL,
  status public.deadline_status NOT NULL DEFAULT 'ok',
  created_by UUID REFERENCES public.profiles (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX deadlines_org_due_idx
  ON public.deadlines (organization_id, due_date)
  WHERE deleted_at IS NULL AND status <> 'done';

CREATE INDEX deadlines_org_status_idx
  ON public.deadlines (organization_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.deadlines ENABLE ROW LEVEL SECURITY;

CREATE POLICY deadlines_select_own_org
  ON public.deadlines FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY deadlines_insert_own_org
  ON public.deadlines FOR INSERT
  WITH CHECK (
    organization_id = public.current_organization_id()
  );

CREATE POLICY deadlines_update_own_org
  ON public.deadlines FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
  );

-- 論理削除の物理削除対象に deadlines を追加
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_rows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.deadlines
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';

  DELETE FROM public.findings
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';

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
