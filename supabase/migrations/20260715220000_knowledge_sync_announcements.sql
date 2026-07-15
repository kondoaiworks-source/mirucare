-- ナレッジ自動収集（PDF直リンク監視）＋運営アラート＋アプリお知らせ

ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS content_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_status TEXT
    CHECK (
      last_sync_status IS NULL
      OR last_sync_status IN ('ok', 'unchanged', 'failed', 'suspicious')
    ),
  ADD COLUMN IF NOT EXISTS last_error TEXT;

COMMENT ON COLUMN public.knowledge_documents.source_url IS
  '監視する公式PDFの直リンク（第1弾の自動収集対象）';
COMMENT ON COLUMN public.knowledge_documents.content_hash IS
  '取得したPDF本体のSHA-256（変更検知用）';
COMMENT ON COLUMN public.knowledge_documents.last_sync_status IS
  '直近の定期同期結果: ok / unchanged / failed / suspicious';

CREATE INDEX IF NOT EXISTS knowledge_documents_source_url_idx
  ON public.knowledge_documents (id)
  WHERE source_url IS NOT NULL AND status = 'active';

-- 自動収集の失敗・疑い（運営の要対応キュー）
CREATE TABLE IF NOT EXISTS public.knowledge_sync_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_document_id UUID REFERENCES public.knowledge_documents (id)
    ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('failed', 'suspicious')),
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS knowledge_sync_alerts_open_idx
  ON public.knowledge_sync_alerts (created_at DESC)
  WHERE status = 'open';

ALTER TABLE public.knowledge_sync_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_sync_alerts_select_operator
  ON public.knowledge_sync_alerts;
DROP POLICY IF EXISTS knowledge_sync_alerts_update_operator
  ON public.knowledge_sync_alerts;
DROP POLICY IF EXISTS knowledge_sync_alerts_insert_operator
  ON public.knowledge_sync_alerts;

CREATE POLICY knowledge_sync_alerts_select_operator
  ON public.knowledge_sync_alerts
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

CREATE POLICY knowledge_sync_alerts_update_operator
  ON public.knowledge_sync_alerts
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());

-- INSERT は cron（service role）またはオペレータ手動同期から
CREATE POLICY knowledge_sync_alerts_insert_operator
  ON public.knowledge_sync_alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_operator());

COMMENT ON TABLE public.knowledge_sync_alerts IS
  'ナレッジ自動収集の失敗・疑い。運営が確認して resolved にする。';

-- 施設ユーザー向けお知らせ（最新3件表示用）
CREATE TABLE IF NOT EXISTS public.app_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'knowledge_update'
    CHECK (kind IN ('knowledge_update', 'general')),
  knowledge_document_id UUID REFERENCES public.knowledge_documents (id)
    ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_announcements_created_at_idx
  ON public.app_announcements (created_at DESC);

ALTER TABLE public.app_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_announcements_select_authenticated
  ON public.app_announcements;
DROP POLICY IF EXISTS app_announcements_insert_operator
  ON public.app_announcements;

CREATE POLICY app_announcements_select_authenticated
  ON public.app_announcements
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY app_announcements_insert_operator
  ON public.app_announcements
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_operator());

COMMENT ON TABLE public.app_announcements IS
  'アプリ内お知らせ。ナレッジ更新成功時などに投稿。ダッシュボードで最新3件を表示。';
