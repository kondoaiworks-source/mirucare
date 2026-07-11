-- =========================================================
-- 監査のミカタ STEP 7: 運営レビューコンソール
-- =========================================================

-- 却下ステータスを追加（ユーザーには非表示のまま）
ALTER TYPE public.finding_review_status ADD VALUE IF NOT EXISTS 'rejected';

-- プラットフォーム運営フラグ（全事業所のレビューキューにアクセス可）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_operator BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS profiles_is_operator_idx
  ON public.profiles (id)
  WHERE is_operator = true AND deleted_at IS NULL;

-- 未承認キュー用インデックス
CREATE INDEX IF NOT EXISTS findings_pending_review_idx
  ON public.findings (created_at ASC)
  WHERE deleted_at IS NULL AND review_status = 'pending';

-- フィードバックへの運営対応メモ（ナレッジ改善 ToDo）
ALTER TABLE public.finding_feedback
  ADD COLUMN IF NOT EXISTS operator_note TEXT,
  ADD COLUMN IF NOT EXISTS operator_note_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES public.profiles (id);

-- =========================================================
-- finding_review_logs（レビュー処理時間の計測）
-- =========================================================
CREATE TYPE public.finding_review_action AS ENUM (
  'approved',
  'edited',
  'rejected'
);

CREATE TABLE public.finding_review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID NOT NULL REFERENCES public.findings (id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  reviewer_id UUID NOT NULL REFERENCES public.profiles (id),
  action public.finding_review_action NOT NULL,
  duration_ms INT NOT NULL CHECK (duration_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX finding_review_logs_created_idx
  ON public.finding_review_logs (created_at DESC);

CREATE INDEX finding_review_logs_reviewer_idx
  ON public.finding_review_logs (reviewer_id, created_at DESC);

ALTER TABLE public.finding_review_logs ENABLE ROW LEVEL SECURITY;

-- 運営のみ参照（アプリはサービスロールで集計。一般ユーザーは不可）
CREATE POLICY finding_review_logs_no_user_access
  ON public.finding_review_logs FOR SELECT
  USING (false);

CREATE POLICY finding_review_logs_no_user_insert
  ON public.finding_review_logs FOR INSERT
  WITH CHECK (false);
