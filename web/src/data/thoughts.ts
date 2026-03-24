// Thought data definitions — short-form timeline entries

import { resolve } from 'node:path';
import { yamlToThought } from '../lib/thought-utils';
import { loadYamlCollection } from './yaml-loader';

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
  return loadYamlCollection<Thought>({
    dir: thoughtsDir,
    parser: yamlToThought,
    sorter: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    label: 'thoughts',
  });
}
