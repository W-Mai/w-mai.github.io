// Wish data — loaded from YAML files in wishes/ directory

import { resolve } from 'node:path';
import { yamlToWish } from '../lib/wish';
import { loadYamlCollection } from './yaml-loader';

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

const STATUS_ORDER: Record<WishStatus, number> = { doing: 0, wish: 1, done: 2 };

/** Load all wishes from YAML files, sorted by status priority then createdAt desc */
export async function loadWishes(): Promise<Wish[]> {
  return loadYamlCollection<Wish>({
    dir: wishesDir,
    parser: yamlToWish,
    sorter: (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
      || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    label: 'wishes',
  });
}
