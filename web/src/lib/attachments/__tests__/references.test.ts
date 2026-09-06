import { mkdtemp, mkdir, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findAttachmentReferences, AttachmentReferenceScanError } from '../references';
import type { AttachmentOptions } from '../paths';

let root: string;
let options: AttachmentOptions;
let directories: { postsDirectory: string; thoughtsDirectory: string };

async function source(path: string, value: string) {
  const file = join(root, path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, value);
  return file;
}

beforeEach(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'attachment-references-')));
  options = { directory: join(root, 'attachments'), base: '/journal/', site: 'https://example.test' };
  directories = { postsDirectory: join(root, 'posts'), thoughtsDirectory: join(root, 'thoughts') };
});

afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('attachment reference protection', () => {
  it('finds shared logical references after Markdown entity and escape decoding', async () => {
    await source('posts/first.md', '---\ntitle: fixture\n---\n\n[One](attachment&#58;group/a%20%26%20b.csv)\n');
    await source('posts/nested/second.mdx', '[Two](attachment\\:group/a%20%26%20b.csv)\n');
    const references = await findAttachmentReferences('group/a & b.csv', options, directories);
    expect(references.map(({ path, line, column }) => ({ path, line, column }))).toEqual([
      { path: 'posts/first.md', line: 5, column: 1 },
      { path: 'posts/nested/second.mdx', line: 1, column: 1 },
    ]);
    expect(references.every((reference) => reference.reference === 'attachment:group/a%20%26%20b.csv')).toBe(true);
    expect(JSON.stringify(references)).not.toContain(root);
  });

  it('counts only used definitions and respects the first case-insensitive definition', async () => {
    await source('posts/references.md', [
      '[First][DATA]', '[data][]', '[data]', '![Image][data]', '',
      '[data]: attachment:group/used.csv',
      '[DATA]: attachment:group/shadowed.csv',
      '[unused]: attachment:group/unused.csv',
    ].join('\n'));
    expect(await findAttachmentReferences('group/used.csv', options, directories)).toHaveLength(4);
    expect(await findAttachmentReferences('group/shadowed.csv', options, directories)).toEqual([]);
    expect(await findAttachmentReferences('group/unused.csv', options, directories)).toEqual([]);
  });

  it('excludes frontmatter, inline code, fenced examples and unused malformed definitions', async () => {
    await source('posts/examples.mdx', [
      '---', "description: '[example](attachment:group/file.csv)'", '---', '',
      '`[example](attachment:group/file.csv)`', '', '```md',
      '[example](attachment:group/file.csv)', '[bad](attachment:../bad)', '```', '',
      '[unused]: attachment:../bad',
    ].join('\n'));
    expect(await findAttachmentReferences('group/file.csv', options, directories)).toEqual([]);
  });

  it('recognizes the current base and same-site absolute URLs with queries and fragments', async () => {
    await source('posts/urls.md', [
      '[one](/journal/downloads/group/file.csv?raw=1&amp;v=2#part)',
      '[two](https://example.test/journal/downloads/group/file.csv)',
      '[three](//example.test/journal/downloads/group/file.csv)',
      '![image](/journal/downloads/group/file.csv)',
      '[external](https://elsewhere.test/journal/downloads/group/file.csv)',
      '[wrong-base](/downloads/group/file.csv)',
      '[prefix](/journal-other/downloads/group/file.csv)',
      '[plain-relative](group/file.csv)',
    ].join('\n'));
    expect(await findAttachmentReferences('group/file.csv', options, directories)).toHaveLength(4);
    options.base = '/';
    expect(await findAttachmentReferences('group/file.csv', options, directories)).toMatchObject([
      { reference: '/downloads/group/file.csv' },
    ]);
  });

  it('decodes attachment filename segments once, retaining literal percent signs', async () => {
    await source('posts/encoded.md', '[one](/journal/downloads/group/%2520.csv)\n[two](attachment:group/%2520.csv)');
    expect(await findAttachmentReferences('group/%20.csv', options, directories)).toHaveLength(2);
    expect(await findAttachmentReferences('group/ .csv', options, directories)).toEqual([]);
  });

  it('protects files referenced by attachment README relative links across directories', async () => {
    await source('attachments/group/README.md', [
      '[algorithm](algorithms/bench.rs)',
      '[shared](../shared/data%20set.csv?raw=1#section)',
      '[ignored](https://elsewhere.test/downloads/shared/data%20set.csv)',
      '`[example](../unused.csv)`',
    ].join('\n'));
    await source('attachments/group/docs/details.md', '[algorithm](../algorithms/bench.rs)');
    expect(await findAttachmentReferences('group/algorithms/bench.rs', options, directories)).toMatchObject([
      { path: 'attachments/group/README.md', line: 1, reference: 'algorithms/bench.rs' },
      { path: 'attachments/group/docs/details.md', line: 1, reference: '../algorithms/bench.rs' },
    ]);
    expect(await findAttachmentReferences('shared/data set.csv', options, directories)).toHaveLength(1);
    expect(await findAttachmentReferences('unused.csv', options, directories)).toEqual([]);
  });

  it('ignores README page fragments while protecting file URLs with fragments', async () => {
    await source('attachments/group/README.md', [
      '[section](#section)',
      '[encoded fragment](&#35;section)',
      '[reference][local]',
      '',
      '[local]: #section',
    ].join('\n'));
    expect(await findAttachmentReferences('group/README.md', options, directories)).toEqual([]);
    await source('posts/readme.md', [
      '[readme](/journal/downloads/group/README.md#section)',
      '[absolute](https://example.test/journal/downloads/group/README.md#section)',
    ].join('\n'));
    expect(await findAttachmentReferences('group/README.md', options, directories)).toMatchObject([
      { path: 'posts/readme.md', reference: '/journal/downloads/group/README.md#section' },
      { path: 'posts/readme.md', reference: 'https://example.test/journal/downloads/group/README.md#section' },
    ]);
  });

  it('scans only thought content and provides literal-block source locations', async () => {
    await source('thoughts/nested/note.yaml', [
      'createdAt: today', 'content: |', '  Intro', '  [file](attachment:group/file.csv)',
      'other: "[ignored](attachment:group/other.csv)"',
    ].join('\n'));
    const references = await findAttachmentReferences('group/file.csv', options, directories);
    expect(references).toMatchObject([
      { path: 'thoughts/nested/note.yaml', line: 4, column: 3, contentLine: 2 },
    ]);
    expect(await findAttachmentReferences('group/other.csv', options, directories)).toEqual([]);
  });

  it('keeps folded and escaped YAML references tied to their scalar and content line', async () => {
    await source('thoughts/escaped.yml', 'content: "Intro\\n[file](attachment:group/file.csv)"');
    await source('thoughts/folded.yml', 'content: >\n  Intro\n  [file](attachment:group/file.csv)\n');
    const references = await findAttachmentReferences('group/file.csv', options, directories);
    expect(references).toHaveLength(2);
    expect(references).toMatchObject([
      { path: 'thoughts/escaped.yml', line: 1, contentLine: 2 },
      { path: 'thoughts/folded.yml', line: 1, contentLine: 1 },
    ]);
  });

  it.each([
    ['posts/broken.mdx', '{ unfinished'],
    ['thoughts/broken.yaml', 'content: [unfinished'],
    ['thoughts/broken.yaml', 'content: [wrong, type]'],
    ['posts/broken.md', '[unsafe](attachment:../private)'],
    ['posts/broken.md', '[unsafe](/journal/downloads/group%2Ffile.csv)'],
  ])('fails closed when %s cannot be safely analyzed', async (path, value) => {
    await source(path, value);
    let error: unknown;
    try { await findAttachmentReferences('unrelated.csv', options, directories); } catch (caught) { error = caught; }
    expect(error).toBeInstanceOf(AttachmentReferenceScanError);
    expect(error).toMatchObject({ status: 409 });
    expect(String(error)).toContain(path);
    expect(String(error)).not.toContain(root);
  });

  it('fails closed on symbolic links without exposing the machine path', async () => {
    const external = await source('private.md', '[file](attachment:group/file.csv)');
    await mkdir(directories.postsDirectory);
    await symlink(external, join(directories.postsDirectory, 'linked.md'));
    await expect(findAttachmentReferences('group/file.csv', options, directories))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining('posts/linked.md') });
    await expect(findAttachmentReferences('group/file.csv', options, directories))
      .rejects.not.toThrow(root);
  });

  it('fails closed when a configured source root is a file', async () => {
    await source('posts', 'not a directory');
    await expect(findAttachmentReferences('group/file.csv', options, directories))
      .rejects.toMatchObject({ status: 409, message: expect.stringContaining('Source root must be a directory') });
  });

  it('treats absent content directories as empty and does not depend on target existence', async () => {
    expect(await findAttachmentReferences('group/missing.csv', options, directories)).toEqual([]);
    await source('posts/post.md', '[file](attachment:group/missing.csv)');
    expect(await findAttachmentReferences('group/missing.csv', options, directories)).toHaveLength(1);
  });
});
