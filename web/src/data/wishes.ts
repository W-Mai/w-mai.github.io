import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { yamlToWish } from '../lib/wish-utils';

export type WishStatus = 'wish' | 'doing' | 'done';

export interface Wish {
  id: string;
  title: string;
  status: WishStatus;
  category: string;
  createdAt: string;
  doneAt?: string;
  note?: string;
}

const wishesDir = resolve(process.cwd(), '..', 'wishes');

/** Load all wishes from YAML files, sorted by status priority then createdAt desc */
export async function loadWishes(): Promise<Wish[]> {
  let files: string[];
  try {
    files = (await readdir(wishesDir)).filter((f) => f.endsWith('.yaml'));
  } catch {
    return [];
  }

  const wishes: Wish[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(resolve(wishesDir, file), 'utf-8');
      const data = yamlToWish(raw);
      if (data) {
        wishes.push({ id: file.replace(/\.yaml$/, ''), ...data });
      }
    } catch {
      console.warn(`[wishes] Failed to read: ${file}`);
    }
  }

  const order: Record<WishStatus, number> = { doing: 0, wish: 1, done: 2 };
  return wishes.sort((a, b) =>
    order[a.status] - order[b.status]
    || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
