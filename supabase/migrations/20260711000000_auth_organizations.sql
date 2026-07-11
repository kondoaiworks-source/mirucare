-- =========================================================
-- 監査のミカタ STEP 2: 認証・事業所・招待 + RLS
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
CREATE TYPE public.service_type AS ENUM ('訪問介護', '通所介護', 'その他');
CREATE TYPE public.plan_type AS ENUM ('light', 'standard', 'premium', 'none');
CREATE TYPE public.user_role AS ENUM ('admin', 'staff');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');

-- =========================================================
-- organizations（事業所）
-- =========================================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  service_type public.service_type NOT NULL DEFAULT 'その他',
  municipality TEXT, -- 市区町村（チェック基準の選択に使用）
  plan public.plan_type NOT NULL DEFAULT 'none',
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ -- 論理削除 → 30日後に物理削除
);

CREATE INDEX organizations_deleted_at_idx ON public.organizations (deleted_at)
  WHERE deleted_at IS NULL;

-- =========================================================
-- profiles（auth.users と 1:1）
-- =========================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations (id),
  display_name TEXT NOT NULL DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'staff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX profiles_organization_id_idx ON public.profiles (organization_id)
  WHERE deleted_at IS NULL;

-- =========================================================
-- invitations（招待制）
-- =========================================================
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  email TEXT NOT NULL,
  role public.user_role NOT NULL DEFAULT 'staff',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by UUID NOT NULL REFERENCES public.profiles (id),
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT invitations_email_org_unique UNIQUE (organization_id, email)
);

CREATE INDEX invitations_token_idx ON public.invitations (token)
  WHERE deleted_at IS NULL AND status = 'pending';

-- =========================================================
-- Helper: 現在ユーザーの事業所ID（RLS用）
-- SECURITY DEFINER で再帰を避ける
-- =========================================================
CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND deleted_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.profiles
  WHERE id = auth.uid()
    AND deleted_at IS NULL
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND deleted_at IS NULL
      AND role = 'admin'
      AND organization_id IS NOT NULL
  )
$$;

-- =========================================================
-- 新規ユーザー登録時に空プロファイルを作成
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', split_part(NEW.email, '@', 1), ''),
    'staff'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- organization_id の不正変更を防止（RPC からのみ許可）
CREATE OR REPLACE FUNCTION public.guard_profile_organization_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF current_setting('app.allow_org_link', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION '事業所の紐付けはオンボーディングまたは招待からのみ変更できます';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_guard_org_id
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_organization_id();

-- =========================================================
-- RLS
-- =========================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- ---- organizations ----
-- 自事業所のみ閲覧
CREATE POLICY organizations_select_own
  ON public.organizations FOR SELECT
  USING (
    deleted_at IS NULL
    AND id = public.current_organization_id()
  );

-- オンボーディング中：所属なしユーザーが新規作成可能
CREATE POLICY organizations_insert_onboarding
  ON public.organizations FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.current_organization_id() IS NULL
  );

-- admin のみ更新（論理削除含む）
CREATE POLICY organizations_update_admin
  ON public.organizations FOR UPDATE
  USING (
    id = public.current_organization_id()
    AND public.is_org_admin()
  )
  WITH CHECK (
    id = public.current_organization_id()
    AND public.is_org_admin()
  );

-- ---- profiles ----
CREATE POLICY profiles_select_same_org
  ON public.profiles FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      id = auth.uid()
      OR (
        organization_id IS NOT NULL
        AND organization_id = public.current_organization_id()
      )
    )
  );

-- 自分のプロファイル更新（display_name 等。org 紐付けは RPC 経由）
CREATE POLICY profiles_update_self
  ON public.profiles FOR UPDATE
  USING (id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (id = auth.uid());

-- admin が同僚プロファイルを更新（ロール変更等）
CREATE POLICY profiles_update_admin
  ON public.profiles FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
    AND public.is_org_admin()
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.is_org_admin()
  );

-- 招待受諾時：所属なしユーザーが自分の org を設定済みの招待経由で更新
-- （profiles_update_self でカバー）

