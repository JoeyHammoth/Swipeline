import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/**
 * `svelte-package` ships the component as `.svelte` source for the consumer's
 * bundler to compile, so the TypeScript has to be stripped here — otherwise every
 * consumer would need a `lang="ts"` preprocessor just to import the package.
 *
 * @type {import('@sveltejs/vite-plugin-svelte').SvelteConfig}
 */
export default {
  preprocess: vitePreprocess(),
}
