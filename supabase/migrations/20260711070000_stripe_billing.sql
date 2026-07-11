-- =========================================================
-- 監査のミカタ STEP 8: Stripe 課金・プラン同期
-- =========================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS setup_fee_paid_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_stripe_customer_id_uidx
  ON public.organizations (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS organizations_stripe_subscription_id_idx
  ON public.organizations (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;
