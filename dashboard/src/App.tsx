import { Navigate, Route, Routes } from "react-router-dom"
import { AppShell } from "@/components/app-shell"
import { DiscoverPanel } from "@/components/discover-panel"
import { ReposPanel } from "@/components/repos-panel"
import { IssuesRoute } from "@/components/issues-route"
import { RepoPage } from "@/components/repo-page"
import { WorkPanel } from "@/components/work-panel"
import { TerminalPanel } from "@/components/terminal-panel"
import { ReviewsPanel } from "@/components/reviews-panel"
import { PullsPanel } from "@/components/pulls-panel"
import { StatusPanel } from "@/components/status-panel"
import { SettingsPanel } from "@/components/settings-panel"

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/discover" replace />} />
        <Route path="discover" element={<DiscoverPanel />} />
        <Route path="repos" element={<ReposPanel />} />
        <Route path="issues" element={<IssuesRoute />} />
        <Route path="repo/:owner/:name" element={<RepoPage />} />
        <Route path="work" element={<WorkPanel />} />
        <Route path="terminal" element={<TerminalPanel />} />
        <Route path="reviews" element={<ReviewsPanel />} />
        <Route path="pulls" element={<PullsPanel />} />
        <Route path="status" element={<StatusPanel />} />
        <Route path="settings" element={<SettingsPanel />} />
        <Route path="*" element={<Navigate to="/discover" replace />} />
      </Route>
    </Routes>
  )
}

export default App
