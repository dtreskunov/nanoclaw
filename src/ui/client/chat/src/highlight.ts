// Syntax highlighting wrapper around highlight.js.
import hljs from 'highlight.js/lib/common';

const EXT_LANG: Record<string, string> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  ps1: 'powershell',
  json: 'json',
  json5: 'json',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  xml: 'xml',
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  xhtml: 'xml',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  sql: 'sql',
  diff: 'diff',
  patch: 'diff',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  mk: 'makefile',
  lua: 'lua',
  pl: 'perl',
  pm: 'perl',
  r: 'r',
  scala: 'scala',
  vue: 'xml',
};

const BASENAME_LANG: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  gemfile: 'ruby',
  rakefile: 'ruby',
};

function detectLanguage(name: string | null | undefined): string | null {
  if (!name) return null;
  const base = (name.split('/').pop() || '').toLowerCase();
  if (BASENAME_LANG[base]) return BASENAME_LANG[base]!;
  const dot = base.lastIndexOf('.');
  if (dot < 0) return null;
  return EXT_LANG[base.slice(dot + 1)] || null;
}

export interface HighlightResult {
  html: string;
  language: string;
}

export function highlightCode(text: string, name: string | null | undefined): HighlightResult | null {
  if (!text) return null;
  const lang = detectLanguage(name);
  try {
    if (lang && hljs.getLanguage(lang)) {
      const r = hljs.highlight(text, { language: lang, ignoreIllegals: true });
      return { html: r.value, language: r.language || lang };
    }
    const r = hljs.highlightAuto(text);
    if (!r || !r.language) return null;
    return { html: r.value, language: r.language };
  } catch {
    return null;
  }
}
