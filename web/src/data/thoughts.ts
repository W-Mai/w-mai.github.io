// Thought data definitions — short-form timeline entries

export interface Thought {
  content: string;
  createdAt: string;
  tags?: string[];
  mood?: string;
}

export const THOUGHTS: readonly Thought[] = [
  {
    content: '「怼点想法」上线了，以后脑子里蹦出来的碎碎念就往这儿怼 🎉',
    createdAt: '2026-03-11',
    tags: ['公告'],
    mood: '🎉',
  },
  {
    content: '发现 CM6 的 block widget 用 `margin` 会导致光标定位偏移，因为 `offsetHeight` 不包含 margin。改成外层 padding wrapper 就好了。又一个「知道了就简单，不知道能卡一天」的坑。:sticker[getimgdata-10.jpg]:',
    createdAt: '2026-03-11',
    tags: ['CodeMirror', '踩坑'],
    mood: '🤔',
  },
  {
    content: '新拟态的核心原则：**凸起的元素放在凹陷的容器里**，中间要留够呼吸空间让阴影渲染。同心圆法则：`inner_radius = outer_radius - padding`。',
    createdAt: '2020-04-01',
    tags: ['设计', 'Neumorphism'],
    mood: '✨',
  },
] as const;
