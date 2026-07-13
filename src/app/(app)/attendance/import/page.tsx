import type { Metadata } from "next"
import { AttendanceImportView } from "@/components/features/attendance/attendance-import-view"

export const metadata: Metadata = {
  title: "勤怠・日報の取込",
}

export default function AttendanceImportPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <AttendanceImportView />
    </div>
  )
}
