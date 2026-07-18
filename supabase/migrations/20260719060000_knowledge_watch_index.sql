-- 行政マニュアル監視の拡張:
-- - watch_kind: file(PDF直リンク) / index(新着一覧ページ)
-- - 条件付きGET用 ETag / Last-Modified
-- - last_ok_at（成功専用時刻）
-- - index 用の検知済み item_key 台帳
-- - セレクタ破損アラート種別

-- ---- knowledge_documents 列追加 ----
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS watch_kind TEXT NOT NULL DEFAULT 'file',
  ADD COLUMN IF NOT EXISTS css_selector TEXT,
  ADD COLUMN IF NOT EXISTS etag TEXT,
  ADD COLUMN IF NOT EXISTS last_modified TEXT,
  ADD COLUMN IF NOT EXISTS last_ok_at TIMESTAMPTZ;

-- watch_kind 制約（再実行耐性）
ALTER TABLE public.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_watch_kind_check;
ALTER TABLE public.knowledge_documents
  ADD CONSTRAINT knowledge_documents_watch_kind_check
  CHECK (watch_kind IN ('file', 'index'));

-- index は css_selector 必須
ALTER TABLE public.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_index_selector_required;
ALTER TABLE public.knowledge_documents
  ADD CONSTRAINT knowledge_documents_index_selector_required
  CHECK (
    watch_kind <> 'index'
    OR (css_selector IS NOT NULL AND btrim(css_selector) <> '')
  );

COMMENT ON COLUMN public.knowledge_documents.watch_kind IS
  '監視方式: file=PDF直リンクの内容ハッシュ比較 / index=一覧ページの行単位差分';
COMMENT ON COLUMN public.knowledge_documents.css_selector IS
  'watch_kind=index のとき、一覧の1行を指すCSSセレクタ';
COMMENT ON COLUMN public.knowledge_documents.etag IS
  '条件付きGET用。直近レスポンスの ETag';
COMMENT ON COLUMN public.knowledge_documents.last_modified IS
  '条件付きGET用。直近レスポンスの Last-Modified';
COMMENT ON COLUMN public.knowledge_documents.last_ok_at IS
  '監視が成功した最終時刻（last_checked_at とは分離）';

-- last_sync_status に selector_broken を追加
ALTER TABLE public.knowledge_documents
  DROP CONSTRAINT IF EXISTS knowledge_documents_last_sync_status_check;
ALTER TABLE public.knowledge_documents
  ADD CONSTRAINT knowledge_documents_last_sync_status_check
  CHECK (
    last_sync_status IS NULL
    OR last_sync_status IN (
      'ok',
      'unchanged',
      'failed',
      'suspicious',
      'selector_broken'
    )
  );

-- ---- 検知済み記事キー（行単位 SHA-256）----
CREATE TABLE IF NOT EXISTS public.knowledge_watch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_document_id UUID NOT NULL
    REFERENCES public.knowledge_documents (id) ON DELETE CASCADE,
  item_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  href TEXT NOT NULL DEFAULT '',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_watch_items_doc_key_unique
    UNIQUE (knowledge_document_id, item_key)
);

CREATE INDEX IF NOT EXISTS knowledge_watch_items_doc_idx
  ON public.knowledge_watch_items (knowledge_document_id);

ALTER TABLE public.knowledge_watch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_watch_items_select_operator
  ON public.knowledge_watch_items;
DROP POLICY IF EXISTS knowledge_watch_items_insert_operator
  ON public.knowledge_watch_items;
DROP POLICY IF EXISTS knowledge_watch_items_update_operator
  ON public.knowledge_watch_items;
DROP POLICY IF EXISTS knowledge_watch_items_delete_operator
  ON public.knowledge_watch_items;

CREATE POLICY knowledge_watch_items_select_operator
  ON public.knowledge_watch_items
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

CREATE POLICY knowledge_watch_items_insert_operator
  ON public.knowledge_watch_items
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_operator());

CREATE POLICY knowledge_watch_items_update_operator
  ON public.knowledge_watch_items
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());

CREATE POLICY knowledge_watch_items_delete_operator
  ON public.knowledge_watch_items
  FOR DELETE
  TO authenticated
  USING (public.is_platform_operator());

COMMENT ON TABLE public.knowledge_watch_items IS
  'index監視で過去に検知した記事キー（title|href の SHA-256）。並び替え・削除に影響されない差分検知用。';

-- ---- アラート種別: selector_broken ----
ALTER TABLE public.knowledge_sync_alerts
  DROP CONSTRAINT IF EXISTS knowledge_sync_alerts_kind_check;
ALTER TABLE public.knowledge_sync_alerts
  ADD CONSTRAINT knowledge_sync_alerts_kind_check
  CHECK (kind IN ('failed', 'suspicious', 'selector_broken'));

COMMENT ON COLUMN public.knowledge_sync_alerts.kind IS
  'failed=取得失敗 / suspicious=内容疑い / selector_broken=一覧抽出0件（サイト改修疑い）';
