import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { scaffold, TEMPLATE_NAMES, TEMPLATES } from '../src/index.js'

let directory: string | undefined

async function workspace(): Promise<string> {
  directory = await mkdtemp(join(tmpdir(), 'create-swipeline-'))
  return directory
}

afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true })
  directory = undefined
})

describe('scaffold', () => {
  it('describes every template', () => {
    expect(TEMPLATES.map((template) => template.name)).toEqual([...TEMPLATE_NAMES])
    expect(TEMPLATES).toHaveLength(5)
  })

  it('writes a React project for the books template', async () => {
    const root = join(await workspace(), 'books')
    const result = await scaffold({ directory: root, template: 'books' })

    expect(result.files).toContain('src/main.tsx')
    expect(result.files).toContain('src/deck.config.ts')
    expect(result.files).not.toContain('src/main.ts')

    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      name: string
      dependencies: Record<string, string>
    }
    expect(pkg.name).toBe('swipeline-books')
    // Scaffolded projects target the current workspace release, not a stale pin.
    const coreVersion = (
      JSON.parse(readFileSync(new URL('../../core/package.json', import.meta.url), 'utf8')) as {
        version: string
      }
    ).version
    expect(pkg.dependencies['@swipeline/react']).toBe(`^${coreVersion}`)
    expect(pkg.dependencies.react).toBe('^19.3.1')

    const entry = await readFile(join(root, 'src/main.tsx'), 'utf8')
    expect(entry).toContain("from './deck.config'")
    expect(entry).toContain('createIndexedDbStores')
    const tsconfig = await readFile(join(root, 'tsconfig.json'), 'utf8')
    expect(tsconfig).toContain('"jsx": "react-jsx"')
  })

  it('writes a framework-free project for the blank template', async () => {
    const root = join(await workspace(), 'blank')
    const result = await scaffold({ directory: root, template: 'blank' })

    expect(result.files).toContain('src/main.ts')
    expect(result.files).not.toContain('src/deck.config.ts')

    const html = await readFile(join(root, 'index.html'), 'utf8')
    expect(html).toContain('<swipe-deck')
    const entry = await readFile(join(root, 'src/main.ts'), 'utf8')
    expect(entry).toContain('defineSwipeDeck')
    expect(entry).toContain('demoSource')
  })

  it('uses workspace dependencies when asked', async () => {
    const root = join(await workspace(), 'books')
    await scaffold({ directory: root, template: 'books', linkWorkspace: true })
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>
    }
    expect(pkg.dependencies['@swipeline/core']).toBe('workspace:*')
    expect(pkg.dependencies.react).toBe('^19.3.1')
  })

  it('refuses a non-empty directory unless forced', async () => {
    const root = await workspace()
    await writeFile(join(root, 'keep.txt'), 'mine', 'utf8')

    await expect(scaffold({ directory: root, template: 'books' })).rejects.toThrow(/not empty/)
    const forced = await scaffold({ directory: root, template: 'books', force: true })
    expect(forced.files.length).toBeGreaterThan(0)
    expect(await readFile(join(root, 'keep.txt'), 'utf8')).toBe('mine')
  })

  it('rejects an unknown template', async () => {
    const root = await workspace()
    await expect(
      scaffold({ directory: join(root, 'x'), template: 'podcasts' as 'blank' }),
    ).rejects.toThrow(/Unknown template/)
  })
})
