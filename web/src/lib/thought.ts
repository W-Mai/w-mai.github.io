import { parse, stringify } from 'yaml';
import type { Thought } from '../data/thoughts';
import { thoughtSchema } from '../data/schemas';

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
    const raw = parse(yaml);
    const result = thoughtSchema.safeParse(raw);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

/** Generate a filename-safe ID from a createdAt string (YYYY-MM-DDTHH:mm:ss) */
export function generateThoughtId(createdAt: string): string {
  const m = createdAt.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}-${m[4]}${m[5]}${m[6]}`;
  // Fallback: date-only format
  const d = createdAt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (d) return `${d[1]}-${d[2]}-${d[3]}-000000`;
  return `${Date.now()}`;
}

/** Validate raw input for creating/updating a thought (createdAt is server-generated) */
export function validateThought(data: unknown): { valid: boolean; error?: string } {
  const inputSchema = thoughtSchema.omit({ createdAt: true });
  const result = inputSchema.safeParse(data);
  if (!result.success) return { valid: false, error: result.error.issues[0]?.message ?? 'Invalid data' };
  return { valid: true };
}
