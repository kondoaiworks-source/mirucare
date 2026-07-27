import type { Metadata } from "next"
import { BookOpen, Info } from "lucide-react"
import { SectionCard } from "@/components/features/layout/section-card"
import { PageHeader } from "@/components/features/layout/page-header"
import { GUIDE_UI } from "@/lib/copy/guide-ui"

export const metadata: Metadata = {
  title: "使い方",
}

export default function GuidePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader title={GUIDE_UI.title} />

      <SectionCard icon={Info} title={GUIDE_UI.aboutTitle}>
        <p className="text-base leading-relaxed text-foreground">
          {GUIDE_UI.aboutBody}
        </p>
      </SectionCard>

      <SectionCard icon={BookOpen} title={GUIDE_UI.howTitle}>
        <ol className="space-y-8">
          {GUIDE_UI.howSteps.map((step) => (
            <li key={step.title} className="space-y-3">
              <h3 className="text-lg font-bold text-primary-dark">
                {step.title}
              </h3>
              {step.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="text-base leading-relaxed text-foreground"
                >
                  {paragraph}
                </p>
              ))}
              {step.bullets ? (
                <ul className="list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground">
                  {step.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
              {step.closing ? (
                <p className="text-base leading-relaxed text-foreground">
                  {step.closing}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </SectionCard>
    </div>
  )
}
