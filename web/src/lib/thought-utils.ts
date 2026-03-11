import { parse, stringify } from 'yaml';
import type { Thought } from '../data/thoughts';

// Omit `id` — it's derived from filename, not stored in YAML
type ThoughtData = Omit<Thought, 'id'>;

/** Serialize a thought to YAML string */
export function thoughtToYaml(thought: ThoughtData): string {
  const obj: Record<string, unknown> = {
    content: thought.content,
    createdAt: thought.createdAt,
  };
  if (thought.tags && thought.tags.length > 0) obj.tags = thought.tags;
  if (thought.mood) obj.mood = thought.mood;
  return stringify(obj);
}

/** Parse YAML string into a Thought (without id) */
export function yamlToThought(yaml: string): ThoughtData | null {
  try {
    const data = parse(yaml);
    if (!data || typeof data.content !== 'string' || !data.content.trim()) return null;
    if (typeof data.createdAt !== 'string' || isNaN(Date.parse(data.createdAt))) return null;
    return {
      content: data.content,
      createdAt: data.createdAt,
      tags: Array.isArray(data.tags) ? data.tags.filter((t: unknown) => typeof t === 'string') : undefined,
      mood: typeof data.mood === 'string' ? data.mood : undefined,
    };
  } catch {
    return null;
  }
}

/** Generate a filename-safe ID from a createdAt string */
export function generateThoughtId(createdAt: string): string {
  const d = new Date(createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Validate raw input for creating/updating a thought */
export function validateThought(data: unknown): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') return { valid: false, error: 'Invalid request body' };
  const d = data as Record<string, unknown>;
  if (typeof d.content !== 'string' || !d.content.trim()) return { valid: false, error: 'content is required' };
  if (d.tags !== undefined && !Array.isArray(d.tags)) return { valid: false, error: 'tags must be an array' };
  if (d.mood !== undefined && typeof d.mood !== 'string') return { valid: false, error: 'mood must be a string' };
  return { valid: true };
}
