import type { Metadata } from "next"
import { UploadWizard } from "@/components/features/documents/upload-wizard"

export const metadata: Metadata = {
  title: "書類をアップロード",
}

export default function CheckUploadPage() {
  return <UploadWizard />
}
