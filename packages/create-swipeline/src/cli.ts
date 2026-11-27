#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { scaffold, TEMPLATE_NAMES, TEMPLATES, type TemplateName } from './index.js'

const USAGE = `create-swipeline - scaffold a deck

Usage:
  create-swipeline <dir> [--template <name>] [--force] [--list]

Templates: ${TEMPLATE_NAMES.join(', ')}

Options:
  --template <name>  Which starter to write. Defaults to blank.
  --force            Write into a directory that is not empty.
  --list             Print the templates and exit.
`

function parse(argv: readonly string[]): {
  directory?: string
  template: TemplateName
  force: boolean
  list: boolean
} | null {
  let directory: string | undefined
  let template: TemplateName = 'blank'
  let force = false
  let list = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') return null
    if (arg === '--force') {
      force = true
      continue
    }
    if (arg === '--list') {
      list = true
      continue
    }
    if (arg === '--template') {
      const value = argv[index + 1]
      if (!value || !TEMPLATE_NAMES.includes(value as TemplateName)) {
        throw new Error(`--template needs one of: ${TEMPLATE_NAMES.join(', ')}`)
      }
      template = value as TemplateName
      index += 1
      continue
    }
    if (arg?.startsWith('--')) throw new Error(`Unknown option: ${arg}`)
    if (arg !== undefined) directory = arg
  }

  return { template, force, list, ...(directory === undefined ? {} : { directory }) }
}

async function main(): Promise<number> {
  let parsed: ReturnType<typeof parse>
  try {
    parsed = parse(process.argv.slice(2))
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause))
    console.error(USAGE)
    return 2
  }

  if (parsed === null) {
    console.log(USAGE)
    return 0
  }
  if (parsed.list) {
    for (const template of TEMPLATES) {
      console.log(`${template.name.padEnd(9)} ${template.description}`)
    }
    return 0
  }

  const directory = resolve(parsed.directory ?? join(directoryName(parsed.template)))
  if (parsed.directory === undefined && existsSync(directory) && !parsed.force) {
    console.error(`${directory} already exists; pass a directory name or --force.`)
    return 1
  }

  try {
    const result = await scaffold({
      directory,
      template: parsed.template,
      ...(parsed.force ? { force: true } : {}),
      ...(process.env.SWIPELINE_LINK_WORKSPACE === '1' ? { linkWorkspace: true } : {}),
    })
    console.log(
      `Wrote ${result.files.length} file(s) into ${directory} (${result.template} template).`,
    )
    console.log('')
    console.log('Next:')
    console.log(`  cd ${directory}`)
    console.log('  npm install')
    console.log('  npm run dev')
    return 0
  } catch (cause) {
    console.error(cause instanceof Error ? cause.message : String(cause))
    return 1
  }
}

function directoryName(template: TemplateName): string {
  return `swipeline-${template}`
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((cause: unknown) => {
    console.error(cause instanceof Error ? cause.message : cause)
    process.exitCode = 1
  })
