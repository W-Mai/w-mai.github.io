// Thought data definitions — short-form timeline entries

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { yamlToThought } from '../lib/thought-utils';

export interface Thought {
  id: string;
  content: string;
  createdAt: string;
  tags?: string[];
  mood?: string;
}

const thoughtsDir = resolve(process.cwd(), '..', 'thoughts');

/** Load all thoughts from YAML files, sorted by createdAt descending */
export async function loadThoughts(): Promise<Thought[]> {
  let files: string[];
  try {
    files = (await readdir(thoughtsDir)).filter((f) => f.endsWith('.yaml'));
  } catch {
    return [];
  }

  const thoughts: Thought[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(resolve(thoughtsDir, file), 'utf-8');
      const data = yamlToThought(raw);
      if (data) {
        thoughts.push({ id: file.replace(/\.yaml$/, ''), ...data });
      } else {
        console.warn(`[thoughts] Invalid YAML: ${file}`);
      }
    } catch {
      console.warn(`[thoughts] Failed to read: ${file}`);
    }
  }

  return thoughts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
