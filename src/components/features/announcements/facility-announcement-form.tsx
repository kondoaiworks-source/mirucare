"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createFacilityAnnouncementAction } from "@/app/actions/announcements"

export function FacilityAnnouncementForm() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createFacilityAnnouncementAction({ title, body })
      if (!result.ok) {
        toast.error(result.error ?? "投稿できませんでした。")
        return
      }
      toast.success("お知らせを投稿しました。")
      setTitle("")
      setBody("")
      router.refresh()
    })
  }

  return (
    <form id="post" onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="announcement-title">タイトル</Label>
        <Input
          id="announcement-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：今月の確認のお願い"
          className="min-h-11"
          required
          maxLength={120}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="announcement-body">本文</Label>
        <Textarea
          id="announcement-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="事業所メンバーへの連絡事項（個人名・被保険者番号は書かないでください）"
          className="min-h-28 text-base"
          required
          maxLength={2000}
        />
      </div>
      <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto">
        {pending ? "投稿しています…" : "お知らせを投稿する"}
      </Button>
    </form>
  )
}
