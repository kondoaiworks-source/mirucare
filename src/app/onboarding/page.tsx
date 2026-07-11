import type { Metadata } from "next"
import { OnboardingWizard } from "@/components/features/onboarding/onboarding-wizard"

export const metadata: Metadata = {
  title: "初期設定",
}

export default function OnboardingPage() {
  return <OnboardingWizard />
}
