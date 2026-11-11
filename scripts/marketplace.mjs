// Generates the host marketplace manifests from catalog.json and verifies the pinned releases.
//   node scripts/marketplace.mjs --write    regenerate the manifests
//   node scripts/marketplace.mjs --check    fail if a manifest is stale or the catalog is invalid
//   node scripts/marketplace.mjs --verify   also check each pinned tag on GitHub (network)
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../', import.meta.url))
const json = value => JSON.stringify(value, null, 2) + '\n'
const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
const NAME = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

export function parseCatalog(value) {
  const keys = ['name', 'displayName', 'description', 'owner', 'plugins']
  if (!value || typeof value !== 'object' || Object.keys(value).some(k => !keys.includes(k))) throw new Error('Unexpected catalog fields')
  if (!NAME.test(value.name) || typeof value.displayName !== 'string' || typeof value.description !== 'string' || typeof value.owner?.name !== 'string') throw new Error('Catalog needs a name, displayName, description and owner.name')
  if (!Array.isArray(value.plugins) || !value.plugins.length) throw new Error('Catalog lists no plugins')
  const seen = new Set()
  for (const plugin of value.plugins) {
    if (Object.keys(plugin).sort().join() !== 'description,name,repository,tag') throw new Error(`Plugin entries take exactly name, repository, tag and description: ${plugin.name}`)
    if (!NAME.test(plugin.name) || seen.has(plugin.name)) throw new Error(`Invalid or duplicate plugin name: ${plugin.name}`)
    if (!REPOSITORY.test(plugin.repository) || !TAG.test(plugin.tag) || typeof plugin.description !== 'string' || !plugin.description) throw new Error(`Plugin ${plugin.name} needs an owner/repo, a vX.Y.Z tag and a description`)
    seen.add(plugin.name)
  }
  return value
}

/** Claude Code and Copilot read .claude-plugin/; Codex reads .agents/plugins/. Both pin each plugin to its release tag. */
export function manifests(catalog) {
  const { name, displayName, description, owner, plugins } = parseCatalog(catalog)
  return {
    '.claude-plugin/marketplace.json': json({ name, owner, metadata: { description },
      plugins: plugins.map(p => ({ name: p.name, source: { source: 'github', repo: p.repository, ref: p.tag }, version: p.tag.slice(1), description: p.description })) }),
    '.agents/plugins/marketplace.json': json({ name, interface: { displayName },
      plugins: plugins.map(p => ({ name: p.name, source: { source: 'url', url: `https://github.com/${p.repository}.git`, ref: p.tag },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' })) }),
  }
}

const readCatalog = (root = ROOT) => JSON.parse(readFileSync(join(root, 'catalog.json'), 'utf8'))

export function check(root = ROOT) {
  for (const [path, expected] of Object.entries(manifests(readCatalog(root)))) {
    let actual = null
    try { actual = readFileSync(join(root, path), 'utf8') } catch { /* missing */ }
    if (actual !== expected) throw new Error(`Stale ${path}; run node scripts/marketplace.mjs --write`)
  }
}

/** A pinned tag must exist, and the plugin manifest at that tag must name the plugin and carry the tag's version. */
export function verify(root = ROOT, fetchManifest = (repository, tag) => {
  execFileSync('git', ['ls-remote', '--exit-code', '--tags', `https://github.com/${repository}.git`, `refs/tags/${tag}`], { stdio: 'ignore' })
  return JSON.parse(execFileSync('curl', ['-fsSL', `https://raw.githubusercontent.com/${repository}/${tag}/.claude-plugin/plugin.json`], { encoding: 'utf8' }))
}) {
  for (const plugin of parseCatalog(readCatalog(root)).plugins) {
    let manifest
    try { manifest = fetchManifest(plugin.repository, plugin.tag) } catch { throw new Error(`${plugin.repository} has no readable release ${plugin.tag}`) }
    if (manifest.name !== plugin.name || manifest.version !== plugin.tag.slice(1)) throw new Error(`${plugin.repository}@${plugin.tag} is ${manifest.name} ${manifest.version}, not ${plugin.name} ${plugin.tag.slice(1)}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const mode = process.argv[2]
    if (mode === '--write') {
      for (const [path, content] of Object.entries(manifests(readCatalog()))) { mkdirSync(dirname(join(ROOT, path)), { recursive: true }); writeFileSync(join(ROOT, path), content) }
      console.log('Manifests written.')
    } else if (mode === '--check') { check(); console.log('Manifests are current.') }
    else if (mode === '--verify') { check(); verify(); console.log('Manifests are current and every pinned release exists.') }
    else throw new Error('Usage: node scripts/marketplace.mjs --write | --check | --verify')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
