/** Pictures by file object ID → the unchangeable URLs of the media proxy (`media.ts`), and their scaled variants. */
import { list, type NovaObject } from './delivery.ts'
import { IMAGE, TYPE } from './schema.ts'

/** A picture as an `<img>` shows it: `src` is the file by content address, `/media/{md5}/original{extension}`; `srcset` its scaled variants, none for SVG. */
export type Picture = { src: string; srcset?: string }

/** Widths of the scaled variants (`/media/{md5}/{width}{ext}.webp`): a fixed list, so the cache cannot be filled with arbitrary sizes. */
export const MEDIA_WIDTHS = [400, 800, 1200, 1600]

/** The folder and extension of a picture URL `/media/{md5}/original{ext}` that has scaled variants (`/media/{md5}/{width}{ext}.webp`, which keep the extension because NovaDB serves a file only under it): not SVG, which is vector. */
function scalable(src: string): { folder: string; ext: string } | undefined {
  let [, folder, ext] = src.match(/^(\/media\/[^/]+)\/original(\.[a-z0-9]{1,5})$/) ?? []
  return ext && ext !== '.svg' ? { folder, ext } : undefined
}

function pictureOf(src: string): Picture {
  let file = scalable(src)
  return { src, srcset: file && MEDIA_WIDTHS.map((w) => `${file.folder}/${w}${file.ext}.webp ${w}w`).join(', ') }
}

/** The smallest scaled variant of a picture, for small pictures such as the typeahead's; SVG stays as it is. */
export function smallSrc({ src }: Picture): string {
  let file = scalable(src)
  return file ? `${file.folder}/${MEDIA_WIDTHS[0]}${file.ext}.webp` : src
}

/**
 * Pictures by file object ID from objects the API delivered (the `refs` of a read with `resolve`): a content object only
 * holds the file object's ID, and the hash that names the file is on that object. An image without hash or extension has no file and is left out.
 */
export function toPictures(objs: NovaObject[]): Map<number, Picture> {
  let pictures = new Map<number, Picture>()
  for (let { meta, props } of objs) {
    if (!props[IMAGE.md5] || !props[IMAGE.extension]) continue
    pictures.set(meta.id, pictureOf(`/media/${props[IMAGE.md5]}/original${props[IMAGE.extension]}`))
  }
  return pictures
}

/** The pictures of pages and documents, whose IDs are known beforehand (a document node names its image by ID). The type is language-neutral, `en-US` only satisfies the request. */
export async function picturesByIds(ids: number[]): Promise<Map<number, Picture>> {
  if (!ids.length) return new Map()
  return toPictures((await list(TYPE.image, { lang: 'en-US', filter: `meta.id = ${ids.join(', ')}` })).objs)
}
