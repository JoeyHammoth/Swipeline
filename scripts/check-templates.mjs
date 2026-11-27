/**
 * Scaffolds every create-swipeline template into `examples/scaffold-<name>` so
 * CI can install and build them.
 *
 * The templates write `workspace:*` for `@swipeline/*` because the packages are
 * not published yet, so this checks the template code against the workspace
 * rather than registry resolution. The nightly quickstart workflow runs it with
 * `--install`; locally, omit `--install` to just write the files.
 *
 * Scaffolded directories are gitignored and removed before each run.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const CLI = join(ROOT, 'packages/create-swipeline/dist/cli.js')
const TEMPLATES = ['blank', 'books', 'papers', 'recipes', 'products']
const install = process.argv.includes('--install')
const keep = process.argv.includes('--keep')

if (!existsSync(CLI)) {
  console.error(`Missing ${CLI}. Run "pnpm build" first.`)
  process.exit(1)
}

const targets = []
for (const template of TEMPLATES) {
  const directory = join(ROOT, 'examples', `scaffold-${template}`)
  rmSync(directory, { recursive: true, force: true })
  execFileSync(process.execPath, [CLI, directory, '--template', template, '--force'], {
    stdio: 'inherit',
    env: { ...process.env, SWIPELINE_LINK_WORKSPACE: '1' },
  })
  targets.push(directory)
}

console.log(`\nScaffolded ${targets.length} templates into examples/scaffold-*.`)

if (install) {
  // The scaffolded packages join the workspace, so one install links them all.
  execFileSync('pnpm', ['install', '--no-frozen-lockfile'], { cwd: ROOT, stdio: 'inherit' })
  // One Vite build at a time: five in parallel is enough to OOM a small runner.
  execFileSync(
    'pnpm',
    ['--filter', './examples/scaffold-*', '-r', '--workspace-concurrency=1', 'run', 'build'],
    { cwd: ROOT, stdio: 'inherit' },
  )
  console.log('\nEvery template built.')
}

if (!keep) {
  for (const directory of targets) rmSync(directory, { recursive: true, force: true })
}
