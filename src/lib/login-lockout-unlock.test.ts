import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}))

import { unlockLoginForProfile } from "./login-lockout"

describe("unlockLoginForProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("他事業所の管理者によるロック解除は403にする", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "target-profile",
        organization_id: "org-a",
        deleted_at: null,
      },
      error: null,
    })
    const eq = vi.fn().mockReturnValue({ maybeSingle })
    const select = vi.fn().mockReturnValue({ eq })
    const from = vi.fn().mockReturnValue({ select })

    mocks.createServiceClient.mockReturnValue({ from })

    const result = await unlockLoginForProfile({
      targetProfileId: "target-profile",
      actorProfileId: "actor-profile",
      actorOrganizationId: "org-b",
      isOperator: false,
      isOrgAdmin: true,
    })

    expect(result).toEqual({
      ok: false,
      error: "他事業所のユーザーは解除できません。",
      status: 403,
    })
    expect(from).toHaveBeenCalledWith("profiles")
  })
})
