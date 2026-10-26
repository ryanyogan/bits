// Production build for Cloudflare Workers.
//
// 1. Client assets: runs the same remix/assets server the dev server uses, in
//    fingerprint mode, and crawls everything a page can request (script
//    entries, their import maps and preloads, stylesheets, fonts and CSS
//    url()s). Each response is written to build/client/ at its URL path so
//    Workers Static Assets serves it without running the Worker.
// 2. Manifest: the precomputed script entries and hrefs the Worker needs to
//    render pages, keyed by repo-relative module path.
// 3. Worker: esbuild bundles worker.ts with the `workerd` condition (so
//    `#platform` resolves to platform.worker.ts) and the manifest inlined.
//
// See docs/decisions/002-workers-asset-strategy.md.
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import * as esbuild from 'esbuild'
import { createAssetServer, type ScriptEntry } from 'remix/assets'

import {
  appDir,
  assetAccess,
  entryFile,
  fontPreloads,
  repoRoot,
  stylesheets,
} from '../app/platform/asset-plan.ts'
import type { AssetManifest } from '../app/platform/types.ts'

const buildDir = path.join(appDir, 'build')
const clientDir = path.join(buildDir, 'client')
const workerDir = path.join(buildDir, 'worker')
const origin = 'http://build.local'

function toPosix(file: string) {
  return file.split(path.sep).join('/')
}

async function findClientEntries(): Promise<string[]> {
  let patterns = [
    path.join(appDir, 'app/**/public/**/*.{ts,tsx}'),
    path.join(repoRoot, 'packages/ui/src/**/*.{ts,tsx}'),
  ]
  let found: string[] = []
  for (let pattern of patterns) {
    for await (let file of fs.glob(pattern)) {
      if (/\.test\.tsx?$/.test(file)) continue
      let source = await fs.readFile(file, 'utf8')
      if (/\bclientEntry\s*\(/.test(source)) found.push(toPosix(path.relative(repoRoot, file)))
    }
  }
  return found.sort()
}

async function buildClient(): Promise<AssetManifest> {
  let assetServer = createAssetServer({
    ...assetAccess,
    fingerprint: true,
    minify: true,
    watch: false,
  })

  try {
    let entry = await assetServer.getScriptEntry(entryFile)
    let clientEntries: Record<string, ScriptEntry> = {}
    for (let file of await findClientEntries()) {
      clientEntries[file] = await assetServer.getScriptEntry(file)
    }
    let stylesheetHrefs = await Promise.all(stylesheets.map((file) => assetServer.getHref(file)))
    let fontHrefs = await Promise.all(fontPreloads.map((file) => assetServer.getHref(file)))

    // Crawl from every URL the server can hand to a browser.
    let queue = new Set<string>([...stylesheetHrefs, ...fontHrefs])
    for (let scriptEntry of [entry, ...Object.values(clientEntries)]) {
      queue.add(scriptEntry.href)
      for (let preload of scriptEntry.preloads) queue.add(preload)
      let { imports = {}, scopes = {} } = scriptEntry.importMap
      for (let url of Object.values(imports)) queue.add(url)
      for (let scope of Object.values(scopes)) for (let url of Object.values(scope)) queue.add(url)
    }

    // Fetch everything reachable; CSS adds what its url()s reference (fonts).
    let fetched = new Map<string, { body: Uint8Array; contentType: string }>()
    for (let url of queue) {
      if (!url.startsWith(`${assetAccess.basePath}/`) || fetched.has(url)) continue
      let response = await assetServer.fetch(new Request(origin + url))
      if (!response || !response.ok) {
        throw new Error(`Asset crawl failed: ${url} -> ${response?.status ?? 'not served'}`)
      }
      let body = new Uint8Array(await response.arrayBuffer())
      let contentType = response.headers.get('Content-Type') ?? ''
      fetched.set(url, { body, contentType })
      if (contentType.includes('text/css')) {
        for (let ref of cssUrls(new TextDecoder().decode(body), url)) queue.add(ref)
      }
    }

    // Write each file at its published URL and point every reference the
    // browser receives (manifest, import maps, CSS url()) at that URL.
    let published = new Map([...fetched.keys()].map((url) => [url, publishedUrl(url)]))
    let rename = (url: string) => published.get(url) ?? url
    let bytes = 0
    for (let [url, file] of fetched) {
      let body = file.body
      if (file.contentType.includes('text/css')) {
        let css = new TextDecoder().decode(body).replace(cssUrlPattern, (whole, ref: string) => {
          let resolved = new URL(ref, origin + url)
          let target = resolved.origin === origin ? published.get(resolved.pathname) : undefined
          return target ? `url(${JSON.stringify(target)})` : whole
        })
        body = new TextEncoder().encode(css)
      }
      // Workers Static Assets looks files up by decoded path.
      let target = path.join(clientDir, decodeURIComponent(rename(url)))
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.writeFile(target, body)
      bytes += body.byteLength
    }

    let renameEntry = (scriptEntry: ScriptEntry): ScriptEntry => ({
      ...scriptEntry,
      href: rename(scriptEntry.href),
      preloads: scriptEntry.preloads.map(rename),
      importMap: {
        ...scriptEntry.importMap,
        imports: mapValues(scriptEntry.importMap.imports, rename) ?? {},
        scopes: scriptEntry.importMap.scopes
          ? Object.fromEntries(
              Object.entries(scriptEntry.importMap.scopes).map(([scope, map]) => [
                scope,
                mapValues(map, rename) ?? {},
              ]),
            )
          : undefined,
      },
    })

    let manifest: AssetManifest = {
      entry: renameEntry(entry),
      stylesheets: stylesheetHrefs.map(rename),
      fontPreloads: fontHrefs.map(rename),
      clientEntries: Object.fromEntries(
        Object.entries(clientEntries).map(([key, value]) => [key, renameEntry(value)]),
      ),
    }

    let written = new Set(published.values())
    await verifyModuleGraph(written, [manifest.entry, ...Object.values(manifest.clientEntries)])
    console.log(`client: ${written.size} files, ${(bytes / 1024).toFixed(0)} KiB`)
    return manifest
  } finally {
    await assetServer.close()
  }
}

const cssUrlPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/g

function cssUrls(css: string, from: string): string[] {
  let refs: string[] = []
  for (let match of css.matchAll(cssUrlPattern)) {
    let ref = new URL(match[1]!, origin + from)
    if (ref.origin === origin) refs.push(ref.pathname)
  }
  return refs
}

function mapValues(
  map: Record<string, string> | undefined,
  fn: (value: string) => string,
): Record<string, string> | undefined {
  return map && Object.fromEntries(Object.entries(map).map(([key, value]) => [key, fn(value)]))
}

/**
 * The URL a built file is published at. Workers Static Assets 307-redirects
 * any path that is not canonically encoded (a raw `@` in `.@hash`), and picks
 * Content-Type from the extension (`.ts` would be served as `video/mp2t`). So
 * each segment is encoded canonically and TypeScript-sourced modules get a
 * `.js` suffix. Modules import each other by stable URL, and the import map
 * (rewritten above) resolves those to the published files, so no module
 * source needs rewriting.
 */
function publishedUrl(url: string): string {
  let pathname = new URL(url, origin).pathname
    .split('/')
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)))
    .join('/')
  return /\.(ts|tsx|mts|jsx)$/.test(pathname) ? `${pathname}.js` : pathname
}

