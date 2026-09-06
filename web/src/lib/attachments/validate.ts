import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { VFile } from 'vfile';
import { parseDocument } from 'yaml';
import remarkAttachments from '../markdown/remark-attachments';
import type { AttachmentOptions } from './paths';

export interface AttachmentContentDirectories {
  postsDirectory: string;
  thoughtsDirectory?: string;
}

/** Preserve source line numbers while excluding YAML from Markdown parsing. */
function withoutFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, (block) =>
    block.replace(/[^\r\n]/g, ' '),
  );
}

/** Validate actual Markdown links, excluding code examples and unused definitions. */
export async function validateAttachmentMarkdown(
  content: string,
  options: AttachmentOptions,
  source: { file: string; mdx?: boolean },
): Promise<void> {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
  if (source.mdx) processor.use(remarkMdx);
  processor.use(remarkAttachments, options);
  const file = new VFile({ path: source.file, value: withoutFrontmatter(content) });
  await processor.run(processor.parse(file), file);
}

async function collectFiles(directory: string, extensions: Set<string>): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return files;
    throw error;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.')) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path, extensions));
    else if (entry.isFile() && extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

/** Re-read sources before every build so cached MDX cannot hide a missing file. */
export async function validateAttachmentContentFiles(
  options: AttachmentOptions,
  directories: AttachmentContentDirectories,
): Promise<void> {
  const issues: string[] = [];
  const posts = await collectFiles(directories.postsDirectory, new Set(['.md', '.mdx']));
  for (const file of posts) {
    try {
      await validateAttachmentMarkdown(await readFile(file, 'utf8'), options, {
        file,
        mdx: extname(file) === '.mdx',
      });
    } catch (error) {
      issues.push(String(error));
    }
  }
  if (directories.thoughtsDirectory) {
    const thoughts = await collectFiles(directories.thoughtsDirectory, new Set(['.yaml', '.yml']));
    for (const file of thoughts) {
      const raw = await readFile(file, 'utf8');
      try {
        const document = parseDocument(raw);
        if (document.errors.length) throw document.errors[0];
        const content = document.get('content');
        if (typeof content === 'string') {
          await validateAttachmentMarkdown(content, options, { file: `${file} (content)` });
        }
      } catch (error) {
        issues.push(`${file}: ${String(error)}`);
      }
    }
  }
  if (issues.length) throw new Error(`Invalid attachment references:\n${issues.join('\n')}`);
}
