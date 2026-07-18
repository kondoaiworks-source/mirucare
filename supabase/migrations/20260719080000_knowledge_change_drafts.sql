-- =========================================================
-- ナレッジ差分承認フロー（Step 3）基盤スキーマ
-- - knowledge_documents.notify_emails
-- - knowledge_document_snapshots（PDF抽出テキストのメタ）
-- - knowledge_document_change_drafts（承認待ちドラフト）
-- - knowledge_document_versions（承認反映時の版履歴）
-- - Storage: private バケット knowledge-snapshots
-- =========================================================

-- ---- 1) 通知先メール（カンマ区切り）----
ALTER TABLE public.knowledge_documents
  ADD COLUMN IF NOT EXISTS notify_emails TEXT;

COMMENT ON COLUMN public.knowledge_documents.notify_emails IS
  '変更検知時の通知先（カンマ区切り）。未設定時は OPERATOR_EMAILS へフォールバック';

-- ---- 2) PDFテキスト・スナップショット（メタはDB、本文はStorage）----
CREATE TABLE IF NOT EXISTS public.knowledge_document_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_document_id UUID NOT NULL
    REFERENCES public.knowledge_documents (id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  text_bytes BIGINT NOT NULL DEFAULT 0
    CHECK (text_bytes >= 0),
  is_truncated BOOLEAN NOT NULL DEFAULT false,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_url_at_capture TEXT,
  CONSTRAINT knowledge_document_snapshots_doc_hash_unique
    UNIQUE (knowledge_document_id, content_hash)
);

CREATE INDEX IF NOT EXISTS knowledge_document_snapshots_doc_captured_idx
  ON public.knowledge_document_snapshots (knowledge_document_id, captured_at DESC);

COMMENT ON TABLE public.knowledge_document_snapshots IS
  '行政マニュアルPDFから抽出したテキストのスナップショット。本文は Storage(knowledge-snapshots) に保存';
COMMENT ON COLUMN public.knowledge_document_snapshots.storage_path IS
  'バケット内パス。例: {knowledge_document_id}/{content_hash}.txt';
COMMENT ON COLUMN public.knowledge_document_snapshots.is_truncated IS
  'ソフト上限(2MB)超過で切り詰めた場合 true。承認画面で「全文一部未取得」表示用';
COMMENT ON COLUMN public.knowledge_document_snapshots.source_url_at_capture IS
  '取得時点の source_url（後から台帳URLが変わっても追跡可能）';

ALTER TABLE public.knowledge_document_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_document_snapshots_select_operator
  ON public.knowledge_document_snapshots;
DROP POLICY IF EXISTS knowledge_document_snapshots_insert_operator
  ON public.knowledge_document_snapshots;
DROP POLICY IF EXISTS knowledge_document_snapshots_update_operator
  ON public.knowledge_document_snapshots;
DROP POLICY IF EXISTS knowledge_document_snapshots_delete_operator
  ON public.knowledge_document_snapshots;

CREATE POLICY knowledge_document_snapshots_select_operator
  ON public.knowledge_document_snapshots
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

CREATE POLICY knowledge_document_snapshots_insert_operator
  ON public.knowledge_document_snapshots
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_operator());

CREATE POLICY knowledge_document_snapshots_update_operator
  ON public.knowledge_document_snapshots
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());

CREATE POLICY knowledge_document_snapshots_delete_operator
  ON public.knowledge_document_snapshots
  FOR DELETE
  TO authenticated
  USING (public.is_platform_operator());

-- ---- 3) 承認待ちドラフト ----
CREATE TABLE IF NOT EXISTS public.knowledge_document_change_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_document_id UUID NOT NULL
    REFERENCES public.knowledge_documents (id) ON DELETE CASCADE,
  before_snapshot_id UUID
    REFERENCES public.knowledge_document_snapshots (id) ON DELETE SET NULL,
  after_snapshot_id UUID
    REFERENCES public.knowledge_document_snapshots (id) ON DELETE SET NULL,
  ai_summary TEXT,
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  quote_verified_ratio NUMERIC(4, 3)
    CHECK (
      quote_verified_ratio IS NULL
      OR (quote_verified_ratio >= 0 AND quote_verified_ratio <= 1)
    ),
  ai_organized BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_user_id UUID
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT knowledge_document_change_drafts_review_consistency CHECK (
    (status = 'pending'
      AND reviewer_user_id IS NULL
      AND reviewed_at IS NULL)
    OR (status IN ('approved', 'rejected')
      AND reviewer_user_id IS NOT NULL
      AND reviewed_at IS NOT NULL
      AND review_reason IS NOT NULL
      AND btrim(review_reason) <> '')
  )
);

