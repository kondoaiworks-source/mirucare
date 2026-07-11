import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import {
  guessDocType,
  MAX_FILE_SIZE_BYTES,
  buildStoragePath,
} from "@/lib/documents"
import type { DocType } from "@/types/database"

export const runtime = "nodejs"

function resolveContentType(file: File): string {
  if (file.type) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith(".pdf")) return "application/pdf"
  if (name.endsWith(".csv")) return "text/csv"
  if (name.endsWith(".png")) return "image/png"
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg"
  if (name.endsWith(".webp")) return "image/webp"
  if (name.endsWith(".heic")) return "image/heic"
  if (name.endsWith(".heif")) return "image/heif"
  if (name.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }
  if (name.endsWith(".xls")) return "application/vnd.ms-excel"
  return "application/octet-stream"
}

/**
 * ブラウザ → Next.js → Storage の経路。
 * Storage キーは ASCII のみ（日本語ファイル名は Invalid key になる）
 */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        {
          error:
            "ログインの有効期限が切れた可能性があります。再度ログインしてください。",
        },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.organization_id) {
      return NextResponse.json(
        {
          error:
            "事業所情報を取得できませんでした。オンボーディングが完了しているかご確認ください。",
        },
        { status: 403 }
      )
    }

    const form = await request.formData()
    const file = form.get("file")
    const docTypeRaw = String(form.get("docType") ?? "その他") as DocType

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "ファイルが選択されていません。もう一度選び直してください。" },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "ファイルが大きすぎます。20MB以下のファイルをご用意ください。" },
        { status: 400 }
      )
    }

    const documentId = crypto.randomUUID()
    const filePath = buildStoragePath(
      profile.organization_id,
      documentId,
      file.name
    )
    const contentType = resolveContentType(file)
    const bytes = Buffer.from(await file.arrayBuffer())

    let uploadErrorMessage: string | null = null
    {
      const { error } = await supabase.storage
        .from("documents")
        .upload(filePath, bytes, {
          contentType,
          upsert: false,
          cacheControl: "3600",
        })
      if (error) uploadErrorMessage = error.message
    }

    if (uploadErrorMessage) {
      try {
        const admin = createServiceClient()
        const { error: adminError } = await admin.storage
          .from("documents")
          .upload(filePath, bytes, {
            contentType,
            upsert: false,
            cacheControl: "3600",
          })
        if (adminError) {
          const msg = adminError.message || uploadErrorMessage
          if (
            msg.toLowerCase().includes("bucket") &&
            msg.toLowerCase().includes("not found")
          ) {
            return NextResponse.json(
              {
                error:
                  "Storage の documents バケットがありません。SQL（20260711010000_documents_storage.sql）を Supabase で実行してください。",
              },
              { status: 500 }
            )
          }
          return NextResponse.json(
            { error: `アップロードに失敗しました。（${msg}）` },
            { status: 500 }
          )
        }
      } catch {
        return NextResponse.json(
          {
            error: `アップロードに失敗しました。（${uploadErrorMessage}）`,
          },
          { status: 500 }
        )
      }
    }

    const docType = (
      [
        "ケアプラン",
        "提供記録",
        "勤務表",
        "請求データ",
        "その他",
      ] as DocType[]
    ).includes(docTypeRaw)
      ? docTypeRaw
      : guessDocType(file.name)

    const { data: document, error: insertError } = await supabase
      .from("documents")
      .insert({
        id: documentId,
        organization_id: profile.organization_id,
        uploaded_by: user.id,
        doc_type: docType,
        file_path: filePath,
        original_name: file.name,
        mime_type: contentType,
        file_size: file.size,
        status: "uploaded",
      })
      .select("*")
      .single()

    if (insertError || !document) {
      const msg = insertError?.message ?? "unknown"
      if (msg.toLowerCase().includes("does not exist")) {
        return NextResponse.json(
          {
            error:
              "documents テーブルがありません。SQL（20260711010000_documents_storage.sql）を実行してください。",
          },
          { status: 500 }
        )
      }
      return NextResponse.json(
        { error: `書類情報の登録に失敗しました。（${msg}）` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      document,
      suggestedDocType: guessDocType(file.name),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "unknown"
    return NextResponse.json(
      { error: `アップロード処理でエラーが発生しました。（${msg}）` },
      { status: 500 }
    )
  }
}