// Every absolute /assets/ import in an emitted module must resolve, through the
// import maps, to a file that was written. Catches crawl gaps at build time.
async function verifyModuleGraph(written: Set<string>, entries: ScriptEntry[]) {
  let mapped = new Map<string, string>()
  for (let { importMap } of entries) {
    for (let [from, to] of Object.entries(importMap.imports ?? {})) mapped.set(from, to)
    for (let scope of Object.values(importMap.scopes ?? {})) {
      for (let [from, to] of Object.entries(scope)) mapped.set(from, to)
    }
  }
  let missing: string[] = []
  for (let url of written) {
    if (!url.endsWith('.js')) continue
    let source = await fs.readFile(path.join(clientDir, decodeURIComponent(url)), 'utf8')
    for (let match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\/assets\/[^"']+)["']/g)) {
      let target = mapped.get(match[1]!) ?? match[1]!
      if (!written.has(target)) missing.push(`${url} imports ${match[1]}`)
    }
  }
  if (missing.length) throw new Error(`Unresolved module imports:\n  ${missing.join('\n  ')}`)
}

async function copyPublic() {
  let publicDir = path.join(appDir, 'public')
  await fs.cp(publicDir, clientDir, { recursive: true })
  await fs.writeFile(
    path.join(clientDir, '_headers'),
    [
      '# Generated by scripts/build.ts',
      '/assets/*',
      '  Cache-Control: public, max-age=31536000, immutable',
      '  X-Content-Type-Options: nosniff',
      '',
    ].join('\n'),
  )
}

/** Gives each source module a stable `import.meta.url` so clientEntry IDs match the manifest. */
const stableImportMetaUrl: esbuild.Plugin = {
  name: 'stable-import-meta-url',
  setup(build) {
    build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
      if (args.path.includes(`${path.sep}node_modules${path.sep}`)) return undefined
      let source = await fs.readFile(args.path, 'utf8')
      if (!source.includes('import.meta.url')) return undefined
      let url = `file:///${toPosix(path.relative(repoRoot, args.path))}`
      let ext = path.extname(args.path).slice(1)
      return {
        contents: source.replaceAll('import.meta.url', JSON.stringify(url)),
        loader: ext.endsWith('x') ? 'tsx' : ext.startsWith('t') || ext.endsWith('ts') ? 'ts' : 'js',
      }
    })
  },
}

async function buildWorker(manifest: AssetManifest) {
  let result = await esbuild.build({
    entryPoints: [path.join(appDir, 'worker.ts')],
    outfile: path.join(workerDir, 'index.js'),
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2024',
    conditions: ['workerd', 'worker', 'import', 'default'],
    mainFields: ['module', 'main'],
    external: ['cloudflare:*', 'node:*'],
    jsx: 'automatic',
    jsxImportSource: 'remix/component',
    minify: true,
    // clientEntry() falls back to the component function's name for its
    // export name, so minification must not rename functions.
    keepNames: true,
    sourcemap: 'external',
    metafile: true,
    legalComments: 'none',
    define: {
      __BITS_ASSET_MANIFEST__: JSON.stringify(manifest),
      'process.env.NODE_ENV': '"production"',
    },
    plugins: [stableImportMetaUrl],
    logLevel: 'warning',
  })

  let nodeImports = new Set<string>()
  for (let output of Object.values(result.metafile.outputs)) {
    for (let imported of output.imports) {
      if (imported.external && imported.path.startsWith('node:')) nodeImports.add(imported.path)
    }
  }
  let size = (await fs.stat(path.join(workerDir, 'index.js'))).size
  console.log(`worker: ${(size / 1024).toFixed(0)} KiB`)
  if (nodeImports.size) console.log(`worker node: imports: ${[...nodeImports].join(', ')}`)
}

await fs.rm(buildDir, { recursive: true, force: true })
let manifest = await buildClient()
await copyPublic()
await fs.writeFile(path.join(buildDir, 'asset-manifest.json'), JSON.stringify(manifest, null, 2))
await buildWorker(manifest)
