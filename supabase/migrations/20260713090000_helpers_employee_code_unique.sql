-- 勤怠取込: 職員コードでの upsert 用ユニーク制約
CREATE UNIQUE INDEX IF NOT EXISTS helpers_org_employee_code_unique
  ON public.helpers (organization_id, employee_code)
  WHERE deleted_at IS NULL AND employee_code IS NOT NULL AND employee_code <> '';

COMMENT ON INDEX public.helpers_org_employee_code_unique IS
  '介護ソフト連携の職員コード照合用。空コードは対象外';
