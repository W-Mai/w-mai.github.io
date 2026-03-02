// GitHub linguist language color mapping
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  C: '#555555',
  'C++': '#f34b7d',
  'C#': '#178600',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Lua: '#000080',
  Zig: '#ec915c',
  Haskell: '#5e5086',
  Scala: '#c22d40',
  R: '#198CE7',
  Perl: '#0298c3',
  Elixir: '#6e4a7e',
  Clojure: '#db5855',
  'Objective-C': '#438eff',
}

const DEFAULT_COLOR = '#8b8b8b'

// Get the color for a programming language, returns default gray for unknown languages
export function getLanguageColor(language: string | null): string {
  if (!language) return DEFAULT_COLOR
  return LANGUAGE_COLORS[language] ?? DEFAULT_COLOR
}
