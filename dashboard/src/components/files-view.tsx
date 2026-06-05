import { useState } from "react"
import { ChevronRight, ExternalLink, FileCode } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRepoCloned } from "@/lib/bus/hooks"
import type { ClonedInfo } from "@/lib/bus/client"
import type { RepoMapFile } from "@/lib/bus/types"

export function FilesView({
  owner,
  name,
  files,
}: {
  owner: string
  name: string
  files: RepoMapFile[]
}) {
  const cloned = useRepoCloned(owner, name)

  if (files.length === 0) {
    return (
      <p className="font-mono text-xs text-muted-foreground">
        No important files in the map yet.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {!cloned.data?.cloned && (
        <p className="font-mono text-[11px] text-muted-foreground/70">
          Clone this repo (the worker does it on first run) to open files in VS
          Code.
        </p>
      )}
      {files.map((file) => (
        <FileRow key={file.path} file={file} cloned={cloned.data} />
      ))}
    </div>
  )
}

function FileRow({ file, cloned }: { file: RepoMapFile; cloned?: ClonedInfo }) {
  const [open, setOpen] = useState(false)
  const vscodeUrl =
    cloned?.cloned ? `vscode://file/${cloned.path}/${file.path}` : null

  return (
    <div className="overflow-hidden rounded-md border">
      <div className="flex items-center gap-2 bg-muted/30 px-3 py-2">
        <button
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90",
            )}
          />
          <FileCode className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-mono text-xs">{file.path}</span>
        </button>
        {vscodeUrl && (
          <a
            href={vscodeUrl}
            className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-brand"
            title="Open in VS Code"
          >
            <ExternalLink className="size-3" /> VS Code
          </a>
        )}
      </div>
      <p className="px-3 py-2 text-sm text-muted-foreground">{file.role}</p>
      {open && file.snippet && (
        <pre className="overflow-auto border-t bg-muted/20 p-3 font-mono text-[11px] leading-relaxed">
          {file.snippet}
        </pre>
      )}
    </div>
  )
}
