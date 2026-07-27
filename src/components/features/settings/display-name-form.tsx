"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { updateDisplayNameAction } from "@/app/actions/facility-setup"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Props = {
  currentDisplayName: string
}

export function DisplayNameForm({ currentDisplayName }: Props) {
  const [displayName, setDisplayName] = useState(currentDisplayName)
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label htmlFor="profile-display-name">あなたの表示名</Label>
        <Input
          id="profile-display-name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="山田 太郎"
          className="h-12 rounded-lg text-base"
          autoComplete="name"
          disabled={pending}
        />
      </div>
      <Button
        type="button"
        size="lg"
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await updateDisplayNameAction({ displayName })
            if (!result.ok) {
              toast.error(result.error ?? "保存できませんでした。")
              return
            }
            toast.success("表示名を保存しました。")
          })
        }}
      >
        {pending ? "保存しています…" : "表示名を保存する"}
      </Button>
    </div>
  )
}
