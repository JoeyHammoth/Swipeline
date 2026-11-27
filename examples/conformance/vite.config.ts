import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { workspaceAliases } from '../vite.shared'

const page = (path: string): string => fileURLToPath(new URL(path, import.meta.url))

export default defineConfig({
  plugins: [react(), svelte()],
  resolve: { alias: workspaceAliases },
  // One fixture page per binding; Playwright opens them by name.
  build: {
    rollupOptions: {
      input: {
        react: page('./react.html'),
        element: page('./element.html'),
        vue: page('./vue.html'),
        svelte: page('./svelte.html'),
      },
    },
  },
})
