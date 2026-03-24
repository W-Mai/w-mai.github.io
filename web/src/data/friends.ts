// Friend link data — loaded from YAML files in friends/ directory

import { resolve } from 'node:path';
import { parse } from 'yaml';
import { friendSchema } from './schemas';
import { loadYamlCollection } from './yaml-loader';

export interface FriendLink {
  id: string;
  name: string;
  url: string;
  avatar: string;
  description: string;
  tags?: string[];
}

const friendsDir = resolve(process.cwd(), '..', 'friends');

/** Parse raw YAML string into FriendLink data (without id) */
function parseFriend(raw: string): Omit<FriendLink, 'id'> | null {
  try {
    const data = parse(raw);
    const result = friendSchema.safeParse(data);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

/** Placeholder entries for empty slots */
const PLACEHOLDER: Omit<FriendLink, 'id'> = {
  name: '虚位以待',
  url: '#',
  avatar: '',
  description: '这里空着一个位置，等你来填～',
  tags: ['占位'],
};

const PLACEHOLDER_COUNT = 7;

/** Load all friends from YAML files, sorted by filename, with placeholder padding */
export async function loadFriends(): Promise<FriendLink[]> {
  const friends = await loadYamlCollection<FriendLink>({
    dir: friendsDir,
    parser: parseFriend,
    label: 'friends',
  });

  // Sort by id (filename) for stable ordering
  friends.sort((a, b) => a.id.localeCompare(b.id));

  // Pad with placeholders to fill the grid
  const totalSlots = Math.max(PLACEHOLDER_COUNT, friends.length);
  const placeholderCount = totalSlots - friends.length;
  for (let i = 0; i < placeholderCount; i++) {
    friends.push({ id: `placeholder-${i}`, ...PLACEHOLDER });
  }

  return friends;
}
