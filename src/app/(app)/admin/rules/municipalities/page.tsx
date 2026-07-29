import type { Metadata } from "next"
import { MunicipalitiesAdmin } from "@/components/features/admin/rules/municipalities-admin"
import { OfferingsAdmin } from "@/components/features/admin/rules/offerings-admin"

export const metadata: Metadata = { title: "自治体管理" }

export default function Page() {
  return (
    <div className="space-y-8">
      <OfferingsAdmin />
      <MunicipalitiesAdmin />
    </div>
  )
}