CREATE INDEX IF NOT EXISTS knowledge_document_change_drafts_pending_idx
  ON public.knowledge_document_change_drafts (created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS knowledge_document_change_drafts_doc_idx
  ON public.knowledge_document_change_drafts (knowledge_document_id, created_at DESC);

COMMENT ON TABLE public.knowledge_document_change_drafts IS
  '変更検知後のAI差分整理ドラフト。運営承認後に台帳へ反映する';
COMMENT ON COLUMN public.knowledge_document_change_drafts.changes IS
  '差分配列JSON。各要素は change_type / before_text / after_text / quote_* / confidence 等';
COMMENT ON COLUMN public.knowledge_document_change_drafts.quote_verified_ratio IS
  '引用が原文に実在した割合(0.0-1.0)。1.0未満は要精査。AI整理なし時は NULL';
COMMENT ON COLUMN public.knowledge_document_change_drafts.ai_organized IS
  'true=Gemini整理済み / false=未設定・失敗時の見落とし防止ドラフト';
COMMENT ON COLUMN public.knowledge_document_change_drafts.review_reason IS
  '承認・差し戻し理由。引用未検証案件の承認では特に必須（アプリ側で厳格チェック）';

ALTER TABLE public.knowledge_document_change_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_document_change_drafts_select_operator
  ON public.knowledge_document_change_drafts;
DROP POLICY IF EXISTS knowledge_document_change_drafts_insert_operator
  ON public.knowledge_document_change_drafts;
DROP POLICY IF EXISTS knowledge_document_change_drafts_update_operator
  ON public.knowledge_document_change_drafts;
DROP POLICY IF EXISTS knowledge_document_change_drafts_delete_operator
  ON public.knowledge_document_change_drafts;

CREATE POLICY knowledge_document_change_drafts_select_operator
  ON public.knowledge_document_change_drafts
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

CREATE POLICY knowledge_document_change_drafts_insert_operator
  ON public.knowledge_document_change_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_operator());

CREATE POLICY knowledge_document_change_drafts_update_operator
  ON public.knowledge_document_change_drafts
  FOR UPDATE
  TO authenticated
  USING (public.is_platform_operator())
  WITH CHECK (public.is_platform_operator());

CREATE POLICY knowledge_document_change_drafts_delete_operator
  ON public.knowledge_document_change_drafts
  FOR DELETE
  TO authenticated
  USING (public.is_platform_operator());

-- ---- 4) 承認反映時の版履歴 ----
CREATE TABLE IF NOT EXISTS public.knowledge_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_document_id UUID NOT NULL
    REFERENCES public.knowledge_documents (id) ON DELETE CASCADE,
  draft_id UUID
    REFERENCES public.knowledge_document_change_drafts (id) ON DELETE SET NULL,
  snapshot_id UUID
    REFERENCES public.knowledge_document_snapshots (id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  source_url TEXT,
  content_hash TEXT,
  ai_summary TEXT,
  changes JSONB NOT NULL DEFAULT '[]'::jsonb,
  approved_by UUID
    REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS knowledge_document_versions_doc_idx
  ON public.knowledge_document_versions (knowledge_document_id, approved_at DESC);

COMMENT ON TABLE public.knowledge_document_versions IS
  '差分ドラフト承認時に残す版履歴。台帳本体反映の監査証跡';

ALTER TABLE public.knowledge_document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS knowledge_document_versions_select_operator
  ON public.knowledge_document_versions;
DROP POLICY IF EXISTS knowledge_document_versions_insert_operator
  ON public.knowledge_document_versions;

CREATE POLICY knowledge_document_versions_select_operator
  ON public.knowledge_document_versions
  FOR SELECT
  TO authenticated
  USING (public.is_platform_operator());

CREATE POLICY knowledge_document_versions_insert_operator
  ON public.knowledge_document_versions
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_platform_operator());

-- ---- 5) Storage: private バケット knowledge-snapshots ----
-- パス規約: {knowledge_document_id}/{content_hash}.txt
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-snapshots',
  'knowledge-snapshots',
  false,
  4194304, -- 4MB（アプリ側ソフト上限2MB切り詰め後の余裕）
  ARRAY['text/plain', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS knowledge_snapshots_storage_select_operator
  ON storage.objects;
DROP POLICY IF EXISTS knowledge_snapshots_storage_insert_operator
  ON storage.objects;
DROP POLICY IF EXISTS knowledge_snapshots_storage_update_operator
  ON storage.objects;
DROP POLICY IF EXISTS knowledge_snapshots_storage_delete_operator
  ON storage.objects;

CREATE POLICY knowledge_snapshots_storage_select_operator
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'knowledge-snapshots'
    AND public.is_platform_operator()
  );

CREATE POLICY knowledge_snapshots_storage_insert_operator
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'knowledge-snapshots'
    AND public.is_platform_operator()
  );

CREATE POLICY knowledge_snapshots_storage_update_operator
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'knowledge-snapshots'
    AND public.is_platform_operator()
  )
  WITH CHECK (
    bucket_id = 'knowledge-snapshots'
    AND public.is_platform_operator()
  );

CREATE POLICY knowledge_snapshots_storage_delete_operator
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'knowledge-snapshots'
    AND public.is_platform_operator()
  );
