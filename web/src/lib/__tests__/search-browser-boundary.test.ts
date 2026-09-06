import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('browser search dependency boundary', () => {
  it('keeps build-time Markdown parsers out of the lazy browser engine', () => {
    const enginePath = fileURLToPath(new URL('../search/engine.ts', import.meta.url));
    const source = readFileSync(enginePath, 'utf8');
    expect(source).not.toMatch(/attachments\/text|search\/content|from ['"](?:unified|remark-)/);
  });
});
