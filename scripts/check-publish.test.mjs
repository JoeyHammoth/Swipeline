import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { advertisedPaths, checkPublished, checkPublishReadiness } from './check-publish.mjs'

/** A throwaway repository root holding one empty `packages` directory. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'swipeline-publish-'))
  mkdirSync(join(root, 'packages'), { recursive: true })
  return root
}

/** Add a package directory with the given manifest. */
function addPackage(root, dir, manifest) {
  const target = join(root, 'packages', dir)
  mkdirSync(target, { recursive: true })
  writeFileSync(
    join(target, 'package.json'),
    JSON.stringify({ version: '1.0.0', publishConfig: { access: 'public' }, ...manifest }),
  )
  return target
}

/** A publish stub reporting exactly this id and these tarball entries. */
const published =
  (id, ...files) =>
  () => ({ id, files: new Set(files) })

/** Run the check against a fresh fixture and clean it up afterwards. */
function withFixture(run) {
  const root = fixture()
  try {
    return run(root)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('accepts a package whose entry points are all in the tarball', () => {
  withFixture((root) => {
    addPackage(root, 'a', {
      name: '@swipeline/a',
      main: './dist/index.cjs',
      module: './dist/index.js',
      types: './dist/index.d.ts',
    })

    const { packagesChecked, problems } = checkPublishReadiness(root, {
      publish: published(
        '@swipeline/a@1.0.0',
        'dist/index.cjs',
        'dist/index.js',
        'dist/index.d.ts',
      ),
    })

    assert.deepEqual(problems, [])
    assert.equal(packagesChecked, 1)
  })
})

test('fails when an advertised type declaration is not in the tarball', () => {
  withFixture((root) => {
    addPackage(root, 'a', {
      name: '@swipeline/a',
      main: './dist/index.cjs',
      types: './dist/index.d.ts',
    })

    const { problems } = checkPublishReadiness(root, {
      publish: published('@swipeline/a@1.0.0', 'dist/index.cjs'),
    })

    assert.deepEqual(problems, [
      '@swipeline/a: "dist/index.d.ts" is advertised but not in the tarball',
    ])
  })
})

test('fails when a bin target is not in the tarball', () => {
  withFixture((root) => {
    addPackage(root, 'cli', { name: '@swipeline/cli', bin: { swipeline: './dist/cli.js' } })

    const { problems } = checkPublishReadiness(root, {
      publish: published('@swipeline/cli@1.0.0', 'dist/index.js'),
    })

    assert.deepEqual(problems, [
      '@swipeline/cli: "dist/cli.js" is advertised but not in the tarball',
    ])
  })
})

test('fails when npm rejects the manifest', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a' })

    const { problems } = checkPublishReadiness(root, {
      publish: () => ({ error: 'npm error EUNSUPPORTEDPROTOCOL workspace:*' }),
    })

    assert.deepEqual(problems, [
      '@swipeline/a: npm publish --dry-run rejected the manifest: npm error EUNSUPPORTEDPROTOCOL workspace:*',
    ])
  })
})

test('fails when the dry run reports a different package id', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a' })

    const { problems } = checkPublishReadiness(root, {
      publish: published('@swipeline/a@2.0.0'),
    })

    assert.deepEqual(problems, [
      '@swipeline/a: dry run reported "@swipeline/a@2.0.0", expected "@swipeline/a@1.0.0"',
    ])
  })
})

test('fails on an unversioned or non-semver package', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a', version: '0.0.0' })
    addPackage(root, 'b', { name: '@swipeline/b', version: 'next' })

    const { problems } = checkPublishReadiness(root, { publish: () => ({ files: new Set() }) })

    assert.deepEqual(problems, [
      '@swipeline/a: version is still 0.0.0; version the packages before publishing',
      '@swipeline/b: version "next" is not semver',
    ])
  })
})

test('fails when a scoped package would publish as restricted', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a', publishConfig: {} })

    const { problems } = checkPublishReadiness(root, {
      publish: published('@swipeline/a@1.0.0'),
    })

    assert.deepEqual(problems, [
      '@swipeline/a: publishConfig.access must be "public" for a scoped package',
    ])
  })
})

test('fails on a lifecycle script a consumer would run', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a', scripts: { postinstall: 'node patch.js' } })

    const { problems } = checkPublishReadiness(root, {
      publish: published('@swipeline/a@1.0.0'),
    })

    assert.deepEqual(problems, [
      "@swipeline/a: scripts.postinstall would run on a consumer's install",
    ])
  })
})

test('fails when an internal dependency names no package here', () => {
  withFixture((root) => {
    addPackage(root, 'a', {
      name: '@swipeline/a',
      dependencies: { '@swipeline/ghost': 'workspace:*' },
    })

    const { problems } = checkPublishReadiness(root, {
      publish: published('@swipeline/a@1.0.0'),
    })

    assert.deepEqual(problems, [
      '@swipeline/a: dependencies names @swipeline/ghost, which is not a package here',
    ])
  })
})

test('skips private packages', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a', private: true })

    const { packagesChecked, problems } = checkPublishReadiness(root, {
      publish: () => assert.fail('private packages are not published'),
    })

    assert.equal(packagesChecked, 0)
    assert.deepEqual(problems, [])
  })
})

test('registry check passes when every package version resolves', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a' })
    addPackage(root, 'b', { name: '@swipeline/b', version: '2.0.0' })

    const asked = []
    const { packagesChecked, versions, problems } = checkPublished(root, {
      lookup: (name, version) => {
        asked.push(`${name}@${version}`)
        return 'published'
      },
    })

    assert.deepEqual(problems, [])
    assert.equal(packagesChecked, 2)
    assert.deepEqual(versions, ['1.0.0', '2.0.0'])
    assert.deepEqual(asked.sort(), ['@swipeline/a@1.0.0', '@swipeline/b@2.0.0'])
  })
})

test('registry check names every package missing from the registry', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a' })
    addPackage(root, 'b', { name: '@swipeline/b' })

    const { problems } = checkPublished(root, {
      lookup: (name) => (name === '@swipeline/b' ? 'missing' : 'published'),
    })

    assert.deepEqual(problems, ['@swipeline/b@1.0.0: not on the registry'])
  })
})

test('registry check reports a lookup that failed for another reason', () => {
  withFixture((root) => {
    addPackage(root, 'a', { name: '@swipeline/a' })

    const { problems } = checkPublished(root, {
      lookup: () => ({ error: 'npm error E500 registry unavailable' }),
    })

    assert.deepEqual(problems, [
      '@swipeline/a@1.0.0: registry lookup failed (npm error E500 registry unavailable)',
    ])
  })
})

test('collects nested export targets and bin maps', () => {
  assert.deepEqual(
    advertisedPaths({
      name: '@swipeline/a',
      main: './dist/index.cjs',
      exports: {
        '.': { types: './dist/index.d.ts', import: './dist/index.js' },
        './styles.css': './styles.css',
        './package.json': './package.json',
      },
      bin: { a: './dist/cli.js' },
    }).sort(),
    [
      'dist/cli.js',
      'dist/index.cjs',
      'dist/index.d.ts',
      'dist/index.js',
      'package.json',
      'styles.css',
    ],
  )
})
