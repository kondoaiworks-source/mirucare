-- =========================================================
-- 監査のミカタ STEP 4: AIチェック結果（findings）+ 操作ログ
-- =========================================================

CREATE TYPE public.finding_severity AS ENUM ('high', 'mid', 'low');
CREATE TYPE public.finding_status AS ENUM ('open', 'fixed', 'dismissed');
CREATE TYPE public.finding_review_status AS ENUM ('pending', 'approved');
CREATE TYPE public.finding_action_type AS ENUM (
  'fixed',
  'later',
  'dismissed',
  'reopened'
);

-- 人間レビューをスキップするか（開発・デモでは true 推奨）
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS skip_finding_review BOOLEAN NOT NULL DEFAULT true;

-- =========================================================
-- findings（指摘）
-- =========================================================
CREATE TABLE public.findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  severity public.finding_severity NOT NULL DEFAULT 'mid',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  basis TEXT,
  suggestion TEXT,
  status public.finding_status NOT NULL DEFAULT 'open',
  review_status public.finding_review_status NOT NULL DEFAULT 'pending',
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX findings_document_idx
  ON public.findings (document_id)
  WHERE deleted_at IS NULL;

CREATE INDEX findings_org_status_idx
  ON public.findings (organization_id, status, review_status)
  WHERE deleted_at IS NULL;

ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;

-- ユーザーには承認済みのみ表示（運営確認前は見せない）
CREATE POLICY findings_select_approved_own_org
  ON public.findings FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND review_status = 'approved'
  );

-- 更新は自事業所の承認済み指摘のみ（対応ステータス変更）
CREATE POLICY findings_update_own_org
  ON public.findings FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND review_status = 'approved'
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
  );

-- INSERT はサービスロール経由（API）を想定。ユーザー直接INSERTは不可。

-- =========================================================
-- finding_action_logs（対応操作ログ → 月次レポート集計用）
-- =========================================================
CREATE TABLE public.finding_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES public.findings (id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  actor_id UUID NOT NULL REFERENCES public.profiles (id),
  action public.finding_action_type NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX finding_action_logs_org_created_idx
  ON public.finding_action_logs (organization_id, created_at DESC);

CREATE INDEX finding_action_logs_finding_idx
  ON public.finding_action_logs (finding_id, created_at DESC);

ALTER TABLE public.finding_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY finding_action_logs_select_own_org
  ON public.finding_action_logs FOR SELECT
  USING (organization_id = public.current_organization_id());

CREATE POLICY finding_action_logs_insert_own_org
  ON public.finding_action_logs FOR INSERT
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND actor_id = auth.uid()
  );

-- =========================================================
-- finding_feedback（「これは違うと思う」→ ナレッジ改善用）
-- =========================================================
CREATE TABLE public.finding_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES public.findings (id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  actor_id UUID NOT NULL REFERENCES public.profiles (id),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX finding_feedback_org_created_idx
  ON public.finding_feedback (organization_id, created_at DESC);

ALTER TABLE public.finding_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY finding_feedback_select_own_org
  ON public.finding_feedback FOR SELECT
  USING (organization_id = public.current_organization_id());

CREATE POLICY finding_feedback_insert_own_org
  ON public.finding_feedback FOR INSERT
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND actor_id = auth.uid()
  );

-- 論理削除の物理削除対象に findings を追加
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_rows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
