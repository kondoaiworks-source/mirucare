import type { Metadata } from "next"
import { AttendanceContradictionView } from "@/components/features/attendance/attendance-contradiction-view"

export const metadata: Metadata = {
  title: "勤怠の矛盾検知",
}

export default function AttendancePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <AttendanceContradictionView />
    </div>
  )
}
