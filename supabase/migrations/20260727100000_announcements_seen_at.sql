-- お知らせの既読時刻（バッジは未読件数のみ表示）

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS announcements_seen_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.announcements_seen_at IS
  'お知らせ一覧を最後に開いた時刻。これより新しい app_announcements を未読として数える。';
