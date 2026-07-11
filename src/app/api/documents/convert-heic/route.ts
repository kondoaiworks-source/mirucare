import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"

type ConvertModule = (args: {
  buffer: Buffer
  format: "JPEG" | "PNG"
  quality?: number
}) => Promise<ArrayBufferLike | Buffer | Uint8Array>

async function loadConvert(): Promise<ConvertModule> {
  const mod = await import("heic-convert")
  return (mod.default ?? mod) as unknown as ConvertModule
}

/**
 * HEIC/HEIF を JPEG に変換し、Storage 上のパスを差し替える
 * 個人名・被保険者番号はログに出さない
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

    const body = (await request.json()) as {
      filePath?: string
      documentId?: string
    }

    if (!body.filePath || !body.documentId) {
      return NextResponse.json(
        {
          error:
            "変換対象の指定が不足しています。もう一度アップロードしてください。",
        },
        { status: 400 }
      )
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .maybeSingle()

    if (!profile?.organization_id) {
      return NextResponse.json(
        { error: "事業所情報を取得できませんでした。" },
        { status: 403 }
      )
    }

    const orgPrefix = `${profile.organization_id}/`
    if (!body.filePath.startsWith(orgPrefix)) {
      return NextResponse.json(
        { error: "このファイルを変換する権限がありません。" },
        { status: 403 }
      )
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("documents")
      .download(body.filePath)

    if (downloadError || !fileData) {
      return NextResponse.json(
        {
          error:
            "ファイルの取得に失敗しました。通信状況をご確認のうえ、再試行してください。",
        },
        { status: 500 }
      )
    }

    const convert = await loadConvert()
    const inputBuffer = Buffer.from(await fileData.arrayBuffer())
    const converted = await convert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.9,
    })
    const outputBuffer = Buffer.isBuffer(converted)
      ? converted
      : Buffer.from(new Uint8Array(converted as ArrayBufferLike))

    const jpegPath = body.filePath.replace(/\.(heic|heif)$/i, ".jpg")
    const admin = createServiceClient()

    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(jpegPath, outputBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      })

    if (uploadError) {
      return NextResponse.json(
        {
          error: "JPEGへの変換保存に失敗しました。再試行してください。",
        },
        { status: 500 }
      )
    }

    if (jpegPath !== body.filePath) {
      await admin.storage.from("documents").remove([body.filePath])
    }

    return NextResponse.json({
      ok: true,
      filePath: jpegPath,
      mimeType: "image/jpeg",
    })
  } catch {
    return NextResponse.json(
      {
        error:
          "HEICの変換に失敗しました。JPEGまたはPDFで再度お試しください。",
      },
      { status: 500 }
    )
  }
}
