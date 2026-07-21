# AGENTS.md

## Cursor Cloud specific instructions

This is `監査のミカタ`, a Next.js 14 (App Router) SaaS. Standard scripts live in `package.json`
and detailed per-feature verification steps are in `README.md` (the many `動作確認手順` sections).
Only the non-obvious, cloud-environment-specific notes are captured here.

### Backend: local Supabase (not hosted)

The app requires a Supabase backend (Auth + Postgres + Storage + RLS). There are no hosted
Supabase credentials in this environment, so development uses a **local Supabase stack** run via
Docker + the Supabase CLI (both are installed in the VM image). `supabase/config.toml` is committed
so the local stack is reproducible.

Start the backend at the beginning of a session (the update script does NOT do this):

```bash
# 1) Docker daemon (no systemd in this container) — start once, keep running:
sudo dockerd >/tmp/dockerd.log 2>&1 &
sudo chmod 666 /var/run/docker.sock

# 2) Local Supabase stack (Postgres/Auth/Storage/Studio):
supabase start
```

- Docker is configured for `fuse-overlayfs` with the containerd-snapshotter feature disabled
  (`/etc/docker/daemon.json`) and iptables set to legacy — required for Docker-in-Docker here.
- API URL is `http://127.0.0.1:54321`, Studio `http://127.0.0.1:54323`, Postgres on `54322`.
- The local anon/service_role keys are the standard fixed Supabase demo keys; get them anytime with
  `supabase status -o env`.

### `.env.local`

`.env.local` is gitignored and must exist for the dev server and the `tsx` scripts. It points at the
local Supabase stack and runs the Dify AI engine in **mock mode** (`DIFY_MOCK=1`), so no external Dify
key is needed. If it is missing, recreate it with the local Supabase URL + keys
(`supabase status -o env`) plus `DIFY_MOCK=1`.

### Non-obvious gotchas

- **Public-schema grants**: the app's migrations assume hosted Supabase's default that grants full DML
  on `public` to anon/authenticated/service_role. The local CLI stack does not, so authenticated
  queries fail with `permission denied for table ...`. `supabase/seed.sql` re-applies those grants and
  runs automatically on `supabase db reset`. RLS still enforces org isolation. If you ever hit
  `permission denied`, run `psql < supabase/seed.sql` against the local db, or `supabase db reset`.
- **Timezone (JST)**: the app and its unit tests assume `Asia/Tokyo`. In the default UTC VM, one
  billing-reconcile unit test fails because the code formats times with local `getHours()`. Run tests
  and the dev server with `TZ=Asia/Tokyo` (e.g. `TZ=Asia/Tokyo npm run test`, `TZ=Asia/Tokyo npm run dev`).
- **Plan paywall**: starting an AI check requires the organization to have a paid plan; a fresh org has
  `plan='none'` and the check button errors with "プランのご契約が必要です". For dev, grant a plan via
  SQL: `UPDATE public.organizations SET plan='premium' WHERE id='<org-id>';` (light has a monthly check
  limit; standard/premium allow daily).
- Email confirmation is disabled in the local stack (`enable_confirmations = false`), so signup logs in
  immediately. Auth emails (invites, etc.) land in Mailpit at `http://127.0.0.1:54324`.
- Stripe / Resend / Gemini are optional and unset; those features degrade gracefully or are mockable.

### Commands (see `package.json` for the full list)

- Dev server: `TZ=Asia/Tokyo npm run dev` → http://localhost:3000
- Lint: `npm run lint`  •  Build: `npm run build`
- Unit tests: `TZ=Asia/Tokyo npm run test`
- Backend-dependent scripts (need local Supabase up + `.env.local`): `npm run test:rls`,
  `npm run test:review`, `npm run test:lockout`, `npm run test:check` (Dify mock, no DB needed).
