import type { Metadata } from "next"
import { UploadWizard } from "@/components/features/documents/upload-wizard"

export const metadata: Metadata = {
  title: "監査書類アップロード",
}

type PageProps = {
  searchParams: { documentId?: string }
}

export default function CheckUploadPage({ searchParams }: PageProps) {
  return <UploadWizard resumeDocumentId={searchParams.documentId} />
}
