-- ログインロック用 RPC が未作成の場合の補完スクリプト
-- Supabase SQL Editor でこのファイル全文を実行してください
-- （列の追加は済んでいるが lookup_login_lockout だけ欠けている状態向け）

CREATE OR REPLACE FUNCTION public.lookup_login_lockout(p_email text)
RETURNS TABLE (
  profile_id uuid,
  failed_login_attempts integer,
  lockout_until timestamptz,
  organization_id uuid,
  role public.user_role,
  is_operator boolean,
  deleted_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    p.id,
    p.failed_login_attempts,
    p.lockout_until,
    p.organization_id,
    p.role,
    coalesce(p.is_operator, false),
    p.deleted_at
  FROM auth.users u
  INNER JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = lower(btrim(p_email))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_login_lockout(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_login_lockout(text) TO service_role;

COMMENT ON FUNCTION public.lookup_login_lockout IS
  'ログイン試行用。未登録メールは0行（カウンタを持たない）';

-- 監査ログテーブルが無い場合のみ作成
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL
    CHECK (action IN (
      'login_lockout',
      'login_unlock',
      'login_success_reset',
      'login_failed'
    )),
  profile_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  email_hash TEXT,
  email_masked TEXT,
  actor_profile_id UUID REFERENCES public.profiles (id) ON DELETE SET NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_audit_log_select_operator
  ON public.auth_audit_log;

CREATE POLICY auth_audit_log_select_operator
  ON public.auth_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());
