-- =========================================================
-- 監査のミカタ: 勤怠・日報・シフト + RLS
-- 事業所IDは既存の organization_id を使用（facility_id 相当）
-- 請求CSVは本スキーマに保存しない（ブラウザ完結）
-- =========================================================

-- ヘルパー（訪問介護員など）
CREATE TABLE public.helpers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  display_name TEXT NOT NULL,
  employee_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX helpers_org_idx ON public.helpers (organization_id)
  WHERE deleted_at IS NULL;

-- シフト予定
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  helper_id UUID NOT NULL REFERENCES public.helpers (id),
  work_date DATE NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT shifts_time_order CHECK (end_at > start_at)
);

CREATE INDEX shifts_org_date_idx ON public.shifts (organization_id, work_date)
  WHERE deleted_at IS NULL;
CREATE INDEX shifts_helper_date_idx ON public.shifts (helper_id, work_date)
  WHERE deleted_at IS NULL;

-- タイムカード実績
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  helper_id UUID NOT NULL REFERENCES public.helpers (id),
  work_date DATE NOT NULL,
  clock_in_at TIMESTAMPTZ NOT NULL,
  clock_out_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT attendance_time_order CHECK (clock_out_at >= clock_in_at)
);

CREATE INDEX attendance_org_date_idx ON public.attendance (organization_id, work_date)
  WHERE deleted_at IS NULL;
CREATE INDEX attendance_helper_date_idx ON public.attendance (helper_id, work_date)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX attendance_helper_date_unique
  ON public.attendance (helper_id, work_date)
  WHERE deleted_at IS NULL;

-- 現場のサービス提供記録（日報）
-- client_label: 突合用の表示名（被保険者番号は保存しない）
CREATE TABLE public.service_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations (id),
  helper_id UUID NOT NULL REFERENCES public.helpers (id),
  client_label TEXT NOT NULL,
  service_date DATE NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT service_records_time_order CHECK (end_at > start_at)
);

CREATE INDEX service_records_org_date_idx
  ON public.service_records (organization_id, service_date)
  WHERE deleted_at IS NULL;
CREATE INDEX service_records_helper_date_idx
  ON public.service_records (helper_id, service_date)
  WHERE deleted_at IS NULL;
CREATE INDEX service_records_org_month_idx
  ON public.service_records (organization_id, start_at)
  WHERE deleted_at IS NULL;

-- =========================================================
-- RLS（自事業所のみ）
-- =========================================================
ALTER TABLE public.helpers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_records ENABLE ROW LEVEL SECURITY;

-- helpers
CREATE POLICY helpers_select_own_org
  ON public.helpers FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY helpers_insert_own_org
  ON public.helpers FOR INSERT
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY helpers_update_own_org
  ON public.helpers FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- shifts
CREATE POLICY shifts_select_own_org
  ON public.shifts FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY shifts_insert_own_org
  ON public.shifts FOR INSERT
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY shifts_update_own_org
  ON public.shifts FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- attendance
CREATE POLICY attendance_select_own_org
  ON public.attendance FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY attendance_insert_own_org
  ON public.attendance FOR INSERT
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY attendance_update_own_org
  ON public.attendance FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- service_records
CREATE POLICY service_records_select_own_org
  ON public.service_records FOR SELECT
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  );

CREATE POLICY service_records_insert_own_org
  ON public.service_records FOR INSERT
  WITH CHECK (organization_id = public.current_organization_id());

CREATE POLICY service_records_update_own_org
  ON public.service_records FOR UPDATE
  USING (
    deleted_at IS NULL
    AND organization_id = public.current_organization_id()
  )
  WITH CHECK (organization_id = public.current_organization_id());

-- 物理削除は purge 関数経由（論理削除から30日）
CREATE OR REPLACE FUNCTION public.purge_attendance_tables()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.service_records
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';

  DELETE FROM public.attendance
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';

  DELETE FROM public.shifts
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';

  DELETE FROM public.helpers
  WHERE deleted_at IS NOT NULL
    AND deleted_at < now() - interval '30 days';
END;
$$;

COMMENT ON TABLE public.helpers IS '訪問介護員など。organization_id = 事業所ID（facility_id相当）';
COMMENT ON TABLE public.service_records IS '日報実績。請求CSVは保存しない';
COMMENT ON TABLE public.attendance IS 'タイムカード実績';
COMMENT ON TABLE public.shifts IS 'シフト予定';
