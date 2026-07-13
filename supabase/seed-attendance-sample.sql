-- 開発用サンプル（organization_id を自事業所IDに置き換えて実行）
-- 個人を特定しやすい実名は避け、テスト用ラベルにしています

-- INSERT INTO public.helpers (id, organization_id, display_name, employee_code)
-- VALUES
--   ('11111111-1111-1111-1111-111111111111', '<ORG_ID>', 'テストヘルパーA', 'H001'),
--   ('22222222-2222-2222-2222-222222222222', '<ORG_ID>', 'テストヘルパーB', 'H002');

-- -- 時間重複の例（A）
-- INSERT INTO public.service_records (
--   organization_id, helper_id, client_label, service_date, start_at, end_at
-- ) VALUES
--   ('<ORG_ID>', '11111111-1111-1111-1111-111111111111', '利用者テスト1', '2026-07-01',
--    '2026-07-01 10:00:00+09', '2026-07-01 11:00:00+09'),
--   ('<ORG_ID>', '11111111-1111-1111-1111-111111111111', '利用者テスト2', '2026-07-01',
--    '2026-07-01 10:30:00+09', '2026-07-01 11:30:00+09');

-- -- 退勤より日報終了が後の例（B）
-- INSERT INTO public.attendance (
--   organization_id, helper_id, work_date, clock_in_at, clock_out_at
-- ) VALUES
--   ('<ORG_ID>', '22222222-2222-2222-2222-222222222222', '2026-07-02',
--    '2026-07-02 09:00:00+09', '2026-07-02 18:00:00+09');

-- INSERT INTO public.service_records (
--   organization_id, helper_id, client_label, service_date, start_at, end_at
-- ) VALUES
--   ('<ORG_ID>', '22222222-2222-2222-2222-222222222222', '利用者テスト3', '2026-07-02',
--    '2026-07-02 17:00:00+09', '2026-07-02 18:30:00+09');
