"use client"

import { useCallback, useRef, useState } from "react"
import { Camera, Upload } from "lucide-react"
import { cn } from "@/lib/utils"
import { ACCEPTED_EXTENSIONS } from "@/lib/documents"
import { useUploadManager } from "./upload-provider"

type DropzoneProps = {
  className?: string
}

export function UploadDropzone({ className }: DropzoneProps) {
  const { addFiles } = useUploadManager()
  const inputRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const onFiles = useCallback(
    (files: FileList | null) => {
      if (files && files.length > 0) addFiles(files)
    },
    [addFiles]
  )

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        onClick={() => inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(e) => {
          e.preventDefault()
          setDragging(false)
        }}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          onFiles(e.dataTransfer.files)
        }}
        className={cn(
          "flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-background px-4 py-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/40"
        )}
        aria-label="ファイルをドロップ、またはタップして選択"
      >
        <div className="mb-3 flex size-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Upload className="size-7" aria-hidden />
        </div>
        <p className="text-base font-semibold text-foreground">
          ここにファイルを置く／タップして選択
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          PDF・CSV・Excel・写真（JPEG/PNG/HEIC）／最大20MB／複数可
        </p>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={ACCEPTED_EXTENSIONS}
          multiple
          onChange={(e) => {
            onFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      {/* スマホ：カメラ起動 */}
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-base font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hidden"
      >
        <Camera className="size-5 text-primary" aria-hidden />
        書類を撮影する
      </button>
      <input
        ref={cameraRef}
        type="file"
        className="sr-only"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          onFiles(e.target.files)
          e.target.value = ""
        }}
      />
    </div>
  )
}
