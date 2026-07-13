-- documents の論理削除を RLS でも確実に許可する
-- （UPDATE USING は削除前行、WITH CHECK は削除後行を評価）

DROP POLICY IF EXISTS documents_update_own_org ON public.documents;

CREATE POLICY documents_update_own_org
  ON public.documents FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (
    organization_id = public.current_organization_id()
    AND (
      -- 通常更新（未削除のまま）
      deleted_at IS NULL
      -- または論理削除
      OR deleted_at IS NOT NULL
    )
  );

COMMENT ON POLICY documents_update_own_org ON public.documents IS
  '自事業所の書類更新。論理削除（deleted_at 設定）も許可';
