import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx, defineManifest } from '@crxjs/vite-plugin'

const manifest = defineManifest({
  manifest_version: 3,
  name: "ReadWell Browser Extension",
  version: "1.0.0",
  description: "ReadWell - Read and Learn",
  action: {
    default_popup: "index.html"
  },
  background: {
    service_worker: "src/background.ts",
    type: "module"
  },
  permissions: [
    "storage",
    "activeTab",
    "contextMenus",
    "scripting"
  ],
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content.ts"],
      css: ["src/content.css"]
    }
  ]
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), crx({ manifest: manifest as any })],
})
