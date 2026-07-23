import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ActionResult } from "./auth"

const mocks = vi.hoisted(() => {
  const serviceClient = { kind: "service" }
  return {
    lockedMessage:
      "ログイン試行が制限されています。しばらく時間をおいてから再度お試しください（約15分）。管理者に解除を依頼することもできます。",
    badCredentialsMessage:
      "メールアドレスまたはパスワードが正しくありません。入力内容をご確認ください。",
    serviceClient,
    signInWithPassword: vi.fn(),
    createClient: vi.fn(),
    createServiceClient: vi.fn(),
    lookupLoginLockout: vi.fn(),
    clearLoginLockout: vi.fn(),
    recordFailedLogin: vi.fn(),
    writeAuthAuditLog: vi.fn(),
    redirect: vi.fn((path: string) => {
      const error = new Error(`NEXT_REDIRECT:${path}`) as Error & {
        digest: string
      }
      error.digest = `NEXT_REDIRECT;replace;${path};false`
      throw error
    }),
  }
})

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
  createServiceClient: mocks.createServiceClient,
}))

vi.mock("@/lib/login-lockout", () => ({
  MSG_BAD_CREDENTIALS: mocks.badCredentialsMessage,
  MSG_LOCKED: mocks.lockedMessage,
  isLockoutActive: (lockoutUntil: string | null | undefined) =>
    Boolean(lockoutUntil && new Date(lockoutUntil).getTime() > Date.now()),
  lookupLoginLockout: mocks.lookupLoginLockout,
  clearLoginLockout: mocks.clearLoginLockout,
  recordFailedLogin: mocks.recordFailedLogin,
  writeAuthAuditLog: mocks.writeAuthAuditLog,
}))

import { signInAction } from "./auth"

function formData(email = "user@example.com", password = "password-123") {
  const data = new FormData()
  data.set("email", email)
  data.set("password", password)
  data.set("next", "/")
  return data
}

const baseLockRow = {
  profile_id: "profile-1",
  failed_login_attempts: 0,
  lockout_until: null,
  organization_id: "org-1",
  role: "admin" as const,
  is_operator: false,
  deleted_at: null,
}

describe("signInAction login lockout", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createServiceClient.mockReturnValue(mocks.serviceClient)
    mocks.createClient.mockReturnValue({
      auth: {
        signInWithPassword: mocks.signInWithPassword,
      },
    })
    mocks.clearLoginLockout.mockResolvedValue(undefined)
    mocks.writeAuthAuditLog.mockResolvedValue(undefined)
  })

  it("5回目の失敗でロックし、6回目は正しいPWでもAuthを呼ばず拒否する", async () => {
    const future = new Date(Date.now() + 15 * 60 * 1000).toISOString()

    mocks.lookupLoginLockout.mockResolvedValueOnce({
      ...baseLockRow,
      failed_login_attempts: 4,
    })
    mocks.signInWithPassword.mockResolvedValueOnce({
      error: new Error("Invalid login credentials"),
    })
    mocks.recordFailedLogin.mockResolvedValueOnce({
      locked: true,
      lockoutUntil: future,
      attempts: 5,
    })

    const fifth = (await signInAction(
      formData("USER@example.com", "wrong-password")
    )) as ActionResult

    expect(fifth).toEqual({ ok: false, error: mocks.lockedMessage })
    expect(mocks.recordFailedLogin).toHaveBeenCalledWith(
      "profile-1",
      4,
      "user@example.com",
      mocks.serviceClient
    )

    mocks.signInWithPassword.mockClear()
    mocks.lookupLoginLockout.mockResolvedValueOnce({
      ...baseLockRow,
      failed_login_attempts: 5,
      lockout_until: future,
    })

    const sixth = (await signInAction(
      formData("user@example.com", "correct-password")
    )) as ActionResult

    expect(sixth).toEqual({ ok: false, error: mocks.lockedMessage })
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  it("15分経過後のロックは遅延クリアし、正しいPWならログイン成功へ進む", async () => {
    const past = new Date(Date.now() - 60_000).toISOString()

    mocks.lookupLoginLockout.mockResolvedValueOnce({
      ...baseLockRow,
      failed_login_attempts: 5,
      lockout_until: past,
    })
    mocks.signInWithPassword.mockResolvedValueOnce({ error: null })

    await expect(signInAction(formData())).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    })

    expect(mocks.clearLoginLockout).toHaveBeenCalledWith(
      "profile-1",
      mocks.serviceClient
    )
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password-123",
    })
    expect(mocks.redirect).toHaveBeenCalledWith("/")
  })

  it("ログイン成功時は失敗カウンタをリセットし監査ログを残す", async () => {
    mocks.lookupLoginLockout.mockResolvedValueOnce({
      ...baseLockRow,
      failed_login_attempts: 2,
    })
    mocks.signInWithPassword.mockResolvedValueOnce({ error: null })

    await expect(signInAction(formData())).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    })

    expect(mocks.clearLoginLockout).toHaveBeenCalledWith(
      "profile-1",
      mocks.serviceClient
    )
    expect(mocks.writeAuthAuditLog).toHaveBeenCalledWith({
      action: "login_success_reset",
      profileId: "profile-1",
      email: "user@example.com",
      service: mocks.serviceClient,
    })
  })

  it("未登録メールはログイン失敗しても失敗カウンタを増やさない", async () => {
    mocks.lookupLoginLockout.mockResolvedValueOnce(null)
    mocks.signInWithPassword.mockResolvedValueOnce({
      error: new Error("Invalid login credentials"),
    })

    const result = (await signInAction(
      formData("missing@example.com", "wrong-password")
    )) as ActionResult

    expect(result).toEqual({
      ok: false,
      error: mocks.badCredentialsMessage,
    })
    expect(mocks.recordFailedLogin).not.toHaveBeenCalled()
  })
})
