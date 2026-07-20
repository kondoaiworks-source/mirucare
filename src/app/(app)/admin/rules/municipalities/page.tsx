import type { Metadata } from "next"
import { MunicipalitiesAdmin } from "@/components/features/admin/rules/municipalities-admin"

export const metadata: Metadata = { title: "自治体管理" }

export default function Page() {
  return <MunicipalitiesAdmin />
}
