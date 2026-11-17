/**
 * Media proxy with a disk cache. The Delivery token never reaches the browser, so pictures are served from here; but a
 * picture is fetched from NovaDB only once. The upstream route is content-addressed and cannot change under its name
 * (`files/{md5}{extension}`), so a cached file is never revalidated. A file's cache key is its URL below `/media`:
 * `{md5}/original{ext}` and, scaled, `{md5}/{width}{ext}.webp`. A file that exists is complete: it is written under a
 * temporary name and renamed.
 */
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as path from 'node:path'
import { openLazyFile } from 'remix/fs'
import { createFileResponse } from 'remix/response/file'
import sharp from 'sharp'

import { deliveryFetch, instanceUrl } from './delivery.ts'
import { MEDIA_WIDTHS } from './images.ts'

/** `MEDIA_CACHE_DIR`, by default a folder in the system's temp directory (writable for the container's `node` user). Delete it to reset the cache. */
const cacheDir = () => process.env.MEDIA_CACHE_DIR ?? path.join(tmpdir(), 'nova-media')

/** An image file's name is its content address: the MD5 (GUID form, or 32 hex digits) and the extension. */
const FILE_NAME = /^([0-9a-f]{32}|[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12})\.[a-z0-9]{1,5}$/

/** Builds in progress by cache key: concurrent requests for the same picture share one download or scaling. */
const builds = new Map<string, Promise<boolean>>()

const exists = (file: string) => access(file).then(() => true, () => false)

/** Writes `file` through a temporary file and a rename, so no reader ever sees half of it. */
async function writeAtomic(file: string, write: (temp: string) => Promise<unknown>): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  let temp = `${file}.${process.pid}.${Date.now()}.tmp`
  try {
    await write(temp)
    await rename(temp, file)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
}

/** Whether the file of `key` is in the cache, building it first (once, however many requests ask) if it is not; false if NovaDB has no such file. */
async function ensure(key: string, build: (file: string) => Promise<boolean>): Promise<boolean> {
  let file = path.join(cacheDir(), key)
  if (await exists(file)) return true
  let pending = builds.get(key) ?? build(file).finally(() => builds.delete(key))
  builds.set(key, pending)
  return pending
}

async function download(md5: string, ext: string): Promise<boolean> {
  return ensure(`${md5}/original${ext}`, async (file) => {
    let upstream = await deliveryFetch(instanceUrl(`files/${md5}${ext}`))
    if (upstream.status === 404) return false
    if (!upstream.ok || !upstream.body) throw new Error(`Delivery ${upstream.status} for files/${md5}${ext}`)
    await writeAtomic(file, (temp) => writeFile(temp, upstream.body!))
    return true
  })
}

/** The cached original scaled to `width` as WebP quality 80, without enlarging it. */
async function scale(md5: string, ext: string, width: number): Promise<boolean> {
  return ensure(`${md5}/${width}${ext}.webp`, async (file) => {
    if (!(await download(md5, ext))) return false
    let original = path.join(cacheDir(), md5, `original${ext}`)
    await writeAtomic(file, (temp) => sharp(original, { animated: true }).resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toFile(temp))
    return true
  })
}

/**
 * Answers `GET /media/{md5}/{file}`: `original{ext}` is the file `files/{md5}{ext}`, `{width}{ext}.webp` the same file
 * scaled to one of `MEDIA_WIDTHS`; SVG stays vector and has no variant. Any other name is a 404, and so is a file
 * NovaDB does not have. The checks make the cache key a safe path.
 */
export async function serveMedia(md5: string, name: string, request: Request): Promise<Response> {
  let original = name.match(/^original(\.[a-z0-9]{1,5})$/)
  let variant = name.match(/^(\d+)(\.[a-z0-9]{1,5})\.webp$/)
  let ext = original?.[1] ?? variant?.[2]
  let width = MEDIA_WIDTHS.find((w) => String(w) === variant?.[1]) // not `Number()`: it would also read `0x190` and `4e2` as 400
  if (!ext || !FILE_NAME.test(md5 + ext) || (variant && (!width || ext === '.svg'))) return notFound()

  let found = width ? await scale(md5, ext, width) : await download(md5, ext)
  if (!found) return notFound()
  return createFileResponse(openLazyFile(path.join(cacheDir(), md5, name)), request, {
    cacheControl: 'public, max-age=31536000, immutable',
  })
}

const notFound = () => new Response('Not found', { status: 404 })
