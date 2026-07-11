-- =========================================================
-- 監査のミカタ: findings.status に later（あとで確認）を追加
-- =========================================================

ALTER TYPE public.finding_status ADD VALUE IF NOT EXISTS 'later';
