// Friend link data — loaded from YAML files in friends/ directory

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'yaml';

export interface FriendLink {
  id: string;
  name: string;
  url: string;
  avatar: string;
  description: string;
  tags?: string[];
}

const friendsDir = resolve(process.cwd(), '..', 'friends');

/** Parse a single YAML file into a FriendLink (without id) */
function yamlToFriend(yaml: string): Omit<FriendLink, 'id'> | null {
  try {
    const data = parse(yaml);
    if (!data || typeof data.name !== 'string') return null;
    return {
      name: data.name,
      url: typeof data.url === 'string' ? data.url : '#',
      avatar: typeof data.avatar === 'string' ? data.avatar : '',
      description: typeof data.description === 'string' ? data.description : '',
      tags: Array.isArray(data.tags) ? data.tags.filter((t: unknown) => typeof t === 'string') : undefined,
    };
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
  let files: string[];
  try {
    files = (await readdir(friendsDir)).filter(f => f.endsWith('.yaml')).sort();
  } catch {
    return [];
  }

  const friends: FriendLink[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(resolve(friendsDir, file), 'utf-8');
      const data = yamlToFriend(raw);
      if (data) {
        friends.push({ id: file.replace(/\.yaml$/, ''), ...data });
      }
    } catch {
      console.warn(`[friends] Failed to read: ${file}`);
    }
  }

  // Pad with placeholders to fill the grid
  const totalSlots = Math.max(PLACEHOLDER_COUNT, friends.length);
  const placeholderCount = totalSlots - friends.length;
  for (let i = 0; i < placeholderCount; i++) {
    friends.push({ id: `placeholder-${i}`, ...PLACEHOLDER });
  }

  return friends;
}
