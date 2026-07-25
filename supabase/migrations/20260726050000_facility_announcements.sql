-- 施設向けお知らせ投稿（自事業所メンバーへ）
-- organization_id NULL = 全体（ルールブック更新など運営投稿）

ALTER TABLE public.app_announcements
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES public.organizations (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by UUID
    REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS app_announcements_org_created_idx
  ON public.app_announcements (organization_id, created_at DESC)
  WHERE organization_id IS NOT NULL;

DROP POLICY IF EXISTS app_announcements_select_authenticated
  ON public.app_announcements;
DROP POLICY IF EXISTS app_announcements_insert_operator
  ON public.app_announcements;
DROP POLICY IF EXISTS app_announcements_insert_org_admin
  ON public.app_announcements;
DROP POLICY IF EXISTS app_announcements_update_org_admin
  ON public.app_announcements;
DROP POLICY IF EXISTS app_announcements_delete_org_admin
  ON public.app_announcements;

-- 全体お知らせ OR 自事業所のお知らせ
CREATE POLICY app_announcements_select_authenticated
  ON public.app_announcements
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id = public.current_organization_id()
  );

-- 運営（全体・ルール更新など）
CREATE POLICY app_announcements_insert_operator
  ON public.app_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_operator());

-- 事業所 admin（自事業所向け general）
CREATE POLICY app_announcements_insert_org_admin
  ON public.app_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_admin()
    AND organization_id = public.current_organization_id()
    AND kind = 'general'
  );

CREATE POLICY app_announcements_update_org_admin
  ON public.app_announcements
  FOR UPDATE
  TO authenticated
  USING (
    public.is_org_admin()
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (
    public.is_org_admin()
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY app_announcements_delete_org_admin
  ON public.app_announcements
  FOR DELETE
  TO authenticated
  USING (
    public.is_org_admin()
    AND organization_id = public.current_organization_id()
  );

COMMENT ON COLUMN public.app_announcements.organization_id IS
  'NULL=全体（運営）。UUID=当該事業所メンバーのみ表示';
COMMENT ON COLUMN public.app_announcements.created_by IS
  '投稿者（profiles.id）';
