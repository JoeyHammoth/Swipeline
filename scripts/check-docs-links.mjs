/**
 * Checks internal links in the docs: markdown links, relative and site-absolute,
 * plus every sidebar/nav `link:` in the VitePress config. External URLs and
 * pure anchors are ignored. Exits 1 and lists every broken target.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DOCS = join(ROOT, 'docs')
const LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g

function isFile(path) {
  return existsSync(path) && statSync(path).isFile()
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.vitepress') continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path, files)
    else if (entry.endsWith('.md')) files.push(path)
  }
  return files
}

function targetsIn(markdown) {
  const targets = []
  let fenced = false
  for (const line of markdown.split('\n')) {
    if (line.trim().startsWith('```')) {
      fenced = !fenced
      continue
    }
    if (fenced) continue
    for (const match of line.matchAll(LINK)) targets.push(match[1])
  }
  return targets
}

function resolves(fromFile, target) {
  const clean = decodeURIComponent(target.split('#')[0].split('?')[0])
  if (!clean) return true
  const bases = clean.startsWith('/')
    ? [join(DOCS, clean), join(DOCS, 'public', clean)]
    : [resolve(dirname(fromFile), clean)]
  for (const base of bases) {
    if (isFile(base)) return true
    if (isFile(`${base}.md`)) return true
    if (isFile(join(base, 'index.md'))) return true
  }
  return false
}

const failures = []
for (const file of walk(DOCS)) {
  for (const target of targetsIn(readFileSync(file, 'utf8'))) {
    if (/^(https?:|mailto:|#)/.test(target)) continue
    if (!resolves(file, target)) failures.push(`${file.replace(ROOT, '')} -> ${target}`)
  }
}

const config = readFileSync(join(DOCS, '.vitepress/config.ts'), 'utf8')
for (const match of config.matchAll(/link:\s*'([^']+)'/g)) {
  const link = match[1]
  if (!link.startsWith('/')) continue
  if (!resolves(join(DOCS, 'index.md'), link)) {
    failures.push(`docs/.vitepress/config.ts -> ${link}`)
  }
}

if (failures.length > 0) {
  console.error(`Broken internal docs links (${failures.length}):\n`)
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  process.exit(1)
}
console.log('Docs links OK')
