import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { MermaidDiagram } from "@/components/mermaid-diagram"
import type { RepoMap } from "@/lib/bus/types"

export function MapOverview({ map }: { map: RepoMap }) {
  return (
    <div className="space-y-6">
      <Section label="summary">
        <p className="text-sm text-muted-foreground">{map.summary}</p>
        <div className="flex flex-wrap gap-1.5">
          {map.stack.map((tech) => (
            <Badge key={tech} variant="outline" className="font-mono text-[11px]">
              {tech}
            </Badge>
          ))}
        </div>
      </Section>

      <Section label="diagram">
        <div className="rounded-md border bg-muted/20 p-4">
          <MermaidDiagram code={map.diagram} />
        </div>
      </Section>

      <Section label="architecture">
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {map.architecture}
        </p>
      </Section>

      <Section label="data flow">
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {map.flow}
        </p>
      </Section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section label="run">
          <pre className="overflow-auto rounded-md border bg-muted/20 p-3 font-mono text-[11px]">
            {map.run}
          </pre>
        </Section>
        <Section label="test">
          <pre className="overflow-auto rounded-md border bg-muted/20 p-3 font-mono text-[11px]">
            {map.test}
          </pre>
        </Section>
      </div>

      <Section label="where to start">
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {map.contributionTips}
        </p>
      </Section>

      <p className="font-mono text-[10px] text-muted-foreground">
        generated {map.generatedAt}
      </p>
    </div>
  )
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </h3>
      {children}
    </section>
  )
}
