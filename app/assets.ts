import { createAssetServer } from 'remix/assets'

const nodeEnv = process.env.NODE_ENV ?? 'development'
const isDevelopment = nodeEnv === 'development'

// Compiles the browser modules (every `public` folder below `app`) and the stylesheet on request; in production under
// names that carry their content hash, which may be cached for good.
export const assets = createAssetServer({
  basePath: '/assets',
  rootDir: process.cwd(),
  allowFiles: ['app/routes.ts', 'app/site.css', 'app/**/public/**'],
  allowPackages: ['remix'],
  sourceMaps: isDevelopment ? 'external' : undefined,
  minify: !isDevelopment,
  fingerprint: nodeEnv === 'production',
  watch: isDevelopment,
})

export const scriptEntry = await assets.getScriptEntry('app/actions/public/entry.ts')
export const styleHref = await assets.getHref('app/site.css')
