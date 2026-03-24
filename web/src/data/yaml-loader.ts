// Generic YAML collection loader for directory-based data sources.

import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export interface YamlLoaderOptions<T> {
  /** Absolute path to the directory containing YAML files */
  dir: string;
  /** Parse raw YAML string into typed data (without id). Returns null to skip. */
  parser: (raw: string) => Omit<T, 'id'> | null;
  /** Sort comparator for the final array */
  sorter?: (a: T, b: T) => number;
  /** Label used in warning messages */
  label: string;
}

/** Load all YAML files from a directory, parse, assign id from filename, sort. */
export async function loadYamlCollection<T extends { id: string }>(
  options: YamlLoaderOptions<T>,
): Promise<T[]> {
  const { dir, parser, sorter, label } = options;

  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.yaml'));
  } catch {
    return [];
  }

  const items: T[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(resolve(dir, file), 'utf-8');
      const data = parser(raw);
      if (data) {
        items.push({ id: file.replace(/\.yaml$/, ''), ...data } as T);
      } else {
        console.warn(`[${label}] Invalid YAML: ${file}`);
      }
    } catch {
      console.warn(`[${label}] Failed to read: ${file}`);
    }
  }

  if (sorter) items.sort(sorter);
  return items;
}
