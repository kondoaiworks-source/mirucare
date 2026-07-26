import type { Metadata } from "next"
import { BookOpen, AlertTriangle } from "lucide-react"
import { SectionCard } from "@/components/features/layout/section-card"
import { PageHeader } from "@/components/features/layout/page-header"
import { GUIDE_UI } from "@/lib/copy/guide-ui"

export const metadata: Metadata = {
  title: "使い方",
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={GUIDE_UI.title} description={GUIDE_UI.lead} />

      <SectionCard
        icon={BookOpen}
        title={GUIDE_UI.howTitle}
        description={GUIDE_UI.howHint}
      >
        <ol className="list-decimal space-y-3 pl-5 text-base leading-relaxed text-foreground">
          {GUIDE_UI.howSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard
        icon={AlertTriangle}
        title={GUIDE_UI.notesTitle}
        description={GUIDE_UI.notesHint}
      >
        <ul className="list-disc space-y-3 pl-5 text-base leading-relaxed text-foreground">
          {GUIDE_UI.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </SectionCard>
    </div>
  )
}
