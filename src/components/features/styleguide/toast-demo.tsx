"use client"

import { toast } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button
        type="button"
        variant="default"
        onClick={() =>
          toast.success("チェックが完了しました", {
            description: "指摘の可能性がある項目をご確認ください。",
          })
        }
      >
        成功トーストを表示する
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          toast.warning("確認が必要な項目があります", {
            description: "署名欄が空欄の可能性があります。",
          })
        }
      >
        注意トーストを表示する
      </Button>
      <Button
        type="button"
        variant="destructive"
        onClick={() =>
          toast.error("アップロードに失敗しました", {
            description:
              "通信状況をご確認のうえ、再度お試しください。バツを押すまで残ります。",
          })
        }
      >
        エラートーストを表示する
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          toast.info("処理を開始しました", {
            description: "完了まで数分かかる場合があります。",
          })
        }
      >
        情報トーストを表示する
      </Button>
    </div>
  )
}
