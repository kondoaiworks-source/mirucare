import type { Metadata } from "next"
import { UploadWizard } from "@/components/features/documents/upload-wizard"

export const metadata: Metadata = {
  title: "書類をアップロード",
}

type PageProps = {
  searchParams: { documentId?: string }
}

export default function CheckUploadPage({ searchParams }: PageProps) {
  return <UploadWizard resumeDocumentId={searchParams.documentId} />
}
