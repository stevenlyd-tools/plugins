import test from 'node:test'
import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ROOT, check, manifests, parseCatalog, verify } from '../scripts/marketplace.mjs'

const catalog = () => JSON.parse(readFileSync(join(ROOT, 'catalog.json'), 'utf8'))
function copy(t) {
  const root = mkdtempSync(join(tmpdir(), 'plugins-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const path of ['catalog.json', '.claude-plugin', '.agents']) cpSync(join(ROOT, path), join(root, path), { recursive: true })
  return root
}

test('committed manifests match the catalog', () => assert.doesNotThrow(() => check()))

test('each host gets every plugin pinned to its release tag', () => {
  const files = manifests(catalog()), claude = JSON.parse(files['.claude-plugin/marketplace.json']), codex = JSON.parse(files['.agents/plugins/marketplace.json'])
  assert.equal(claude.name, 'stevenlyd-tools'); assert.equal(codex.name, 'stevenlyd-tools')
  for (const plugin of catalog().plugins) {
    const c = claude.plugins.find(p => p.name === plugin.name), x = codex.plugins.find(p => p.name === plugin.name)
    assert.deepEqual(c.source, { source: 'github', repo: plugin.repository, ref: plugin.tag }); assert.equal(c.version, plugin.tag.slice(1))
    assert.deepEqual(x.source, { source: 'url', url: `https://github.com/${plugin.repository}.git`, ref: plugin.tag })
    assert.deepEqual(x.policy, { installation: 'AVAILABLE', authentication: 'ON_INSTALL' })
  }
})

test('a stale manifest or an invalid catalog is rejected', t => {
  const root = copy(t), c = catalog()
  c.plugins[0].tag = 'v99.0.0'; writeFileSync(join(root, 'catalog.json'), JSON.stringify(c))
  assert.throws(() => check(root), /Stale \.claude-plugin\/marketplace\.json/)
  for (const bad of [{ ...catalog().plugins[0], tag: 'main' }, { ...catalog().plugins[0], repository: 'no-owner' }, { ...catalog().plugins[0], extra: 1 }])
    assert.throws(() => parseCatalog({ ...catalog(), plugins: [bad] }))
  assert.throws(() => parseCatalog({ ...catalog(), plugins: [catalog().plugins[0], catalog().plugins[0]] }), /duplicate/)
})

test('verify requires each tag to carry the plugin at that version', t => {
  const root = copy(t)
  const releases = Object.fromEntries(catalog().plugins.map(p => [`${p.repository}@${p.tag}`, { name: p.name, version: p.tag.slice(1) }]))
  assert.doesNotThrow(() => verify(root, (repo, tag) => releases[`${repo}@${tag}`]))
  assert.throws(() => verify(root, (repo, tag) => ({ ...releases[`${repo}@${tag}`], version: '0.0.1' })), /not duet|not suo/)
  assert.throws(() => verify(root, () => { throw new Error('404') }), /has no readable release/)
})
