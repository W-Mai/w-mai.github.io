/**
 * Centralized type definitions for editor API endpoints.
 * All editor route handlers should reference these types
 * to ensure consistent request/response shapes.
 */

// ── Shared response wrappers ───────────────────────────────────────────────

/** Standard success response with optional payload */
export interface ApiSuccess<T = void> {
  success: true
  [key: string]: unknown
}

/** Standard error response */
export interface ApiError {
  error: string
}

// ── Thoughts API (/api/editor/thoughts) ────────────────────────────────────

export interface ThoughtPayload {
  content: string
  tags?: string[]
  mood?: string
}

export interface ThoughtRecord {
  id: string
  content: string
  createdAt: string
  tags?: string[]
  mood?: string
}

// ── Posts API (/api/editor/posts) ──────────────────────────────────────────

export interface PostCreatePayload {
  title?: string
}

export interface PostUpdatePayload {
  content: string
}

export interface PostRenamePayload {
  newSlug: string
}

// ── Assets API (/api/editor/assets) ────────────────────────────────────────

export interface AssetInfo {
  name: string
  size: number
  ext: string
  refCount: number
  referencedBy: string[]
}

// ── Stickers API (/api/editor/stickers) ────────────────────────────────────

export interface StickerInfo {
  name: string
  size: number
  meta?: StickerMetaInfo
}

export interface StickerMetaInfo {
  filename: string
  aiName?: string
  description?: string
  tags?: string[]
}

export interface StickerMetaUpdatePayload {
  filename: string
  meta: Partial<StickerMetaInfo>
}

// ── AI API (/api/editor/ai) ────────────────────────────────────────────────

export interface AiChatPayload {
  messages: AiMessage[]
}

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ── Categories API (/api/editor/categories) ────────────────────────────────

/** PUT payload: array of category strings */
export type CategoriesPayload = string[]

// ── Env API (/api/editor/env) ──────────────────────────────────────────────

/** GET response / PUT payload: key-value env vars */
export type EnvPayload = Record<string, string>

// ── Git API (/api/editor/git, /api/editor/thoughts-git) ───────────────────

export interface GitCommitPayload {
  message: string
}

export interface GitStatusFile {
  path: string
  status: string
}

// ── Diagram Layout API (/api/editor/diagram-layout) ────────────────────────

export type DiagramLayoutPayload = Record<string, { x: number; y: number }>

// ── Suggest Tags API (/api/editor/thoughts/suggest-tags) ───────────────────

export interface SuggestTagsPayload {
  content: string
  existingTags?: string[]
}

export interface SuggestTagsResponse {
  tags: string[]
}
