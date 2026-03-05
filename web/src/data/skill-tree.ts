// Skill tree data definitions with compile-time type safety

export interface SkillDomain {
  id: string;
  name: string;
  icon: string;
}

export interface SkillCategory {
  id: string;
  name: string;
  domainId: string;
}

export interface SkillNode {
  id: string;
  name: string;
  icon?: string;
  categoryId: string;
  detail?: string;
  status?: 'learned' | 'learning' | 'blocked';
}

export interface SkillEdge {
  source: string;
  target: string;
}

export interface SkillTreeData {
  domains: readonly SkillDomain[];
  categories: readonly SkillCategory[];
  nodes: readonly SkillNode[];
  edges: readonly SkillEdge[];
}

// --- Domain definitions ---
const DOMAINS = [
  { id: 'programming', name: '编程', icon: '💻' },
  { id: 'life', name: '生活', icon: '🌱' },
  { id: 'creative', name: '创意', icon: '🎨' },
] as const;

type DomainId = (typeof DOMAINS)[number]['id'];

// --- Category definitions ---
const CATEGORIES = [
  { id: 'frontend', name: '前端', domainId: 'programming' as DomainId },
  { id: 'backend', name: '后端', domainId: 'programming' as DomainId },
  { id: 'systems', name: '系统', domainId: 'programming' as DomainId },
  { id: 'devops', name: 'DevOps', domainId: 'programming' as DomainId },
  { id: 'sports', name: '运动', domainId: 'life' as DomainId },
  { id: 'cooking', name: '烹饪', domainId: 'life' as DomainId },
  { id: 'daily', name: '日常', domainId: 'life' as DomainId },
  { id: 'visual', name: '视觉', domainId: 'creative' as DomainId },
  { id: 'media', name: '媒体', domainId: 'creative' as DomainId },
] as const;

type CategoryId = (typeof CATEGORIES)[number]['id'];

// --- Node definitions ---
const NODES = [
  // Frontend
  { id: 'html-css', name: 'HTML/CSS', icon: '🌐', categoryId: 'frontend' as CategoryId },
  { id: 'javascript', name: 'JavaScript', icon: '📜', categoryId: 'frontend' as CategoryId, detail: '主力语言之一' },
  { id: 'typescript', name: 'TypeScript', icon: '🔷', categoryId: 'frontend' as CategoryId, detail: '日常开发首选' },
  { id: 'react', name: 'React', icon: '⚛️', categoryId: 'frontend' as CategoryId },
  { id: 'vue', name: 'Vue', icon: '💚', categoryId: 'frontend' as CategoryId },
  { id: 'astro', name: 'Astro', icon: '🚀', categoryId: 'frontend' as CategoryId, detail: '本站就是用 Astro 搭的', status: 'learning' },
  { id: 'tailwind', name: 'Tailwind', icon: '🎐', categoryId: 'frontend' as CategoryId },

  // Backend
  { id: 'python', name: 'Python', icon: '🐍', categoryId: 'backend' as CategoryId, detail: '万能胶水语言' },
  { id: 'nodejs', name: 'Node.js', icon: '💚', categoryId: 'backend' as CategoryId },
  { id: 'rust', name: 'Rust', icon: '🦀', categoryId: 'backend' as CategoryId, detail: '安全与性能兼得', status: 'learning' },
  { id: 'go', name: 'Go', icon: '🐹', categoryId: 'backend' as CategoryId, status: 'learning' },
  { id: 'java', name: 'Java', icon: '☕', categoryId: 'backend' as CategoryId },

  // Systems
  { id: 'c-lang', name: 'C', icon: '⚙️', categoryId: 'systems' as CategoryId },
  { id: 'cpp', name: 'C++', icon: '🔧', categoryId: 'systems' as CategoryId },
  { id: 'embedded', name: '嵌入式', icon: '🔌', categoryId: 'systems' as CategoryId, detail: 'MCU / RTOS' },
  { id: 'linux', name: 'Linux', icon: '🐧', categoryId: 'systems' as CategoryId },

  // DevOps
  { id: 'docker', name: 'Docker', icon: '🐳', categoryId: 'devops' as CategoryId },
  { id: 'k8s', name: 'Kubernetes', icon: '☸️', categoryId: 'devops' as CategoryId, status: 'learning' },
  { id: 'git', name: 'Git', icon: '📦', categoryId: 'devops' as CategoryId },
  { id: 'cicd', name: 'CI/CD', icon: '🔄', categoryId: 'devops' as CategoryId },

  // Sports
  { id: 'cycling', name: '骑行', icon: '🚴', categoryId: 'sports' as CategoryId, detail: '公路车爱好者' },
  { id: 'swimming', name: '游泳', icon: '🏊', categoryId: 'sports' as CategoryId },
  { id: 'hiking', name: '徒步', icon: '🥾', categoryId: 'sports' as CategoryId },

  // Cooking
  { id: 'home-cooking', name: '家常菜', icon: '🍳', categoryId: 'cooking' as CategoryId },
  { id: 'baking', name: '烘焙', icon: '🧁', categoryId: 'cooking' as CategoryId },
  { id: 'coffee', name: '咖啡', icon: '☕', categoryId: 'cooking' as CategoryId, detail: '咖啡过敏 ☠️', status: 'blocked' },

  // Daily
  { id: 'driving', name: '驾驶', icon: '🚗', categoryId: 'daily' as CategoryId },
  { id: 'finance', name: '理财', icon: '💰', categoryId: 'daily' as CategoryId },

  // Visual
  { id: 'photography', name: '摄影', icon: '📷', categoryId: 'visual' as CategoryId },
  { id: 'ui-design', name: 'UI 设计', icon: '🎯', categoryId: 'visual' as CategoryId },
  { id: 'video-edit', name: '视频剪辑', icon: '🎬', categoryId: 'media' as CategoryId },
  { id: 'music', name: '音乐', icon: '🎵', categoryId: 'media' as CategoryId, detail: '吉他弹唱' },
] as const;

type NodeId = (typeof NODES)[number]['id'];

// --- Edge definitions (source is prerequisite of target) ---
const EDGES: readonly { source: NodeId; target: NodeId }[] = [
  // Frontend chain
  { source: 'html-css', target: 'javascript' },
  { source: 'javascript', target: 'typescript' },
  { source: 'javascript', target: 'react' },
  { source: 'javascript', target: 'vue' },
  { source: 'typescript', target: 'astro' },
  { source: 'html-css', target: 'tailwind' },

  // Backend chain
  { source: 'javascript', target: 'nodejs' },
  { source: 'python', target: 'go' },

  // Systems chain
  { source: 'c-lang', target: 'cpp' },
  { source: 'c-lang', target: 'embedded' },
  { source: 'c-lang', target: 'rust' },
  { source: 'linux', target: 'docker' },

  // DevOps chain
  { source: 'docker', target: 'k8s' },
  { source: 'git', target: 'cicd' },

  // Life chains
  { source: 'home-cooking', target: 'baking' },
  { source: 'photography', target: 'video-edit' },
] as const;

// --- Exported data ---
export const skillTreeData: SkillTreeData = {
  domains: DOMAINS,
  categories: CATEGORIES,
  nodes: NODES,
  edges: EDGES,
};
