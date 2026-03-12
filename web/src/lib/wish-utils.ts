import { parse } from 'yaml';
import type { Wish, WishStatus } from '../data/wishes';

type WishData = Omit<Wish, 'id'>;

const VALID_STATUSES: WishStatus[] = ['wish', 'doing', 'done'];

/** Parse YAML string into a Wish (without id) */
export function yamlToWish(yaml: string): WishData | null {
  try {
    const data = parse(yaml);
    if (!data || typeof data.title !== 'string' || !data.title.trim()) return null;
    if (!VALID_STATUSES.includes(data.status)) return null;
    return {
      title: data.title,
      status: data.status,
      category: typeof data.category === 'string' ? data.category : 'other',
      createdAt: typeof data.createdAt === 'string' ? data.createdAt
        : data.createdAt instanceof Date ? data.createdAt.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      doneAt: typeof data.doneAt === 'string' ? data.doneAt
        : data.doneAt instanceof Date ? data.doneAt.toISOString().slice(0, 10)
        : undefined,
      note: typeof data.note === 'string' ? data.note : undefined,
    };
  } catch {
    return null;
  }
}

/** Status emoji mapping */
export function statusEmoji(status: WishStatus): string {
  return { wish: '✨', doing: '🔨', done: '✅' }[status];
}

/** Status label mapping */
export function statusLabel(status: WishStatus): string {
  return { wish: '想做', doing: '在搞', done: '搞定了' }[status];
}
