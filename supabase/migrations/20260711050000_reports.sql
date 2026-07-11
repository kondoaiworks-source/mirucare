-- =========================================================
-- 監査のミカタ STEP 6: 月次レポート（原因分析）
-- =========================================================

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  -- 対象月の1日（例: 2026-06-01）
  month DATE NOT NULL,
  summary_md TEXT NOT NULL DEFAULT '',
  risk_count INT NOT NULL DEFAULT 0 CHECK (risk_count >= 0),
  fixed_count INT NOT NULL DEFAULT 0 CHECK (fixed_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT reports_month_first_day CHECK (EXTRACT(DAY FROM month) = 1)
);

CREATE UNIQUE INDEX reports_org_month_unique
  ON public.reports (organization_id, month)
  WHERE deleted_at IS NULL;

CREATE INDEX reports_org_month_idx
  ON public.reports (organization_id, month DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 同一事業所のメンバーは閲覧可（プラン制限はアプリ側）
CREATE POLICY reports_select_own_org
  ON public.reports FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  );

-- 作成・更新は事業所管理者（運営アカウント）のみ
CREATE POLICY reports_insert_admin
  ON public.reports FOR INSERT
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.is_org_admin()
  );

CREATE POLICY reports_update_admin
  ON public.reports FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.is_org_admin()
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.is_org_admin()
  );

-- 論理削除の物理削除対象に reports を追加
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_rows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.reports
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';

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
