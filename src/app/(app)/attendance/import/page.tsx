import type { Metadata } from "next"
import { AttendanceImportView } from "@/components/features/attendance/attendance-import-view"
import type { AttendanceImportKind } from "@/lib/attendance/csv-parse"

export const metadata: Metadata = {
  title: "勤怠・日報の取込",
}

const LOCKABLE_KINDS: AttendanceImportKind[] = [
  "service_records",
  "attendance",
]

type PageProps = {
  searchParams: { kind?: string }
}

export default function AttendanceImportPage({ searchParams }: PageProps) {
  const lockedKind = LOCKABLE_KINDS.includes(
    searchParams.kind as AttendanceImportKind
  )
    ? (searchParams.kind as AttendanceImportKind)
    : undefined

  return (
    <div className="mx-auto max-w-5xl">
      <AttendanceImportView lockedKind={lockedKind} />
    </div>
  )
}
