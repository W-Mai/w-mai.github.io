// Shared sticker utilities for remark plugin, rehype plugin, and OG image generation.

import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const INLINE_STICKER_RE = /:sticker\[([^\]]+)\]:/g;
export const BLOCK_STICKER_RE = /^::sticker\[([^\]]+)\]::$/;

export const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

// web/src/lib/ → project root (three levels up)
const LIB_DIR = typeof __filename !== 'undefined'
  ? resolve(__dirname, '..', '..', '..')
  : resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');

export const STICKERS_DIR = resolve(LIB_DIR, 'assets', 'stickers');

export function getMimeType(filePath: string): string {
  return MIME_MAP[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/** Read a file as base64 data URI. Returns null if file doesn't exist. */
export function readFileAsBase64DataUri(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  try {
    const buf = readFileSync(filePath);
    const mime = getMimeType(filePath);
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Load a sticker by name, returning data URI and raw buffer. */
export function loadSticker(name: string): { uri: string; buf: Buffer } | null {
  const filePath = resolve(STICKERS_DIR, name);
  if (!existsSync(filePath)) return null;
  try {
    const buf = readFileSync(filePath);
    const mime = getMimeType(filePath);
    return { uri: `data:${mime};base64,${buf.toString('base64')}`, buf };
  } catch {
    return null;
  }
}

/** Extract image dimensions from GIF/PNG/JPEG header bytes. */
export function imageDimensions(buf: Buffer): { w: number; h: number } | null {
  // GIF: bytes 6-9
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  }
  // PNG: bytes 16-23
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG: scan for SOF0/SOF2 marker
  let i = 2;
  while (i < buf.length - 8) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) {
      return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/** Compute width/height that fit within maxSize while preserving aspect ratio. */
export function fitSize(
  dim: { w: number; h: number } | null,
  maxSize: number,
): { width: number; height: number } {
  if (!dim || dim.w === 0 || dim.h === 0) return { width: maxSize, height: maxSize };
  const ratio = dim.w / dim.h;
  if (ratio >= 1) return { width: maxSize, height: Math.round(maxSize / ratio) };
  return { width: Math.round(maxSize * ratio), height: maxSize };
}
