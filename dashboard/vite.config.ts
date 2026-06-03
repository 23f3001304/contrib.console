import path from "path"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { busApi } from "./server/bus-api"
import { terminal } from "./server/terminal"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (including non VITE_ ones) for server-side use only.
  const env = loadEnv(mode, process.cwd(), "")
  return {
    plugins: [
      react(),
      tailwindcss(),
      busApi({ githubToken: env.GITHUB_TOKEN }),
      terminal(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})
