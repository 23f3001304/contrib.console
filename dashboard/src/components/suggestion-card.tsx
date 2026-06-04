import { Check, Plus, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { RepoSuggestion } from "@/lib/bus/types"

export function SuggestionCard({
  suggestion,
  approved,
  pending,
  onApprove,
  onOpen,
}: {
  suggestion: RepoSuggestion
  approved: boolean
  pending: boolean
  onApprove: () => void
  onOpen: () => void
}) {
  return (
    <div className="flex flex-col rounded-lg border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-muted/30">
      <button onClick={onOpen} className="min-w-0 text-left">
        <span className="block truncate font-mono text-sm font-medium">
          {suggestion.owner}/{suggestion.name}
        </span>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {suggestion.description || "No description."}
        </p>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="tnum flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 text-foreground">
            <Star className="size-3" />
            {formatStars(suggestion.stars)}
          </span>
          {suggestion.language && <span>{suggestion.language}</span>}
        </div>
        <Button
          size="sm"
          variant={approved ? "secondary" : "default"}
          disabled={approved || pending}
          onClick={onApprove}
        >
          {approved ? (
            <>
              <Check className="size-4" /> Approved
            </>
          ) : (
            <>
              <Plus className="size-4" /> Approve
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function formatStars(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}
