import { MAX_PHOTO_CHARS } from '../social/types'

/** Shrink a chosen picture to a small centred square so it's cheap to store and send. Returns a JPEG data URL. */
export async function photoToAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.')
  const bitmap = await createImageBitmap(file)
  try {
    for (const [size, quality] of [[96, 0.8], [96, 0.6], [80, 0.5], [64, 0.5]] as const) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Couldn’t process that picture.')
      const side = Math.min(bitmap.width, bitmap.height)
      ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
      const url = canvas.toDataURL('image/jpeg', quality)
      if (url.length <= MAX_PHOTO_CHARS) return url
    }
    throw new Error('That picture is too detailed to shrink. Try another.')
  } finally {
    bitmap.close()
  }
}
