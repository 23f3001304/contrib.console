import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePreferences, useUpdatePreferences } from "@/lib/bus/hooks"
import { AutomationSettings } from "@/components/automation-settings"

export function SettingsPanel() {
  const { data } = usePreferences()
  const update = useUpdatePreferences()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (!data) return
    setName(data.git.name)
    setEmail(data.git.email)
  }, [data])

  function save() {
    if (!data) return
    update.mutate(
      { ...data, git: { name, email } },
      {
        onSuccess: () => toast.success("Identity saved"),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          settings
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Commit identity
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Git identity</CardTitle>
          <CardDescription>
            Commits and PRs are authored as this person. No bot identity, no AI
            attribution. Saved to pipeline/preferences.json.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="git-name"
                className="font-mono text-xs text-muted-foreground"
              >
                git name
              </Label>
              <Input
                id="git-name"
                value={name}
                placeholder="Your Name"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="git-email"
                className="font-mono text-xs text-muted-foreground"
              >
                git email
              </Label>
              <Input
                id="git-email"
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={update.isPending}>
              {update.isPending ? "Saving..." : "Save identity"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AutomationSettings />
    </div>
  )
}
