// Syntax highlighting wrapper around highlight.js. Pulls the "common"
// language bundle (~35 languages) which covers the typical contents of
// an agent workspace without paying for the full set. Returns the
// pre-rendered HTML and the resolved language; consumers inject it via
// dangerouslySetInnerHTML into a <pre><code class="hljs"> block.
import hljs from 'highlight.js/lib/common';

// Filename / extension overrides where auto-detection on small files is
// unreliable or where the canonical alias differs from the extension.
const EXT_LANG = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript',
  ts: 'typescript', tsx: 'typescript', jsx: 'javascript',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  swift: 'swift',
  c: 'c', h: 'c',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp', hh: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  ps1: 'powershell',
  json: 'json', json5: 'json',
  yml: 'yaml', yaml: 'yaml',
  toml: 'ini',
  ini: 'ini', cfg: 'ini', conf: 'ini',
  xml: 'xml', html: 'xml', htm: 'xml', svg: 'xml', xhtml: 'xml',
  css: 'css', scss: 'scss', sass: 'scss', less: 'less',
  sql: 'sql',
  diff: 'diff', patch: 'diff',
  dockerfile: 'dockerfile',
  makefile: 'makefile', mk: 'makefile',
  lua: 'lua',
  pl: 'perl', pm: 'perl',
  r: 'r',
  scala: 'scala',
  vue: 'xml',
};

const BASENAME_LANG = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  gemfile: 'ruby',
  rakefile: 'ruby',
};

function detectLanguage(name) {
  if (!name) return null;
  const base = name.split('/').pop().toLowerCase();
  if (BASENAME_LANG[base]) return BASENAME_LANG[base];
  const dot = base.lastIndexOf('.');
  if (dot < 0) return null;
  return EXT_LANG[base.slice(dot + 1)] || null;
}

// Returns { html, language } or null when no useful highlight could be
// produced (caller should fall back to plain text).
export function highlightCode(text, name) {
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
