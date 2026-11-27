import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { checkPackageLicenses } from './check-package-licenses.mjs'

const LICENSE = 'Apache License, Version 2.0\n'
const NOTICE = 'Swipeline\nCopyright 2026 Joey Hammoth and the Swipeline contributors\n'

/** A throwaway repository root with the two source-of-truth files. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'swipeline-package-licenses-'))
  writeFileSync(join(root, 'LICENSE'), LICENSE)
  writeFileSync(join(root, 'NOTICE'), NOTICE)
  mkdirSync(join(root, 'packages'), { recursive: true })
  return root
}

/** Add a package, with its own copies of the license files unless overridden. */
function addPackage(root, name, manifest, copies = { LICENSE, NOTICE }) {
  const dir = join(root, 'packages', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name, version: '0.0.0', ...manifest }))
  for (const [file, content] of Object.entries(copies)) writeFileSync(join(dir, file), content)
  return dir
}

/** A pack stub that reports exactly these tarball entries. */
const packs =
  (...names) =>
  () =>
    new Set(names)

/** Run the check against a fresh fixture and clean it up afterwards. */
function withFixture(run) {
  const root = fixture()
  try {
    return run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('accepts a public package that carries and lists both files', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a', files: ['dist', 'LICENSE', 'NOTICE'] })

    const { packagesChecked, problems } = checkPackageLicenses(root, {
      pack: packs('dist/index.js', 'LICENSE', 'NOTICE'),
    })

    assert.deepEqual(problems, [])
    assert.equal(packagesChecked, 1)
  })
})

test('fails when a package has no LICENSE copy', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a', files: ['LICENSE', 'NOTICE'] }, { NOTICE })

    const { problems } = checkPackageLicenses(root, { pack: packs('LICENSE', 'NOTICE') })

    assert.deepEqual(problems, [
      '@swipeline/a: LICENSE is missing; run node scripts/sync-package-licenses.mjs',
    ])
  })
})

test('fails when a package copy drifts from the root NOTICE', () => {
  withFixture((root) => {
    addPackage(
      root,
      'a',
      { name: '@swipeline/a', files: ['LICENSE', 'NOTICE'] },
      {
        LICENSE,
        NOTICE: 'stale notice\n',
      },
    )

    const { problems } = checkPackageLicenses(root, { pack: packs('LICENSE', 'NOTICE') })

    assert.deepEqual(problems, [
      '@swipeline/a: NOTICE differs from the root copy; run node scripts/sync-package-licenses.mjs',
    ])
  })
})

test('fails when the files array omits NOTICE', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a', files: ['dist', 'README.md', 'LICENSE'] })

    const { problems } = checkPackageLicenses(root, { pack: packs('LICENSE', 'NOTICE') })

    assert.deepEqual(problems, ['@swipeline/a: NOTICE is not listed in "files"'])
  })
})

test('fails when npm would not put LICENSE in the tarball', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a', files: ['LICENSE', 'NOTICE'] })

    const { problems } = checkPackageLicenses(root, {
      pack: packs('dist/index.js', 'NOTICE'),
    })

    assert.deepEqual(problems, ['@swipeline/a: npm pack does not include LICENSE'])
  })
})

test('fails when npm pack cannot run', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a', files: ['LICENSE', 'NOTICE'] })

    const { problems } = checkPackageLicenses(root, { pack: () => null })

    assert.deepEqual(problems, ['@swipeline/a: npm pack --dry-run failed'])
  })
})

test('skips private packages', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a', private: true, files: ['dist'] }, {})

    const { packagesChecked, problems } = checkPackageLicenses(root, { pack: packs() })

    assert.equal(packagesChecked, 0)
    assert.deepEqual(problems, [])
  })
})
