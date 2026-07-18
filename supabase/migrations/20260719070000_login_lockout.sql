-- ログイン失敗ロックアウト（同一メール 5回で15分）
-- Auth 本体は変更せず、profiles + 監査ログでアプリ層ガードする

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lockout_until TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.failed_login_attempts IS
  '連続ログイン失敗回数。成功ログインまたは手動解除で0に戻す';
COMMENT ON COLUMN public.profiles.lockout_until IS
  'ロック解除予定時刻（UTC）。NULL=未ロック。期限切れは次回試行時に遅延クリア';

-- 一般ユーザーが自分でロック列を書き換えられないようにする
CREATE OR REPLACE FUNCTION public.protect_login_lockout_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- service_role のみ変更可（Server Action / CLI）
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    NEW.failed_login_attempts := OLD.failed_login_attempts;
    NEW.lockout_until := OLD.lockout_until;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_login_lockout ON public.profiles;
CREATE TRIGGER profiles_protect_login_lockout
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_login_lockout_columns();

-- メールからプロファイル＋ロック状態を取得（Auth の email は auth.users）
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

-- 監査ログ（ロック発生・手動解除など）
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

CREATE INDEX IF NOT EXISTS auth_audit_log_created_at_idx
  ON public.auth_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS auth_audit_log_profile_id_idx
  ON public.auth_audit_log (profile_id)
  WHERE profile_id IS NOT NULL;

ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_audit_log_select_operator
  ON public.auth_audit_log;

-- 運営のみ参照（挿入は service role）
CREATE POLICY auth_audit_log_select_operator
  ON public.auth_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

COMMENT ON TABLE public.auth_audit_log IS
  'ログインロック等の監査ログ。メールはハッシュ／マスクのみ保存';
