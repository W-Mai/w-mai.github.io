// Friend link data definitions with compile-time type safety

export interface FriendLink {
  name: string;
  url: string;
  avatar: string;
  description: string;
  tags?: string[];
}

export const FRIENDS: readonly FriendLink[] = [
  {
    name: 'LVY NEKO',
    url: 'https://lvyovo-wiki.tech',
    avatar: 'https://avatars.githubusercontent.com/lvy010',
    description: '休闲码农 & 开源爱好者，CS 本科在读，喜欢 VS Code TvT，乐于为有趣的项目贡献代码。',
    tags: ['开源', 'CS', 'LVGL', 'openvela', 'VSCode'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
  {
    name: '虚位以待',
    url: '#',
    avatar: '',
    description: '这里空着一个位置，等你来填～',
    tags: ['占位'],
  },
] as const;
