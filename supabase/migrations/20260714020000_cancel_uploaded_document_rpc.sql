-- 種類未設定（uploaded）書類の取り消し用 RPC
-- auth.uid() + 自事業所のみ。SECURITY DEFINER で論理削除を確実に実行

CREATE OR REPLACE FUNCTION public.cancel_uploaded_document(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_updated INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'ログインが必要です';
  END IF;

  v_org := public.current_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION '事業所情報を取得できませんでした';
  END IF;

  UPDATE public.documents
  SET deleted_at = now()
  WHERE id = p_document_id
    AND organization_id = v_org
    AND status = 'uploaded'
    AND deleted_at IS NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  IF v_updated = 0 THEN
    -- 既に削除済み／存在しない／種類未設定以外
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_uploaded_document(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_uploaded_document(UUID) TO authenticated;

COMMENT ON FUNCTION public.cancel_uploaded_document IS
  '自事業所の uploaded 書類を論理削除する。アップロード取り消しUI用。';
