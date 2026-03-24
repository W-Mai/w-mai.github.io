import { parse } from 'yaml';
import type { Wish, WishStatus } from '../data/wishes';
import { wishSchema } from '../data/schemas';

type WishData = Omit<Wish, 'id'>;

/** Parse YAML string into a Wish (without id) */
export function yamlToWish(yaml: string): WishData | null {
  try {
    const raw = parse(yaml);
    const result = wishSchema.safeParse(raw);
    if (!result.success) return null;
    return result.data as WishData;
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
