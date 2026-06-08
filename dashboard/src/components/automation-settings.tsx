import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChipField } from "@/components/chip-field"
import {
  useRunScheduleNow,
  useSchedule,
  useUpdateSchedule,
} from "@/lib/bus/hooks"
import type { WorkerSchedule } from "@/lib/bus/types"

export function AutomationSettings() {
  const { data } = useSchedule()
  const update = useUpdateSchedule()
  const runNow = useRunScheduleNow()
  const [form, setForm] = useState<WorkerSchedule | null>(null)
  const [timeDraft, setTimeDraft] = useState("")

  useEffect(() => {
    if (data) setForm(data)
  }, [data])

  if (!form) return null
  const set = (patch: Partial<WorkerSchedule>) => setForm({ ...form, ...patch })
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  const offsetLabel =
    new Intl.DateTimeFormat("en", { timeZoneName: "shortOffset" })
      .formatToParts()
      .find((p) => p.type === "timeZoneName")?.value ?? ""

  function addTime() {
    const value = timeDraft.trim()
    setTimeDraft("")
    if (!/^\d{1,2}:\d{2}$/.test(value)) return
    const norm = value.padStart(5, "0")
    if (!form!.times.includes(norm)) set({ times: [...form!.times, norm].sort() })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Automation</CardTitle>
        <CardDescription>
          Auto-start the worker in the terminal on a schedule. It launches claude
          with full permissions inside Open_Source, does one reviewed commit, then
          stops. It never pushes without your approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center gap-2.5">
          <Checkbox
            checked={form.enabled}
            onCheckedChange={(v) => set({ enabled: v === true })}
          />
          <span className="text-sm">Enable scheduled runs</span>
        </div>

        <div className="space-y-1.5">
          <ChipField
            label="daily times"
            items={form.times}
            draft={timeDraft}
            onDraft={setTimeDraft}
            onAdd={addTime}
            onRemove={(t) => set({ times: form.times.filter((x) => x !== t) })}
            placeholder="09:00"
          />
          <p className="text-xs text-muted-foreground">
            Times use your computer's local time ({tz}, {offsetLabel}).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label
              htmlFor="interval"
              className="font-mono text-xs text-muted-foreground"
            >
              every N hours (0 = off)
            </Label>
            <Input
              id="interval"
              type="number"
              min={0}
              value={form.intervalMinutes ? form.intervalMinutes / 60 : 0}
              onChange={(e) =>
                set({
                  intervalMinutes: Math.max(0, Number(e.target.value) || 0) * 60,
                })
              }
            />
          </div>
          <label className="flex items-center gap-2.5 pb-2.5 text-sm">
            <Checkbox
              checked={form.bypassPermissions}
              onCheckedChange={(v) => set({ bypassPermissions: v === true })}
            />
            Full permissions in folder
          </label>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="start-prompt"
            className="font-mono text-xs text-muted-foreground"
          >
            start prompt
          </Label>
          <textarea
            id="start-prompt"
            rows={3}
            value={form.prompt}
            onChange={(e) => set({ prompt: e.target.value })}
            className="w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() =>
              runNow.mutate(undefined, {
                onSuccess: () =>
                  toast.success("Worker starting in the terminal..."),
                onError: (err) => toast.error(err.message),
              })
            }
            disabled={runNow.isPending}
          >
            <Play className="size-4" /> Run now
          </Button>
          <Button
            onClick={() =>
              update.mutate(form, {
                onSuccess: () => toast.success("Schedule saved"),
                onError: (err) => toast.error(err.message),
              })
            }
            disabled={update.isPending}
          >
            {update.isPending ? "Saving..." : "Save schedule"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
