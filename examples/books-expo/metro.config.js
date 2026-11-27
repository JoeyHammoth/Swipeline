const path = require('node:path')
const { getDefaultConfig } = require('expo/metro-config')

const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')
const config = getDefaultConfig(projectRoot)

// pnpm links workspace packages from the repository root, so Metro has to watch
// the root and resolve through the root's node_modules as well.
config.watchFolders = [monorepoRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]

module.exports = config
