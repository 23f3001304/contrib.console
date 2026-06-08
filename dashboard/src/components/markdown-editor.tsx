import { useRef, useState } from "react"
import {
  Bold,
  Code,
  Heading,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Markdown } from "@/components/markdown"

// A GitHub-style markdown editor: Write / Preview tabs and a toolbar that wraps
// or prefixes the current selection. The preview reuses the app's Markdown
// renderer, so it looks exactly like it will on the dashboard.
export function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 8,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<"write" | "preview">("write")

  function surround(before: string, after = before, fallback = "text") {
    const ta = ref.current
    if (!ta) return
    const { selectionStart: start, selectionEnd: end } = ta
    const selected = value.slice(start, end) || fallback
    onChange(value.slice(0, start) + before + selected + after + value.slice(end))
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = start + before.length
      ta.selectionEnd = start + before.length + selected.length
    })
  }

  function linePrefix(prefix: string) {
    const ta = ref.current
    if (!ta) return
    const start = ta.selectionStart
    const lineStart = value.lastIndexOf("\n", start - 1) + 1
    onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart))
    requestAnimationFrame(() => {
      ta.focus()
      ta.selectionStart = ta.selectionEnd = start + prefix.length
    })
  }

  function insertLink() {
    const ta = ref.current
    if (!ta) return
    const { selectionStart: start, selectionEnd: end } = ta
    const text = value.slice(start, end) || "text"
    onChange(value.slice(0, start) + `[${text}](url)` + value.slice(end))
    requestAnimationFrame(() => {
      ta.focus()
      const urlStart = start + text.length + 3
      ta.selectionStart = urlStart
      ta.selectionEnd = urlStart + 3
    })
  }

  const tools = [
    { icon: Heading, label: "Heading", run: () => linePrefix("### ") },
    { icon: Bold, label: "Bold", run: () => surround("**") },
    { icon: Italic, label: "Italic", run: () => surround("_") },
    { icon: Quote, label: "Quote", run: () => linePrefix("> ") },
    { icon: Code, label: "Code", run: () => surround("`") },
    { icon: Link2, label: "Link", run: insertLink },
    { icon: List, label: "Bulleted list", run: () => linePrefix("- ") },
    { icon: ListOrdered, label: "Numbered list", run: () => linePrefix("1. ") },
    { icon: ListChecks, label: "Task list", run: () => linePrefix("- [ ] ") },
  ]

  function onKeyDown(e: React.KeyboardEvent) {
    if (!(e.metaKey || e.ctrlKey)) return
    if (e.key === "b") {
      e.preventDefault()
      surround("**")
    } else if (e.key === "i") {
      e.preventDefault()
      surround("_")
    } else if (e.key === "k") {
      e.preventDefault()
      insertLink()
    }
  }

  return (
    <div className="overflow-hidden rounded-md border bg-background">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-2 py-1.5">
        <div className="flex gap-1">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                tab === t
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {tab === "write" && (
          <div className="flex items-center gap-0.5">
            {tools.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.label}
                  type="button"
                  title={tool.label}
                  onClick={tool.run}
                  className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icon className="size-3.5" />
                </button>
              )
            })}
          </div>
        )}
      </div>
      {tab === "write" ? (
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          rows={rows}
          placeholder={placeholder}
          className="w-full resize-y bg-transparent px-3 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground"
        />
      ) : (
        <div className="min-h-32 px-3 py-2">
          {value.trim() ? (
            <Markdown>{value}</Markdown>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing to preview.</p>
          )}
        </div>
      )}
    </div>
  )
}
