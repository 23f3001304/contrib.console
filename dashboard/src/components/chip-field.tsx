import { X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function ChipField({
  label,
  items,
  draft,
  onDraft,
  onAdd,
  onRemove,
  placeholder,
}: {
  label: string
  items: string[]
  draft: string
  onDraft: (value: string) => void
  onAdd: () => void
  onRemove: (value: string) => void
  placeholder: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="font-mono text-xs text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {items.map((item) => (
          <Badge
            key={item}
            variant="secondary"
            className="cursor-pointer gap-1 font-mono"
            onClick={() => onRemove(item)}
          >
            {item}
            <X className="size-3" />
          </Badge>
        ))}
        <Input
          value={draft}
          placeholder={placeholder}
          onChange={(e) => onDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onAdd()
            }
          }}
          className="h-8 w-40 font-mono text-sm"
        />
      </div>
    </div>
  )
}
