import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { stringify } from 'yaml';

// Hardcoded thoughts to migrate
const THOUGHTS = [
  {
    content: '「怼点想法」上线了，以后脑子里蹦出来的碎碎念就往这儿怼 🎉',
    createdAt: '2026-03-11T10:00:00',
    tags: ['公告'],
    mood: '🎉',
  },
  {
    content: '发现 CM6 的 block widget 用 `margin` 会导致光标定位偏移，因为 `offsetHeight` 不包含 margin。改成外层 padding wrapper 就好了。又一个「知道了就简单，不知道能卡一天」的坑。:sticker[getimgdata-10.jpg]:',
    createdAt: '2026-03-11T09:00:00',
    tags: ['CodeMirror', '踩坑'],
    mood: '🤔',
  },
  {
    content: '新拟态的核心原则：**凸起的元素放在凹陷的容器里**，中间要留够呼吸空间让阴影渲染。同心圆法则：`inner_radius = outer_radius - padding`。',
    createdAt: '2020-04-01T00:00:00',
    tags: ['设计', 'Neumorphism'],
    mood: '✨',
  },
];

const thoughtsDir = resolve(import.meta.dir, '..', '..', 'thoughts');
mkdirSync(thoughtsDir, { recursive: true });

for (const t of THOUGHTS) {
  const d = new Date(t.createdAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const id = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const filename = `${id}.yaml`;

  const obj: Record<string, unknown> = {
    content: t.content,
    createdAt: t.createdAt,
  };
  if (t.tags && t.tags.length > 0) obj.tags = t.tags;
  if (t.mood) obj.mood = t.mood;

  const yaml = stringify(obj);
  writeFileSync(resolve(thoughtsDir, filename), yaml, 'utf-8');
  console.log(`✅ ${filename}`);
}

console.log(`\nMigrated ${THOUGHTS.length} thoughts to ${thoughtsDir}`);
