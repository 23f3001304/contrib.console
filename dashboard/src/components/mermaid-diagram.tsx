import { useEffect, useId, useRef, useState } from "react"
import mermaid from "mermaid"

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  fontFamily: "JetBrains Mono Variable, monospace",
})

export function MermaidDiagram({ code }: { code: string }) {
  const rawId = useId()
  const id = `m-${rawId.replace(/[^a-zA-Z0-9]/g, "")}`
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    setError(false)
    mermaid
      .render(id, code)
      .then(({ svg }) => {
        if (!cancelled && ref.current) ref.current.innerHTML = svg
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [code, id])

  if (error) {
    return (
      <pre className="overflow-auto font-mono text-[11px] leading-relaxed text-muted-foreground">
        {code}
      </pre>
    )
  }
  return <div ref={ref} className="flex justify-center overflow-auto [&_svg]:max-w-full" />
}