-- INSERT はトリガー経由（service role / security definer）のみ想定
-- 念のため自分の行のみ許可
CREATE POLICY profiles_insert_self
  ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- ---- invitations ----
CREATE POLICY invitations_select_own_org
  ON public.invitations FOR SELECT
  USING (
    deleted_at IS NULL
    AND (
      organization_id = public.current_organization_id()
      OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  );

CREATE POLICY invitations_insert_admin
  ON public.invitations FOR INSERT
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND public.is_org_admin()
    AND invited_by = auth.uid()
  );

CREATE POLICY invitations_update_admin_or_invitee
  ON public.invitations FOR UPDATE
  USING (
    deleted_at IS NULL
    AND (
      (organization_id = public.current_organization_id() AND public.is_org_admin())
      OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    )
  )
  WITH CHECK (
    (
      organization_id = public.current_organization_id()
      AND public.is_org_admin()
    )
    OR lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  );

-- =========================================================
-- 論理削除から30日経過した行の物理削除（cron / 手動実行用）
-- 個人名・被保険者番号は本テーブルに含めない
-- =========================================================
CREATE OR REPLACE FUNCTION public.purge_soft_deleted_rows()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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

COMMENT ON FUNCTION public.purge_soft_deleted_rows IS
  '論理削除から30日経過した行を物理削除する。pg_cron 等で日次実行を推奨。';

-- =========================================================
-- オンボーディング完了（事業所作成 + 自分を admin で紐付け）
-- =========================================================
CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_name TEXT,
  p_service_type public.service_type,
  p_municipality TEXT DEFAULT NULL,
  p_skip_municipality BOOLEAN DEFAULT FALSE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_existing UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  SELECT organization_id INTO v_existing
  FROM public.profiles
  WHERE id = auth.uid() AND deleted_at IS NULL;

  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'すでに事業所に所属しています';
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RAISE EXCEPTION '事業所名は2文字以上で入力してください';
  END IF;

  INSERT INTO public.organizations (
    name,
    service_type,
    municipality,
    plan,
    onboarding_completed_at
  ) VALUES (
    trim(p_name),
    p_service_type,
    CASE WHEN p_skip_municipality THEN NULL ELSE NULLIF(trim(p_municipality), '') END,
    'none',
    now()
  )
  RETURNING id INTO v_org_id;

  PERFORM set_config('app.allow_org_link', 'on', true);

  UPDATE public.profiles
  SET
    organization_id = v_org_id,
    role = 'admin',
    updated_at = now()
  WHERE id = auth.uid();

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_onboarding TO authenticated;

-- =========================================================
-- 招待受諾
-- =========================================================
CREATE OR REPLACE FUNCTION public.accept_invitation(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invitations%ROWTYPE;
  v_email TEXT;
  v_existing UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  v_email := lower(COALESCE(auth.jwt() ->> 'email', ''));

  SELECT * INTO v_inv
  FROM public.invitations
  WHERE token = p_token
    AND deleted_at IS NULL
    AND status = 'pending'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION '招待リンクが無効か、有効期限切れです。招待者に再送をご依頼ください';
  END IF;

  IF lower(v_inv.email) <> v_email THEN
    RAISE EXCEPTION '招待されたメールアドレスでログインしてください。現在のログイン先と一致しません';
  END IF;

  SELECT organization_id INTO v_existing
  FROM public.profiles
  WHERE id = auth.uid() AND deleted_at IS NULL;

  IF v_existing IS NOT NULL AND v_existing <> v_inv.organization_id THEN
    RAISE EXCEPTION 'すでに別の事業所に所属しています。ログアウト後、招待メールで再度お試しください';
  END IF;

  PERFORM set_config('app.allow_org_link', 'on', true);

  UPDATE public.profiles
  SET
    organization_id = v_inv.organization_id,
    role = v_inv.role,
    updated_at = now()
  WHERE id = auth.uid();

  UPDATE public.invitations
  SET status = 'accepted'
  WHERE id = v_inv.id;

  RETURN v_inv.organization_id;
END;
$$;

REVOKE ALL ON FUNCTION public.accept_invitation FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_invitation TO authenticated;
