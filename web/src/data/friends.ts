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
    name: 'Wcowin',
    url: 'https://wcowin.work',
    avatar: 'https://avatars.githubusercontent.com/Wcowin',
    description: '循此苦旅，以达星辰。技术博客作者，OneClip 开发者，MkDocs 主题爱好者。',
    tags: ['博客', '开源', 'OneClip'],
  },
  {
    name: 'MickeyMiao',
    url: 'https://blog.mickeymiao.cn',
    avatar: 'https://avatars.githubusercontent.com/WangSimiao2000',
    description: 'Leeds 图形学硕士，热爱 Minecraft 和图形渲染，擅长 C++/OpenGL 体素引擎与光线追踪。',
    tags: ['图形学', '渲染', 'C++', 'Minecraft'],
  },
  {
    name: 'Lazy_V',
    url: 'https://zzxzzk115.github.io/blog/',
    avatar: 'https://avatars.githubusercontent.com/zzxzzk115',
    description: 'Leeds PhD，研究感知图形学（VR & 高性能图形），游戏引擎与图形学爱好者。',
    tags: ['图形学', 'VR', 'C++', '游戏引擎'],
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
