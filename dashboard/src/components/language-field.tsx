import { useEffect, useState, type KeyboardEvent } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const LANGUAGES = [
  "typescript",
  "javascript",
  "python",
  "go",
  "rust",
  "java",
  "kotlin",
  "swift",
  "c",
  "c++",
  "c#",
  "ruby",
  "php",
  "scala",
  "dart",
  "elixir",
  "erlang",
  "haskell",
  "clojure",
  "ocaml",
  "lua",
  "r",
  "julia",
  "zig",
  "nim",
  "perl",
  "shell",
  "html",
  "css",
  "vue",
  "svelte",
  "solidity",
]

export function LanguageField({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)

  const query = draft.trim().toLowerCase()
  const matches = query
    ? LANGUAGES.filter(
        (lang) => lang.includes(query) && !value.includes(lang),
      ).slice(0, 6)
    : []

  useEffect(() => {
    setActive(0)
  }, [query])

  function add(lang: string) {
    const next = lang.trim().toLowerCase()
    if (next && !value.includes(next)) onChange([...value, next])
    setDraft("")
    setOpen(false)
  }

  function remove(lang: string) {
    onChange(value.filter((current) => current !== lang))
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown" && matches.length > 0) {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (a + 1) % matches.length)
    } else if (e.key === "ArrowUp" && matches.length > 0) {
      e.preventDefault()
      setOpen(true)
      setActive((a) => (a - 1 + matches.length) % matches.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      add(open && matches[active] ? matches[active] : draft)
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  return (
    <div className="space-y-1.5">
      <Label className="font-mono text-xs text-muted-foreground">languages</Label>
      <div className="flex flex-wrap items-center gap-2">
        {value.map((lang) => (
          <Badge
            key={lang}
            variant="secondary"
            className="cursor-pointer gap-1 font-mono"
            onClick={() => remove(lang)}
          >
            {lang}
            <X className="size-3" />
          </Badge>
        ))}
        <div className="relative">
          <Input
            value={draft}
            placeholder="type a language"
            className="h-8 w-44 font-mono text-sm"
            onChange={(e) => {
              setDraft(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onKeyDown={handleKeyDown}
          />
          {open && matches.length > 0 && (
            <div className="absolute left-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-md border bg-popover shadow-md duration-150 animate-in fade-in-0 zoom-in-95">
              {matches.map((match, index) => (
                <button
                  key={match}
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    add(match)
                  }}
                  className={cn(
                    "block w-full px-3 py-1.5 text-left font-mono text-sm transition-colors",
                    index === active
                      ? "bg-muted text-foreground"
                      : "text-foreground hover:bg-muted",
                  )}
                >
                  {match}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
