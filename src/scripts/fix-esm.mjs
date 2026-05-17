import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const root = resolve(fileURLToPath(import.meta.url), '..', '..')
const distEsm = join(root, 'dist', 'esm')
const distCjs = join(root, 'dist', 'cjs')

function addJsExtensions(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      addJsExtensions(full)
      continue
    }
    if (!entry.endsWith('.js')) continue
    let code = readFileSync(full, 'utf8')
    code = code.replace(/from ['"]\.\/([^'"]+)['"]/g, (m, path) => {
      if (path.endsWith('.js')) return m
      return `from './${path}.js'`
    })
    code = code.replace(/export .* from ['"]\.\/([^'"]+)['"]/g, (m, path) => {
      if (path.endsWith('.js')) return m
      return m.replace(path, `${path}.js`)
    })
    writeFileSync(full, code)
  }
}

addJsExtensions(distEsm)
writeFileSync(join(distEsm, 'package.json'), JSON.stringify({ type: 'module' }, null, 2) + '\n')

if (statSync(distCjs, { throwIfNoEntry: false })) {
  writeFileSync(join(distCjs, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n')
}

console.log('ESM build post-processed')
