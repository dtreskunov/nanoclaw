// src/state.js
var PANES = [
  { key: "threads", id: "threads-rail", mainClass: "threads-collapsed", toggleBtn: "btn-threads-toggle", mobileBtn: "btn-threads" },
  { key: "files", id: "files-pane", mainClass: "files-collapsed", toggleBtn: "btn-files-toggle", mobileBtn: "btn-files" }
];
var state = {
  groupId: null,
  path: "",
  file: null,
  groups: [],
  isAdmin: false,
  paneOpen: { threads: true, files: true },
  suppressHashCount: 0
};
var uploadState = { items: [], dragDepth: 0 };
var chat = {
  groupId: null,
  threadId: null,
  channelType: "web",
  messagingGroupId: null,
  sessionMode: "per-thread",
  sessionId: null,
  ws: null,
  reconnectTimer: null,
  reconnectAttempt: 0,
  pollTimer: null,
  threadsPollTimer: null,
  lastSeenTs: "",
  pending: [],
  contextDismissed: false,
  threads: [],
  canSend: true
};
var UPLOAD_MAX_FILE_SIZE = 25 * 1024 * 1024;
var UPLOAD_MAX_TOTAL_SIZE = 50 * 1024 * 1024;
var UPLOAD_MAX_FILES = 10;
var MOBILE_MQ = window.matchMedia("(max-width: 720px)");
var POLL_INTERVAL_MS = 1e4;
var NOTIF_MUTE_KEY = "nanoclaw:notif:muted";
var CHANNEL_META = {
  web: { label: "Web", icon: "\u{1F4AC}" },
  resend: { label: "Email", icon: "\u{1F4E7}" },
  discord: { label: "Discord", icon: "\u{1F47E}" },
  telegram: { label: "Telegram", icon: "\u2708\uFE0F" },
  whatsapp: { label: "WhatsApp", icon: "\u{1F4DE}" },
  imessage: { label: "iMessage", icon: "\u{1F4AC}" },
  signal: { label: "Signal", icon: "\u{1F512}" },
  slack: { label: "Slack", icon: "#" },
  matrix: { label: "Matrix", icon: "M" },
  gchat: { label: "Chat", icon: "G" }
};
function channelMeta(ct) {
  return CHANNEL_META[ct] || { label: ct || "Channel", icon: "\u2022" };
}

// node_modules/marked/lib/marked.esm.js
function M() {
  return { async: false, breaks: false, extensions: null, gfm: true, hooks: null, pedantic: false, renderer: null, silent: false, tokenizer: null, walkTokens: null };
}
var T = M();
function N(l3) {
  T = l3;
}
var _ = { exec: () => null };
function E(l3) {
  let e = [];
  return (t) => {
    let n = Math.max(0, Math.min(3, t - 1)), s = e[n];
    return s || (s = l3(n), e[n] = s), s;
  };
}
function d(l3, e = "") {
  let t = typeof l3 == "string" ? l3 : l3.source, n = { replace: (s, r) => {
    let i = typeof r == "string" ? r : r.source;
    return i = i.replace(m.caret, "$1"), t = t.replace(s, i), n;
  }, getRegex: () => new RegExp(t, e) };
  return n;
}
var Te = ((l3 = "") => {
  try {
    return !!new RegExp("(?<=1)(?<!1)" + l3);
  } catch {
    return false;
  }
})();
var m = { codeRemoveIndent: /^(?: {1,4}| {0,3}\t)/gm, outputLinkReplace: /\\([\[\]])/g, indentCodeCompensation: /^(\s+)(?:```)/, beginningSpace: /^\s+/, endingHash: /#$/, startingSpaceChar: /^ /, endingSpaceChar: / $/, nonSpaceChar: /[^ ]/, newLineCharGlobal: /\n/g, tabCharGlobal: /\t/g, multipleSpaceGlobal: /\s+/g, blankLine: /^[ \t]*$/, doubleBlankLine: /\n[ \t]*\n[ \t]*$/, blockquoteStart: /^ {0,3}>/, blockquoteSetextReplace: /\n {0,3}((?:=+|-+) *)(?=\n|$)/g, blockquoteSetextReplace2: /^ {0,3}>[ \t]?/gm, listReplaceNesting: /^ {1,4}(?=( {4})*[^ ])/g, listIsTask: /^\[[ xX]\] +\S/, listReplaceTask: /^\[[ xX]\] +/, listTaskCheckbox: /\[[ xX]\]/, anyLine: /\n.*\n/, hrefBrackets: /^<(.*)>$/, tableDelimiter: /[:|]/, tableAlignChars: /^\||\| *$/g, tableRowBlankLine: /\n[ \t]*$/, tableAlignRight: /^ *-+: *$/, tableAlignCenter: /^ *:-+: *$/, tableAlignLeft: /^ *:-+ *$/, startATag: /^<a /i, endATag: /^<\/a>/i, startPreScriptTag: /^<(pre|code|kbd|script)(\s|>)/i, endPreScriptTag: /^<\/(pre|code|kbd|script)(\s|>)/i, startAngleBracket: /^</, endAngleBracket: />$/, pedanticHrefTitle: /^([^'"]*[^\s])\s+(['"])(.*)\2/, unicodeAlphaNumeric: /[\p{L}\p{N}]/u, escapeTest: /[&<>"']/, escapeReplace: /[&<>"']/g, escapeTestNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/, escapeReplaceNoEncode: /[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g, caret: /(^|[^\[])\^/g, percentDecode: /%25/g, findPipe: /\|/g, splitPipe: / \|/, slashPipe: /\\\|/g, carriageReturn: /\r\n|\r/g, spaceLine: /^ +$/gm, notSpaceStart: /^\S*/, endingNewline: /\n$/, listItemRegex: (l3) => new RegExp(`^( {0,3}${l3})((?:[	 ][^\\n]*)?(?:\\n|$))`), nextBulletRegex: E((l3) => new RegExp(`^ {0,${l3}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`)), hrRegex: E((l3) => new RegExp(`^ {0,${l3}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`)), fencesBeginRegex: E((l3) => new RegExp(`^ {0,${l3}}(?:\`\`\`|~~~)`)), headingBeginRegex: E((l3) => new RegExp(`^ {0,${l3}}#`)), htmlBeginRegex: E((l3) => new RegExp(`^ {0,${l3}}<(?:[a-z].*>|!--)`, "i")), blockquoteBeginRegex: E((l3) => new RegExp(`^ {0,${l3}}>`)) };
var Oe = /^(?:[ \t]*(?:\n|$))+/;
var we = /^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/;
var ye = /^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/;
var B = /^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/;
var Pe = /^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/;
var j = / {0,3}(?:[*+-]|\d{1,9}[.)])/;
var oe = /^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/;
var ae = d(oe).replace(/bull/g, j).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/\|table/g, "").getRegex();
var Se = d(oe).replace(/bull/g, j).replace(/blockCode/g, /(?: {4}| {0,3}\t)/).replace(/fences/g, / {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g, / {0,3}>/).replace(/heading/g, / {0,3}#{1,6}/).replace(/html/g, / {0,3}<[^\n>]+>\n/).replace(/table/g, / {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex();
var F = /^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/;
var $e = /^[^\n]+/;
var U = /(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/;
var Le = d(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label", U).replace("title", /(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex();
var _e = d(/^(bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g, j).getRegex();
var H = "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul";
var K = /<!--(?:-?>|[\s\S]*?(?:-->|$))/;
var ze = d("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))", "i").replace("comment", K).replace("tag", H).replace("attribute", / +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex();
var le = d(F).replace("hr", B).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("|table", "").replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex();
var Me = d(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph", le).getRegex();
var W = { blockquote: Me, code: we, def: Le, fences: ye, heading: Pe, hr: B, html: ze, lheading: ae, list: _e, newline: Oe, paragraph: le, table: _, text: $e };
var se = d("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr", B).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("blockquote", " {0,3}>").replace("code", "(?: {4}| {0,3}	)[^\\n]").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex();
var Ee = { ...W, lheading: Se, table: se, paragraph: d(F).replace("hr", B).replace("heading", " {0,3}#{1,6}(?:\\s|$)").replace("|lheading", "").replace("table", se).replace("blockquote", " {0,3}>").replace("fences", " {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list", " {0,3}(?:[*+-]|1[.)])[ \\t]").replace("html", "</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag", H).getRegex() };
var Ie = { ...W, html: d(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment", K).replace(/tag/g, "(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(), def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/, heading: /^(#{1,6})(.*)(?:\n+|$)/, fences: _, lheading: /^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/, paragraph: d(F).replace("hr", B).replace("heading", ` *#{1,6} *[^
]`).replace("lheading", ae).replace("|table", "").replace("blockquote", " {0,3}>").replace("|fences", "").replace("|list", "").replace("|html", "").replace("|tag", "").getRegex() };
var Ae = /^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/;
var Ce = /^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/;
var ue = /^( {2,}|\\)\n(?!\s*$)/;
var Be = /^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/;
var I = /[\p{P}\p{S}]/u;
var Z = /[\s\p{P}\p{S}]/u;
var X = /[^\s\p{P}\p{S}]/u;
var De = d(/^((?![*_])punctSpace)/, "u").replace(/punctSpace/g, Z).getRegex();
var pe = /(?!~)[\p{P}\p{S}]/u;
var qe = /(?!~)[\s\p{P}\p{S}]/u;
var ve = /(?:[^\s\p{P}\p{S}]|~)/u;
var He = d(/link|precode-code|html/, "g").replace("link", /\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-", Te ? "(?<!`)()" : "(^^|[^`])").replace("code", /(?<b>`+)[^`]+\k<b>(?!`)/).replace("html", /<(?! )[^<>]*?>/).getRegex();
var ce = /^(?:\*+(?:((?!\*)punct)|([^\s*]))?)|^_+(?:((?!_)punct)|([^\s_]))?/;
var Ze = d(ce, "u").replace(/punct/g, I).getRegex();
var Ge = d(ce, "u").replace(/punct/g, pe).getRegex();
var he = "^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)";
var Ne = d(he, "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z).replace(/punct/g, I).getRegex();
var Qe = d(he, "gu").replace(/notPunctSpace/g, ve).replace(/punctSpace/g, qe).replace(/punct/g, pe).getRegex();
var je = d("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)", "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z).replace(/punct/g, I).getRegex();
var Fe = d(/^~~?(?:((?!~)punct)|[^\s~])/, "u").replace(/punct/g, I).getRegex();
var Ue = "^[^~]+(?=[^~])|(?!~)punct(~~?)(?=[\\s]|$)|notPunctSpace(~~?)(?!~)(?=punctSpace|$)|(?!~)punctSpace(~~?)(?=notPunctSpace)|[\\s](~~?)(?!~)(?=punct)|(?!~)punct(~~?)(?!~)(?=punct)|notPunctSpace(~~?)(?=notPunctSpace)";
var Ke = d(Ue, "gu").replace(/notPunctSpace/g, X).replace(/punctSpace/g, Z).replace(/punct/g, I).getRegex();
var We = d(/\\(punct)/, "gu").replace(/punct/g, I).getRegex();
var Xe = d(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme", /[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email", /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex();
var Je = d(K).replace("(?:-->|$)", "-->").getRegex();
var Ve = d("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment", Je).replace("attribute", /\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex();
var v = /(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+(?!`)[^`]*?`+(?!`)|``+(?=\])|[^\[\]\\`])*?/;
var Ye = d(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]+(?:\n[ \t]*)?|\n[ \t]*)(title))?\s*\)/).replace("label", v).replace("href", /<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title", /"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex();
var ke = d(/^!?\[(label)\]\[(ref)\]/).replace("label", v).replace("ref", U).getRegex();
var de = d(/^!?\[(ref)\](?:\[\])?/).replace("ref", U).getRegex();
var et = d("reflink|nolink(?!\\()", "g").replace("reflink", ke).replace("nolink", de).getRegex();
var ie = /[hH][tT][tT][pP][sS]?|[fF][tT][pP]/;
var J = { _backpedal: _, anyPunctuation: We, autolink: Xe, blockSkip: He, br: ue, code: Ce, del: _, delLDelim: _, delRDelim: _, emStrongLDelim: Ze, emStrongRDelimAst: Ne, emStrongRDelimUnd: je, escape: Ae, link: Ye, nolink: de, punctuation: De, reflink: ke, reflinkSearch: et, tag: Ve, text: Be, url: _ };
var tt = { ...J, link: d(/^!?\[(label)\]\((.*?)\)/).replace("label", v).getRegex(), reflink: d(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label", v).getRegex() };
var Q = { ...J, emStrongRDelimAst: Qe, emStrongLDelim: Ge, delLDelim: Fe, delRDelim: Ke, url: d(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol", ie).replace("email", /[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(), _backpedal: /(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/, del: /^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/, text: d(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol", ie).getRegex() };
var nt = { ...Q, br: d(ue).replace("{2,}", "*").getRegex(), text: d(Q.text).replace("\\b_", "\\b_| {2,}\\n").replace(/\{2,\}/g, "*").getRegex() };
var D = { normal: W, gfm: Ee, pedantic: Ie };
var A = { normal: J, gfm: Q, breaks: nt, pedantic: tt };
var rt = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
var ge = (l3) => rt[l3];
function O(l3, e) {
  if (e) {
    if (m.escapeTest.test(l3)) return l3.replace(m.escapeReplace, ge);
  } else if (m.escapeTestNoEncode.test(l3)) return l3.replace(m.escapeReplaceNoEncode, ge);
  return l3;
}
function V(l3) {
  try {
    l3 = encodeURI(l3).replace(m.percentDecode, "%");
  } catch {
    return null;
  }
  return l3;
}
function Y(l3, e) {
  let t = l3.replace(m.findPipe, (r, i, o) => {
    let u = false, a = i;
    for (; --a >= 0 && o[a] === "\\"; ) u = !u;
    return u ? "|" : " |";
  }), n = t.split(m.splitPipe), s = 0;
  if (n[0].trim() || n.shift(), n.length > 0 && !n.at(-1)?.trim() && n.pop(), e) if (n.length > e) n.splice(e);
  else for (; n.length < e; ) n.push("");
  for (; s < n.length; s++) n[s] = n[s].trim().replace(m.slashPipe, "|");
  return n;
}
function $(l3, e, t) {
  let n = l3.length;
  if (n === 0) return "";
  let s = 0;
  for (; s < n; ) {
    let r = l3.charAt(n - s - 1);
    if (r === e && !t) s++;
    else if (r !== e && t) s++;
    else break;
  }
  return l3.slice(0, n - s);
}
function ee(l3) {
  let e = l3.split(`
`), t = e.length - 1;
  for (; t >= 0 && m.blankLine.test(e[t]); ) t--;
  return e.length - t <= 2 ? l3 : e.slice(0, t + 1).join(`
`);
}
function fe(l3, e) {
  if (l3.indexOf(e[1]) === -1) return -1;
  let t = 0;
  for (let n = 0; n < l3.length; n++) if (l3[n] === "\\") n++;
  else if (l3[n] === e[0]) t++;
  else if (l3[n] === e[1] && (t--, t < 0)) return n;
  return t > 0 ? -2 : -1;
}
function me(l3, e = 0) {
  let t = e, n = "";
  for (let s of l3) if (s === "	") {
    let r = 4 - t % 4;
    n += " ".repeat(r), t += r;
  } else n += s, t++;
  return n;
}
function xe(l3, e, t, n, s) {
  let r = e.href, i = e.title || null, o = l3[1].replace(s.other.outputLinkReplace, "$1");
  n.state.inLink = true;
  let u = { type: l3[0].charAt(0) === "!" ? "image" : "link", raw: t, href: r, title: i, text: o, tokens: n.inlineTokens(o) };
  return n.state.inLink = false, u;
}
function st(l3, e, t) {
  let n = l3.match(t.other.indentCodeCompensation);
  if (n === null) return e;
  let s = n[1];
  return e.split(`
`).map((r) => {
    let i = r.match(t.other.beginningSpace);
    if (i === null) return r;
    let [o] = i;
    return o.length >= s.length ? r.slice(s.length) : r;
  }).join(`
`);
}
var w = class {
  options;
  rules;
  lexer;
  constructor(e) {
    this.options = e || T;
  }
  space(e) {
    let t = this.rules.block.newline.exec(e);
    if (t && t[0].length > 0) return { type: "space", raw: t[0] };
  }
  code(e) {
    let t = this.rules.block.code.exec(e);
    if (t) {
      let n = this.options.pedantic ? t[0] : ee(t[0]), s = n.replace(this.rules.other.codeRemoveIndent, "");
      return { type: "code", raw: n, codeBlockStyle: "indented", text: s };
    }
  }
  fences(e) {
    let t = this.rules.block.fences.exec(e);
    if (t) {
      let n = t[0], s = st(n, t[3] || "", this.rules);
      return { type: "code", raw: n, lang: t[2] ? t[2].trim().replace(this.rules.inline.anyPunctuation, "$1") : t[2], text: s };
    }
  }
  heading(e) {
    let t = this.rules.block.heading.exec(e);
    if (t) {
      let n = t[2].trim();
      if (this.rules.other.endingHash.test(n)) {
        let s = $(n, "#");
        (this.options.pedantic || !s || this.rules.other.endingSpaceChar.test(s)) && (n = s.trim());
      }
      return { type: "heading", raw: $(t[0], `
`), depth: t[1].length, text: n, tokens: this.lexer.inline(n) };
    }
  }
  hr(e) {
    let t = this.rules.block.hr.exec(e);
    if (t) return { type: "hr", raw: $(t[0], `
`) };
  }
  blockquote(e) {
    let t = this.rules.block.blockquote.exec(e);
    if (t) {
      let n = $(t[0], `
`).split(`
`), s = "", r = "", i = [];
      for (; n.length > 0; ) {
        let o = false, u = [], a;
        for (a = 0; a < n.length; a++) if (this.rules.other.blockquoteStart.test(n[a])) u.push(n[a]), o = true;
        else if (!o) u.push(n[a]);
        else break;
        n = n.slice(a);
        let c = u.join(`
`), p = c.replace(this.rules.other.blockquoteSetextReplace, `
    $1`).replace(this.rules.other.blockquoteSetextReplace2, "");
        s = s ? `${s}
${c}` : c, r = r ? `${r}
${p}` : p;
        let k = this.lexer.state.top;
        if (this.lexer.state.top = true, this.lexer.blockTokens(p, i, true), this.lexer.state.top = k, n.length === 0) break;
        let h = i.at(-1);
        if (h?.type === "code") break;
        if (h?.type === "blockquote") {
          let R = h, f = R.raw + `
` + n.join(`
`), S = this.blockquote(f);
          i[i.length - 1] = S, s = s.substring(0, s.length - R.raw.length) + S.raw, r = r.substring(0, r.length - R.text.length) + S.text;
          break;
        } else if (h?.type === "list") {
          let R = h, f = R.raw + `
` + n.join(`
`), S = this.list(f);
          i[i.length - 1] = S, s = s.substring(0, s.length - h.raw.length) + S.raw, r = r.substring(0, r.length - R.raw.length) + S.raw, n = f.substring(i.at(-1).raw.length).split(`
`);
          continue;
        }
      }
      return { type: "blockquote", raw: s, tokens: i, text: r };
    }
  }
  list(e) {
    let t = this.rules.block.list.exec(e);
    if (t) {
      let n = t[1].trim(), s = n.length > 1, r = { type: "list", raw: "", ordered: s, start: s ? +n.slice(0, -1) : "", loose: false, items: [] };
      n = s ? `\\d{1,9}\\${n.slice(-1)}` : `\\${n}`, this.options.pedantic && (n = s ? n : "[*+-]");
      let i = this.rules.other.listItemRegex(n), o = false;
      for (; e; ) {
        let a = false, c = "", p = "";
        if (!(t = i.exec(e)) || this.rules.block.hr.test(e)) break;
        c = t[0], e = e.substring(c.length);
        let k = me(t[2].split(`
`, 1)[0], t[1].length), h = e.split(`
`, 1)[0], R = !k.trim(), f = 0;
        if (this.options.pedantic ? (f = 2, p = k.trimStart()) : R ? f = t[1].length + 1 : (f = k.search(this.rules.other.nonSpaceChar), f = f > 4 ? 1 : f, p = k.slice(f), f += t[1].length), R && this.rules.other.blankLine.test(h) && (c += h + `
`, e = e.substring(h.length + 1), a = true), !a) {
          let S = this.rules.other.nextBulletRegex(f), te = this.rules.other.hrRegex(f), ne = this.rules.other.fencesBeginRegex(f), re = this.rules.other.headingBeginRegex(f), be = this.rules.other.htmlBeginRegex(f), Re = this.rules.other.blockquoteBeginRegex(f);
          for (; e; ) {
            let G = e.split(`
`, 1)[0], C;
            if (h = G, this.options.pedantic ? (h = h.replace(this.rules.other.listReplaceNesting, "  "), C = h) : C = h.replace(this.rules.other.tabCharGlobal, "    "), ne.test(h) || re.test(h) || be.test(h) || Re.test(h) || S.test(h) || te.test(h)) break;
            if (C.search(this.rules.other.nonSpaceChar) >= f || !h.trim()) p += `
` + C.slice(f);
            else {
              if (R || k.replace(this.rules.other.tabCharGlobal, "    ").search(this.rules.other.nonSpaceChar) >= 4 || ne.test(k) || re.test(k) || te.test(k)) break;
              p += `
` + h;
            }
            R = !h.trim(), c += G + `
`, e = e.substring(G.length + 1), k = C.slice(f);
          }
        }
        r.loose || (o ? r.loose = true : this.rules.other.doubleBlankLine.test(c) && (o = true)), r.items.push({ type: "list_item", raw: c, task: !!this.options.gfm && this.rules.other.listIsTask.test(p), loose: false, text: p, tokens: [] }), r.raw += c;
      }
      let u = r.items.at(-1);
      if (u) u.raw = u.raw.trimEnd(), u.text = u.text.trimEnd();
      else return;
      r.raw = r.raw.trimEnd();
      for (let a of r.items) {
        this.lexer.state.top = false, a.tokens = this.lexer.blockTokens(a.text, []);
        let c = a.tokens[0];
        if (a.task && (c?.type === "text" || c?.type === "paragraph")) {
          a.text = a.text.replace(this.rules.other.listReplaceTask, ""), c.raw = c.raw.replace(this.rules.other.listReplaceTask, ""), c.text = c.text.replace(this.rules.other.listReplaceTask, "");
          for (let k = this.lexer.inlineQueue.length - 1; k >= 0; k--) if (this.rules.other.listIsTask.test(this.lexer.inlineQueue[k].src)) {
            this.lexer.inlineQueue[k].src = this.lexer.inlineQueue[k].src.replace(this.rules.other.listReplaceTask, "");
            break;
          }
          let p = this.rules.other.listTaskCheckbox.exec(a.raw);
          if (p) {
            let k = { type: "checkbox", raw: p[0] + " ", checked: p[0] !== "[ ]" };
            a.checked = k.checked, r.loose ? a.tokens[0] && ["paragraph", "text"].includes(a.tokens[0].type) && "tokens" in a.tokens[0] && a.tokens[0].tokens ? (a.tokens[0].raw = k.raw + a.tokens[0].raw, a.tokens[0].text = k.raw + a.tokens[0].text, a.tokens[0].tokens.unshift(k)) : a.tokens.unshift({ type: "paragraph", raw: k.raw, text: k.raw, tokens: [k] }) : a.tokens.unshift(k);
          }
        } else a.task && (a.task = false);
        if (!r.loose) {
          let p = a.tokens.filter((h) => h.type === "space"), k = p.length > 0 && p.some((h) => this.rules.other.anyLine.test(h.raw));
          r.loose = k;
        }
      }
      if (r.loose) for (let a of r.items) {
        a.loose = true;
        for (let c of a.tokens) c.type === "text" && (c.type = "paragraph");
      }
      return r;
    }
  }
  html(e) {
    let t = this.rules.block.html.exec(e);
    if (t) {
      let n = ee(t[0]);
      return { type: "html", block: true, raw: n, pre: t[1] === "pre" || t[1] === "script" || t[1] === "style", text: n };
    }
  }
  def(e) {
    let t = this.rules.block.def.exec(e);
    if (t) {
      let n = t[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal, " "), s = t[2] ? t[2].replace(this.rules.other.hrefBrackets, "$1").replace(this.rules.inline.anyPunctuation, "$1") : "", r = t[3] ? t[3].substring(1, t[3].length - 1).replace(this.rules.inline.anyPunctuation, "$1") : t[3];
      return { type: "def", tag: n, raw: $(t[0], `
`), href: s, title: r };
    }
  }
  table(e) {
    let t = this.rules.block.table.exec(e);
    if (!t || !this.rules.other.tableDelimiter.test(t[2])) return;
    let n = Y(t[1]), s = t[2].replace(this.rules.other.tableAlignChars, "").split("|"), r = t[3]?.trim() ? t[3].replace(this.rules.other.tableRowBlankLine, "").split(`
`) : [], i = { type: "table", raw: $(t[0], `
`), header: [], align: [], rows: [] };
    if (n.length === s.length) {
      for (let o of s) this.rules.other.tableAlignRight.test(o) ? i.align.push("right") : this.rules.other.tableAlignCenter.test(o) ? i.align.push("center") : this.rules.other.tableAlignLeft.test(o) ? i.align.push("left") : i.align.push(null);
      for (let o = 0; o < n.length; o++) i.header.push({ text: n[o], tokens: this.lexer.inline(n[o]), header: true, align: i.align[o] });
      for (let o of r) i.rows.push(Y(o, i.header.length).map((u, a) => ({ text: u, tokens: this.lexer.inline(u), header: false, align: i.align[a] })));
      return i;
    }
  }
  lheading(e) {
    let t = this.rules.block.lheading.exec(e);
    if (t) {
      let n = t[1].trim();
      return { type: "heading", raw: $(t[0], `
`), depth: t[2].charAt(0) === "=" ? 1 : 2, text: n, tokens: this.lexer.inline(n) };
    }
  }
  paragraph(e) {
    let t = this.rules.block.paragraph.exec(e);
    if (t) {
      let n = t[1].charAt(t[1].length - 1) === `
` ? t[1].slice(0, -1) : t[1];
      return { type: "paragraph", raw: t[0], text: n, tokens: this.lexer.inline(n) };
    }
  }
  text(e) {
    let t = this.rules.block.text.exec(e);
    if (t) return { type: "text", raw: t[0], text: t[0], tokens: this.lexer.inline(t[0]) };
  }
  escape(e) {
    let t = this.rules.inline.escape.exec(e);
    if (t) return { type: "escape", raw: t[0], text: t[1] };
  }
  tag(e) {
    let t = this.rules.inline.tag.exec(e);
    if (t) return !this.lexer.state.inLink && this.rules.other.startATag.test(t[0]) ? this.lexer.state.inLink = true : this.lexer.state.inLink && this.rules.other.endATag.test(t[0]) && (this.lexer.state.inLink = false), !this.lexer.state.inRawBlock && this.rules.other.startPreScriptTag.test(t[0]) ? this.lexer.state.inRawBlock = true : this.lexer.state.inRawBlock && this.rules.other.endPreScriptTag.test(t[0]) && (this.lexer.state.inRawBlock = false), { type: "html", raw: t[0], inLink: this.lexer.state.inLink, inRawBlock: this.lexer.state.inRawBlock, block: false, text: t[0] };
  }
  link(e) {
    let t = this.rules.inline.link.exec(e);
    if (t) {
      let n = t[2].trim();
      if (!this.options.pedantic && this.rules.other.startAngleBracket.test(n)) {
        if (!this.rules.other.endAngleBracket.test(n)) return;
        let i = $(n.slice(0, -1), "\\");
        if ((n.length - i.length) % 2 === 0) return;
      } else {
        let i = fe(t[2], "()");
        if (i === -2) return;
        if (i > -1) {
          let u = (t[0].indexOf("!") === 0 ? 5 : 4) + t[1].length + i;
          t[2] = t[2].substring(0, i), t[0] = t[0].substring(0, u).trim(), t[3] = "";
        }
      }
      let s = t[2], r = "";
      if (this.options.pedantic) {
        let i = this.rules.other.pedanticHrefTitle.exec(s);
        i && (s = i[1], r = i[3]);
      } else r = t[3] ? t[3].slice(1, -1) : "";
      return s = s.trim(), this.rules.other.startAngleBracket.test(s) && (this.options.pedantic && !this.rules.other.endAngleBracket.test(n) ? s = s.slice(1) : s = s.slice(1, -1)), xe(t, { href: s && s.replace(this.rules.inline.anyPunctuation, "$1"), title: r && r.replace(this.rules.inline.anyPunctuation, "$1") }, t[0], this.lexer, this.rules);
    }
  }
  reflink(e, t) {
    let n;
    if ((n = this.rules.inline.reflink.exec(e)) || (n = this.rules.inline.nolink.exec(e))) {
      let s = (n[2] || n[1]).replace(this.rules.other.multipleSpaceGlobal, " "), r = t[s.toLowerCase()];
      if (!r) {
        let i = n[0].charAt(0);
        return { type: "text", raw: i, text: i };
      }
      return xe(n, r, n[0], this.lexer, this.rules);
    }
  }
  emStrong(e, t, n = "") {
    let s = this.rules.inline.emStrongLDelim.exec(e);
    if (!s || !s[1] && !s[2] && !s[3] && !s[4] || s[4] && n.match(this.rules.other.unicodeAlphaNumeric)) return;
    if (!(s[1] || s[3] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let i = [...s[0]].length - 1, o, u, a = i, c = 0, p = s[0][0] === "*" ? this.rules.inline.emStrongRDelimAst : this.rules.inline.emStrongRDelimUnd;
      for (p.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = p.exec(t)) !== null; ) {
        if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o) continue;
        if (u = [...o].length, s[3] || s[4]) {
          a += u;
          continue;
        } else if ((s[5] || s[6]) && i % 3 && !((i + u) % 3)) {
          c += u;
          continue;
        }
        if (a -= u, a > 0) continue;
        u = Math.min(u, u + a + c);
        let k = [...s[0]][0].length, h = e.slice(0, i + s.index + k + u);
        if (Math.min(i, u) % 2) {
          let f = h.slice(1, -1);
          return { type: "em", raw: h, text: f, tokens: this.lexer.inlineTokens(f) };
        }
        let R = h.slice(2, -2);
        return { type: "strong", raw: h, text: R, tokens: this.lexer.inlineTokens(R) };
      }
    }
  }
  codespan(e) {
    let t = this.rules.inline.code.exec(e);
    if (t) {
      let n = t[2].replace(this.rules.other.newLineCharGlobal, " "), s = this.rules.other.nonSpaceChar.test(n), r = this.rules.other.startingSpaceChar.test(n) && this.rules.other.endingSpaceChar.test(n);
      return s && r && (n = n.substring(1, n.length - 1)), { type: "codespan", raw: t[0], text: n };
    }
  }
  br(e) {
    let t = this.rules.inline.br.exec(e);
    if (t) return { type: "br", raw: t[0] };
  }
  del(e, t, n = "") {
    let s = this.rules.inline.delLDelim.exec(e);
    if (!s) return;
    if (!(s[1] || "") || !n || this.rules.inline.punctuation.exec(n)) {
      let i = [...s[0]].length - 1, o, u, a = i, c = this.rules.inline.delRDelim;
      for (c.lastIndex = 0, t = t.slice(-1 * e.length + i); (s = c.exec(t)) !== null; ) {
        if (o = s[1] || s[2] || s[3] || s[4] || s[5] || s[6], !o || (u = [...o].length, u !== i)) continue;
        if (s[3] || s[4]) {
          a += u;
          continue;
        }
        if (a -= u, a > 0) continue;
        u = Math.min(u, u + a);
        let p = [...s[0]][0].length, k = e.slice(0, i + s.index + p + u), h = k.slice(i, -i);
        return { type: "del", raw: k, text: h, tokens: this.lexer.inlineTokens(h) };
      }
    }
  }
  autolink(e) {
    let t = this.rules.inline.autolink.exec(e);
    if (t) {
      let n, s;
      return t[2] === "@" ? (n = t[1], s = "mailto:" + n) : (n = t[1], s = n), { type: "link", raw: t[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  url(e) {
    let t;
    if (t = this.rules.inline.url.exec(e)) {
      let n, s;
      if (t[2] === "@") n = t[0], s = "mailto:" + n;
      else {
        let r;
        do
          r = t[0], t[0] = this.rules.inline._backpedal.exec(t[0])?.[0] ?? "";
        while (r !== t[0]);
        n = t[0], t[1] === "www." ? s = "http://" + t[0] : s = t[0];
      }
      return { type: "link", raw: t[0], text: n, href: s, tokens: [{ type: "text", raw: n, text: n }] };
    }
  }
  inlineText(e) {
    let t = this.rules.inline.text.exec(e);
    if (t) {
      let n = this.lexer.state.inRawBlock;
      return { type: "text", raw: t[0], text: t[0], escaped: n };
    }
  }
};
var x = class l {
  tokens;
  options;
  state;
  inlineQueue;
  tokenizer;
  constructor(e) {
    this.tokens = [], this.tokens.links = /* @__PURE__ */ Object.create(null), this.options = e || T, this.options.tokenizer = this.options.tokenizer || new w(), this.tokenizer = this.options.tokenizer, this.tokenizer.options = this.options, this.tokenizer.lexer = this, this.inlineQueue = [], this.state = { inLink: false, inRawBlock: false, top: true };
    let t = { other: m, block: D.normal, inline: A.normal };
    this.options.pedantic ? (t.block = D.pedantic, t.inline = A.pedantic) : this.options.gfm && (t.block = D.gfm, this.options.breaks ? t.inline = A.breaks : t.inline = A.gfm), this.tokenizer.rules = t;
  }
  static get rules() {
    return { block: D, inline: A };
  }
  static lex(e, t) {
    return new l(t).lex(e);
  }
  static lexInline(e, t) {
    return new l(t).inlineTokens(e);
  }
  lex(e) {
    e = e.replace(m.carriageReturn, `
`), this.blockTokens(e, this.tokens);
    for (let t = 0; t < this.inlineQueue.length; t++) {
      let n = this.inlineQueue[t];
      this.inlineTokens(n.src, n.tokens);
    }
    return this.inlineQueue = [], this.tokens;
  }
  blockTokens(e, t = [], n = false) {
    this.tokenizer.lexer = this, this.options.pedantic && (e = e.replace(m.tabCharGlobal, "    ").replace(m.spaceLine, ""));
    let s = 1 / 0;
    for (; e; ) {
      if (e.length < s) s = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      let r;
      if (this.options.extensions?.block?.some((o) => (r = o.call({ lexer: this }, e, t)) ? (e = e.substring(r.raw.length), t.push(r), true) : false)) continue;
      if (r = this.tokenizer.space(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        r.raw.length === 1 && o !== void 0 ? o.raw += `
` : t.push(r);
        continue;
      }
      if (r = this.tokenizer.code(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.at(-1).src = o.text) : t.push(r);
        continue;
      }
      if (r = this.tokenizer.fences(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.heading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.hr(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.blockquote(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.list(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.html(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.def(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "paragraph" || o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.raw, this.inlineQueue.at(-1).src = o.text) : this.tokens.links[r.tag] || (this.tokens.links[r.tag] = { href: r.href, title: r.title }, t.push(r));
        continue;
      }
      if (r = this.tokenizer.table(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      if (r = this.tokenizer.lheading(e)) {
        e = e.substring(r.raw.length), t.push(r);
        continue;
      }
      let i = e;
      if (this.options.extensions?.startBlock) {
        let o = 1 / 0, u = e.slice(1), a;
        this.options.extensions.startBlock.forEach((c) => {
          a = c.call({ lexer: this }, u), typeof a == "number" && a >= 0 && (o = Math.min(o, a));
        }), o < 1 / 0 && o >= 0 && (i = e.substring(0, o + 1));
      }
      if (this.state.top && (r = this.tokenizer.paragraph(i))) {
        let o = t.at(-1);
        n && o?.type === "paragraph" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r), n = i.length !== e.length, e = e.substring(r.raw.length);
        continue;
      }
      if (r = this.tokenizer.text(e)) {
        e = e.substring(r.raw.length);
        let o = t.at(-1);
        o?.type === "text" ? (o.raw += (o.raw.endsWith(`
`) ? "" : `
`) + r.raw, o.text += `
` + r.text, this.inlineQueue.pop(), this.inlineQueue.at(-1).src = o.text) : t.push(r);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return this.state.top = true, t;
  }
  inline(e, t = []) {
    return this.inlineQueue.push({ src: e, tokens: t }), t;
  }
  inlineTokens(e, t = []) {
    this.tokenizer.lexer = this;
    let n = e, s = null;
    if (this.tokens.links) {
      let a = Object.keys(this.tokens.links);
      if (a.length > 0) for (; (s = this.tokenizer.rules.inline.reflinkSearch.exec(n)) !== null; ) a.includes(s[0].slice(s[0].lastIndexOf("[") + 1, -1)) && (n = n.slice(0, s.index) + "[" + "a".repeat(s[0].length - 2) + "]" + n.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex));
    }
    for (; (s = this.tokenizer.rules.inline.anyPunctuation.exec(n)) !== null; ) n = n.slice(0, s.index) + "++" + n.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);
    let r;
    for (; (s = this.tokenizer.rules.inline.blockSkip.exec(n)) !== null; ) r = s[2] ? s[2].length : 0, n = n.slice(0, s.index + r) + "[" + "a".repeat(s[0].length - r - 2) + "]" + n.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);
    n = this.options.hooks?.emStrongMask?.call({ lexer: this }, n) ?? n;
    let i = false, o = "", u = 1 / 0;
    for (; e; ) {
      if (e.length < u) u = e.length;
      else {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
      i || (o = ""), i = false;
      let a;
      if (this.options.extensions?.inline?.some((p) => (a = p.call({ lexer: this }, e, t)) ? (e = e.substring(a.raw.length), t.push(a), true) : false)) continue;
      if (a = this.tokenizer.escape(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.tag(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.link(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.reflink(e, this.tokens.links)) {
        e = e.substring(a.raw.length);
        let p = t.at(-1);
        a.type === "text" && p?.type === "text" ? (p.raw += a.raw, p.text += a.text) : t.push(a);
        continue;
      }
      if (a = this.tokenizer.emStrong(e, n, o)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.codespan(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.br(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.del(e, n, o)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (a = this.tokenizer.autolink(e)) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      if (!this.state.inLink && (a = this.tokenizer.url(e))) {
        e = e.substring(a.raw.length), t.push(a);
        continue;
      }
      let c = e;
      if (this.options.extensions?.startInline) {
        let p = 1 / 0, k = e.slice(1), h;
        this.options.extensions.startInline.forEach((R) => {
          h = R.call({ lexer: this }, k), typeof h == "number" && h >= 0 && (p = Math.min(p, h));
        }), p < 1 / 0 && p >= 0 && (c = e.substring(0, p + 1));
      }
      if (a = this.tokenizer.inlineText(c)) {
        e = e.substring(a.raw.length), a.raw.slice(-1) !== "_" && (o = a.raw.slice(-1)), i = true;
        let p = t.at(-1);
        p?.type === "text" ? (p.raw += a.raw, p.text += a.text) : t.push(a);
        continue;
      }
      if (e) {
        this.infiniteLoopError(e.charCodeAt(0));
        break;
      }
    }
    return t;
  }
  infiniteLoopError(e) {
    let t = "Infinite loop on byte: " + e;
    if (this.options.silent) console.error(t);
    else throw new Error(t);
  }
};
var y = class {
  options;
  parser;
  constructor(e) {
    this.options = e || T;
  }
  space(e) {
    return "";
  }
  code({ text: e, lang: t, escaped: n }) {
    let s = (t || "").match(m.notSpaceStart)?.[0], r = e.replace(m.endingNewline, "") + `
`;
    return s ? '<pre><code class="language-' + O(s) + '">' + (n ? r : O(r, true)) + `</code></pre>
` : "<pre><code>" + (n ? r : O(r, true)) + `</code></pre>
`;
  }
  blockquote({ tokens: e }) {
    return `<blockquote>
${this.parser.parse(e)}</blockquote>
`;
  }
  html({ text: e }) {
    return e;
  }
  def(e) {
    return "";
  }
  heading({ tokens: e, depth: t }) {
    return `<h${t}>${this.parser.parseInline(e)}</h${t}>
`;
  }
  hr(e) {
    return `<hr>
`;
  }
  list(e) {
    let t = e.ordered, n = e.start, s = "";
    for (let o = 0; o < e.items.length; o++) {
      let u = e.items[o];
      s += this.listitem(u);
    }
    let r = t ? "ol" : "ul", i = t && n !== 1 ? ' start="' + n + '"' : "";
    return "<" + r + i + `>
` + s + "</" + r + `>
`;
  }
  listitem(e) {
    return `<li>${this.parser.parse(e.tokens)}</li>
`;
  }
  checkbox({ checked: e }) {
    return "<input " + (e ? 'checked="" ' : "") + 'disabled="" type="checkbox"> ';
  }
  paragraph({ tokens: e }) {
    return `<p>${this.parser.parseInline(e)}</p>
`;
  }
  table(e) {
    let t = "", n = "";
    for (let r = 0; r < e.header.length; r++) n += this.tablecell(e.header[r]);
    t += this.tablerow({ text: n });
    let s = "";
    for (let r = 0; r < e.rows.length; r++) {
      let i = e.rows[r];
      n = "";
      for (let o = 0; o < i.length; o++) n += this.tablecell(i[o]);
      s += this.tablerow({ text: n });
    }
    return s && (s = `<tbody>${s}</tbody>`), `<table>
<thead>
` + t + `</thead>
` + s + `</table>
`;
  }
  tablerow({ text: e }) {
    return `<tr>
${e}</tr>
`;
  }
  tablecell(e) {
    let t = this.parser.parseInline(e.tokens), n = e.header ? "th" : "td";
    return (e.align ? `<${n} align="${e.align}">` : `<${n}>`) + t + `</${n}>
`;
  }
  strong({ tokens: e }) {
    return `<strong>${this.parser.parseInline(e)}</strong>`;
  }
  em({ tokens: e }) {
    return `<em>${this.parser.parseInline(e)}</em>`;
  }
  codespan({ text: e }) {
    return `<code>${O(e, true)}</code>`;
  }
  br(e) {
    return "<br>";
  }
  del({ tokens: e }) {
    return `<del>${this.parser.parseInline(e)}</del>`;
  }
  link({ href: e, title: t, tokens: n }) {
    let s = this.parser.parseInline(n), r = V(e);
    if (r === null) return s;
    e = r;
    let i = '<a href="' + e + '"';
    return t && (i += ' title="' + O(t) + '"'), i += ">" + s + "</a>", i;
  }
  image({ href: e, title: t, text: n, tokens: s }) {
    s && (n = this.parser.parseInline(s, this.parser.textRenderer));
    let r = V(e);
    if (r === null) return O(n);
    e = r;
    let i = `<img src="${e}" alt="${O(n)}"`;
    return t && (i += ` title="${O(t)}"`), i += ">", i;
  }
  text(e) {
    return "tokens" in e && e.tokens ? this.parser.parseInline(e.tokens) : "escaped" in e && e.escaped ? e.text : O(e.text);
  }
};
var L = class {
  strong({ text: e }) {
    return e;
  }
  em({ text: e }) {
    return e;
  }
  codespan({ text: e }) {
    return e;
  }
  del({ text: e }) {
    return e;
  }
  html({ text: e }) {
    return e;
  }
  text({ text: e }) {
    return e;
  }
  link({ text: e }) {
    return "" + e;
  }
  image({ text: e }) {
    return "" + e;
  }
  br() {
    return "";
  }
  checkbox({ raw: e }) {
    return e;
  }
};
var b = class l2 {
  options;
  renderer;
  textRenderer;
  constructor(e) {
    this.options = e || T, this.options.renderer = this.options.renderer || new y(), this.renderer = this.options.renderer, this.renderer.options = this.options, this.renderer.parser = this, this.textRenderer = new L();
  }
  static parse(e, t) {
    return new l2(t).parse(e);
  }
  static parseInline(e, t) {
    return new l2(t).parseInline(e);
  }
  parse(e) {
    this.renderer.parser = this;
    let t = "";
    for (let n = 0; n < e.length; n++) {
      let s = e[n];
      if (this.options.extensions?.renderers?.[s.type]) {
        let i = s, o = this.options.extensions.renderers[i.type].call({ parser: this }, i);
        if (o !== false || !["space", "hr", "heading", "code", "table", "blockquote", "list", "html", "def", "paragraph", "text"].includes(i.type)) {
          t += o || "";
          continue;
        }
      }
      let r = s;
      switch (r.type) {
        case "space": {
          t += this.renderer.space(r);
          break;
        }
        case "hr": {
          t += this.renderer.hr(r);
          break;
        }
        case "heading": {
          t += this.renderer.heading(r);
          break;
        }
        case "code": {
          t += this.renderer.code(r);
          break;
        }
        case "table": {
          t += this.renderer.table(r);
          break;
        }
        case "blockquote": {
          t += this.renderer.blockquote(r);
          break;
        }
        case "list": {
          t += this.renderer.list(r);
          break;
        }
        case "checkbox": {
          t += this.renderer.checkbox(r);
          break;
        }
        case "html": {
          t += this.renderer.html(r);
          break;
        }
        case "def": {
          t += this.renderer.def(r);
          break;
        }
        case "paragraph": {
          t += this.renderer.paragraph(r);
          break;
        }
        case "text": {
          t += this.renderer.text(r);
          break;
        }
        default: {
          let i = 'Token with "' + r.type + '" type was not found.';
          if (this.options.silent) return console.error(i), "";
          throw new Error(i);
        }
      }
    }
    return t;
  }
  parseInline(e, t = this.renderer) {
    this.renderer.parser = this;
    let n = "";
    for (let s = 0; s < e.length; s++) {
      let r = e[s];
      if (this.options.extensions?.renderers?.[r.type]) {
        let o = this.options.extensions.renderers[r.type].call({ parser: this }, r);
        if (o !== false || !["escape", "html", "link", "image", "strong", "em", "codespan", "br", "del", "text"].includes(r.type)) {
          n += o || "";
          continue;
        }
      }
      let i = r;
      switch (i.type) {
        case "escape": {
          n += t.text(i);
          break;
        }
        case "html": {
          n += t.html(i);
          break;
        }
        case "link": {
          n += t.link(i);
          break;
        }
        case "image": {
          n += t.image(i);
          break;
        }
        case "checkbox": {
          n += t.checkbox(i);
          break;
        }
        case "strong": {
          n += t.strong(i);
          break;
        }
        case "em": {
          n += t.em(i);
          break;
        }
        case "codespan": {
          n += t.codespan(i);
          break;
        }
        case "br": {
          n += t.br(i);
          break;
        }
        case "del": {
          n += t.del(i);
          break;
        }
        case "text": {
          n += t.text(i);
          break;
        }
        default: {
          let o = 'Token with "' + i.type + '" type was not found.';
          if (this.options.silent) return console.error(o), "";
          throw new Error(o);
        }
      }
    }
    return n;
  }
};
var P = class {
  options;
  block;
  constructor(e) {
    this.options = e || T;
  }
  static passThroughHooks = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens", "emStrongMask"]);
  static passThroughHooksRespectAsync = /* @__PURE__ */ new Set(["preprocess", "postprocess", "processAllTokens"]);
  preprocess(e) {
    return e;
  }
  postprocess(e) {
    return e;
  }
  processAllTokens(e) {
    return e;
  }
  emStrongMask(e) {
    return e;
  }
  provideLexer(e = this.block) {
    return e ? x.lex : x.lexInline;
  }
  provideParser(e = this.block) {
    return e ? b.parse : b.parseInline;
  }
};
var q = class {
  defaults = M();
  options = this.setOptions;
  parse = this.parseMarkdown(true);
  parseInline = this.parseMarkdown(false);
  Parser = b;
  Renderer = y;
  TextRenderer = L;
  Lexer = x;
  Tokenizer = w;
  Hooks = P;
  constructor(...e) {
    this.use(...e);
  }
  walkTokens(e, t) {
    let n = [];
    for (let s of e) switch (n = n.concat(t.call(this, s)), s.type) {
      case "table": {
        let r = s;
        for (let i of r.header) n = n.concat(this.walkTokens(i.tokens, t));
        for (let i of r.rows) for (let o of i) n = n.concat(this.walkTokens(o.tokens, t));
        break;
      }
      case "list": {
        let r = s;
        n = n.concat(this.walkTokens(r.items, t));
        break;
      }
      default: {
        let r = s;
        this.defaults.extensions?.childTokens?.[r.type] ? this.defaults.extensions.childTokens[r.type].forEach((i) => {
          let o = r[i].flat(1 / 0);
          n = n.concat(this.walkTokens(o, t));
        }) : r.tokens && (n = n.concat(this.walkTokens(r.tokens, t)));
      }
    }
    return n;
  }
  use(...e) {
    let t = this.defaults.extensions || { renderers: {}, childTokens: {} };
    return e.forEach((n) => {
      let s = { ...n };
      if (s.async = this.defaults.async || s.async || false, n.extensions && (n.extensions.forEach((r) => {
        if (!r.name) throw new Error("extension name required");
        if ("renderer" in r) {
          let i = t.renderers[r.name];
          i ? t.renderers[r.name] = function(...o) {
            let u = r.renderer.apply(this, o);
            return u === false && (u = i.apply(this, o)), u;
          } : t.renderers[r.name] = r.renderer;
        }
        if ("tokenizer" in r) {
          if (!r.level || r.level !== "block" && r.level !== "inline") throw new Error("extension level must be 'block' or 'inline'");
          let i = t[r.level];
          i ? i.unshift(r.tokenizer) : t[r.level] = [r.tokenizer], r.start && (r.level === "block" ? t.startBlock ? t.startBlock.push(r.start) : t.startBlock = [r.start] : r.level === "inline" && (t.startInline ? t.startInline.push(r.start) : t.startInline = [r.start]));
        }
        "childTokens" in r && r.childTokens && (t.childTokens[r.name] = r.childTokens);
      }), s.extensions = t), n.renderer) {
        let r = this.defaults.renderer || new y(this.defaults);
        for (let i in n.renderer) {
          if (!(i in r)) throw new Error(`renderer '${i}' does not exist`);
          if (["options", "parser"].includes(i)) continue;
          let o = i, u = n.renderer[o], a = r[o];
          r[o] = (...c) => {
            let p = u.apply(r, c);
            return p === false && (p = a.apply(r, c)), p || "";
          };
        }
        s.renderer = r;
      }
      if (n.tokenizer) {
        let r = this.defaults.tokenizer || new w(this.defaults);
        for (let i in n.tokenizer) {
          if (!(i in r)) throw new Error(`tokenizer '${i}' does not exist`);
          if (["options", "rules", "lexer"].includes(i)) continue;
          let o = i, u = n.tokenizer[o], a = r[o];
          r[o] = (...c) => {
            let p = u.apply(r, c);
            return p === false && (p = a.apply(r, c)), p;
          };
        }
        s.tokenizer = r;
      }
      if (n.hooks) {
        let r = this.defaults.hooks || new P();
        for (let i in n.hooks) {
          if (!(i in r)) throw new Error(`hook '${i}' does not exist`);
          if (["options", "block"].includes(i)) continue;
          let o = i, u = n.hooks[o], a = r[o];
          P.passThroughHooks.has(i) ? r[o] = (c) => {
            if (this.defaults.async && P.passThroughHooksRespectAsync.has(i)) return (async () => {
              let k = await u.call(r, c);
              return a.call(r, k);
            })();
            let p = u.call(r, c);
            return a.call(r, p);
          } : r[o] = (...c) => {
            if (this.defaults.async) return (async () => {
              let k = await u.apply(r, c);
              return k === false && (k = await a.apply(r, c)), k;
            })();
            let p = u.apply(r, c);
            return p === false && (p = a.apply(r, c)), p;
          };
        }
        s.hooks = r;
      }
      if (n.walkTokens) {
        let r = this.defaults.walkTokens, i = n.walkTokens;
        s.walkTokens = function(o) {
          let u = [];
          return u.push(i.call(this, o)), r && (u = u.concat(r.call(this, o))), u;
        };
      }
      this.defaults = { ...this.defaults, ...s };
    }), this;
  }
  setOptions(e) {
    return this.defaults = { ...this.defaults, ...e }, this;
  }
  lexer(e, t) {
    return x.lex(e, t ?? this.defaults);
  }
  parser(e, t) {
    return b.parse(e, t ?? this.defaults);
  }
  parseMarkdown(e) {
    return (n, s) => {
      let r = { ...s }, i = { ...this.defaults, ...r }, o = this.onError(!!i.silent, !!i.async);
      if (this.defaults.async === true && r.async === false) return o(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));
      if (typeof n > "u" || n === null) return o(new Error("marked(): input parameter is undefined or null"));
      if (typeof n != "string") return o(new Error("marked(): input parameter is of type " + Object.prototype.toString.call(n) + ", string expected"));
      if (i.hooks && (i.hooks.options = i, i.hooks.block = e), i.async) return (async () => {
        let u = i.hooks ? await i.hooks.preprocess(n) : n, c = await (i.hooks ? await i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(u, i), p = i.hooks ? await i.hooks.processAllTokens(c) : c;
        i.walkTokens && await Promise.all(this.walkTokens(p, i.walkTokens));
        let h = await (i.hooks ? await i.hooks.provideParser(e) : e ? b.parse : b.parseInline)(p, i);
        return i.hooks ? await i.hooks.postprocess(h) : h;
      })().catch(o);
      try {
        i.hooks && (n = i.hooks.preprocess(n));
        let a = (i.hooks ? i.hooks.provideLexer(e) : e ? x.lex : x.lexInline)(n, i);
        i.hooks && (a = i.hooks.processAllTokens(a)), i.walkTokens && this.walkTokens(a, i.walkTokens);
        let p = (i.hooks ? i.hooks.provideParser(e) : e ? b.parse : b.parseInline)(a, i);
        return i.hooks && (p = i.hooks.postprocess(p)), p;
      } catch (u) {
        return o(u);
      }
    };
  }
  onError(e, t) {
    return (n) => {
      if (n.message += `
Please report this to https://github.com/markedjs/marked.`, e) {
        let s = "<p>An error occurred:</p><pre>" + O(n.message + "", true) + "</pre>";
        return t ? Promise.resolve(s) : s;
      }
      if (t) return Promise.reject(n);
      throw n;
    };
  }
};
var z = new q();
function g(l3, e) {
  return z.parse(l3, e);
}
g.options = g.setOptions = function(l3) {
  return z.setOptions(l3), g.defaults = z.defaults, N(g.defaults), g;
};
g.getDefaults = M;
g.defaults = T;
g.use = function(...l3) {
  return z.use(...l3), g.defaults = z.defaults, N(g.defaults), g;
};
g.walkTokens = function(l3, e) {
  return z.walkTokens(l3, e);
};
g.parseInline = z.parseInline;
g.Parser = b;
g.parser = b.parse;
g.Renderer = y;
g.TextRenderer = L;
g.Lexer = x;
g.lexer = x.lex;
g.Tokenizer = w;
g.Hooks = P;
g.parse = g;
var Ft = g.options;
var Ut = g.setOptions;
var Kt = g.use;
var Wt = g.walkTokens;
var Xt = g.parseInline;
var Vt = b.parse;
var Yt = x.lex;

// src/utils.js
var $2 = (id) => document.getElementById(id);
function fmtBytes(n) {
  if (n == null) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " K";
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " M";
  return (n / 1024 / 1024 / 1024).toFixed(1) + " G";
}
function fmtBytesShort(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(0) + " KB";
  return (n / (1024 * 1024)).toFixed(1) + " MB";
}
function fmtRelative(ts) {
  if (!ts) return "";
  const norm = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z";
  const t = Date.parse(norm);
  if (!t) return "";
  const sec = Math.max(0, (Date.now() - t) / 1e3);
  if (sec < 60) return "just now";
  if (sec < 3600) return Math.floor(sec / 60) + "m";
  if (sec < 86400) return Math.floor(sec / 3600) + "h";
  if (sec < 86400 * 7) return Math.floor(sec / 86400) + "d";
  return new Date(t).toLocaleDateString();
}
function fmtAbsolute(ts) {
  if (!ts) return "";
  const norm = ts.includes("T") ? ts : ts.replace(" ", "T") + "Z";
  const t = Date.parse(norm);
  if (!t) return "";
  return new Date(t).toLocaleString();
}
function tsHTML(ts, cls) {
  const rel = fmtRelative(ts);
  if (!rel) return "";
  return `<span class="${cls || "ts"}" title="${escapeAttr(fmtAbsolute(ts))}">${escapeHtml(rel)}</span>`;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function escapeAttr(s) {
  return escapeHtml(s);
}
function parentPath(p) {
  const i = p.lastIndexOf("/");
  return i < 0 ? "" : p.slice(0, i);
}
function emptyDiv(text) {
  const d2 = document.createElement("div");
  d2.className = "empty";
  d2.textContent = text;
  return d2;
}
function renderMarkdown(text) {
  try {
    return g.parse(text || "", { breaks: true, gfm: true });
  } catch (_2) {
    return null;
  }
}
function rewriteFileLinks(root, onNavFile) {
  if (!state.groupId) return;
  const gid = encodeURIComponent(state.groupId);
  const isExternal = (h) => /^[a-z][a-z0-9+.-]*:/i.test(h) || h.startsWith("#") || h.startsWith("//") || h.startsWith("mailto:");
  const normalizeRel = (p) => String(p || "").replace(/^\.?\/+/, "").replace(/^workspace\/+/, "");
  const toFileUrl = (rel) => `api/groups/${gid}/file?path=${encodeURIComponent(rel)}`;
  const attachPreviewClick = (a, rel) => {
    a.addEventListener("click", (ev) => {
      if (ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      ev.preventDefault();
      const entry = { path: rel, name: rel.slice(rel.lastIndexOf("/") + 1) };
      onNavFile(entry).catch(console.error);
    });
  };
  root.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (!href || isExternal(href)) return;
    const rel = normalizeRel(href);
    if (!rel) return;
    a.setAttribute("href", toFileUrl(rel));
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener");
    attachPreviewClick(a, rel);
  });
  const fileLikeRe = /^[\w.\-/ ]+\.[A-Za-z0-9]{1,8}$/;
  root.querySelectorAll("code").forEach((c) => {
    if (c.closest("pre")) return;
    const txt = c.textContent || "";
    if (!fileLikeRe.test(txt)) return;
    if (txt.length > 200) return;
    const rel = normalizeRel(txt);
    if (!rel) return;
    const a = document.createElement("a");
    a.href = toFileUrl(rel);
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = txt;
    attachPreviewClick(a, rel);
    c.replaceWith(a);
  });
}

// src/api.js
async function api(url, opts) {
  const r = await fetch(url, Object.assign({ credentials: "same-origin" }, opts || {}));
  if (r.status === 401) {
    document.body.innerHTML = '<div style="padding:24px;font:14px system-ui">Not logged in. Visit the magic link your operator sent you.</div>';
    throw new Error("unauthorized");
  }
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
async function postJson(path, body) {
  const res = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json().catch(() => ({})) : {};
  return { ok: res.ok, status: res.status, data };
}

// src/panels.js
function restorePanelState() {
  try {
    for (const p of PANES) {
      const v2 = localStorage.getItem(`nc:pane:${p.key}`);
      if (v2 !== null) state.paneOpen[p.key] = v2 === "1";
    }
  } catch (_2) {
  }
  applyPanelClasses();
}
function persistPanelState() {
  try {
    for (const p of PANES) localStorage.setItem(`nc:pane:${p.key}`, state.paneOpen[p.key] ? "1" : "0");
  } catch (_2) {
  }
}
function applyPanelClasses() {
  const main = $2("main");
  const mobile = MOBILE_MQ.matches;
  for (const p of PANES) {
    const open = state.paneOpen[p.key];
    main.classList.toggle(p.mainClass, !mobile && !open);
    $2(p.id).classList.toggle("collapsed", !mobile && !open);
  }
}
function stopPreviewMedia() {
  const pv = $2("preview");
  if (!pv) return;
  for (const m2 of pv.querySelectorAll("audio, video")) {
    try {
      m2.pause();
      m2.currentTime = 0;
    } catch (_2) {
    }
  }
}
function togglePane(key) {
  state.paneOpen[key] = !state.paneOpen[key];
  if (key === "files" && !state.paneOpen.files) stopPreviewMedia();
  applyPanelClasses();
  persistPanelState();
}
function openFilesDrawerIfMobile() {
  if (!MOBILE_MQ.matches) return;
  for (const p of PANES) $2(p.id).classList.toggle("open", p.key === "files");
  $2("backdrop").classList.add("show");
}
function closeMobileDrawers() {
  if ($2("files-pane").classList.contains("open") && $2("files-pane").classList.contains("previewing")) stopPreviewMedia();
  for (const p of PANES) $2(p.id).classList.remove("open");
  $2("backdrop").classList.remove("show");
}
function toggleMobileDrawer(which) {
  const target = $2(PANES.find((p) => p.key === which).id);
  const willOpen = !target.classList.contains("open");
  if ($2("files-pane").classList.contains("open") && !(which === "files" && willOpen)) stopPreviewMedia();
  for (const p of PANES) $2(p.id).classList.toggle("open", p.key === which && willOpen);
  $2("backdrop").classList.toggle("show", willOpen);
}
function notifMuted() {
  try {
    return localStorage.getItem(NOTIF_MUTE_KEY) === "1";
  } catch (_2) {
    return false;
  }
}
function setNotifMuted(v2) {
  try {
    localStorage.setItem(NOTIF_MUTE_KEY, v2 ? "1" : "0");
  } catch (_2) {
  }
}
function wireNotifButton() {
  const btn = document.getElementById("btn-notif");
  if (!btn) return;
  if (!("Notification" in window)) return;
  btn.hidden = false;
  refreshNotifButton();
  btn.addEventListener("click", async () => {
    if (Notification.permission === "denied") {
      alert("Notifications are blocked. Enable them in your browser/OS settings for this site.");
      return;
    }
    if (Notification.permission === "granted") {
      setNotifMuted(!notifMuted());
      refreshNotifButton();
      return;
    }
    try {
      await Notification.requestPermission();
    } catch (_2) {
    }
    if (Notification.permission === "granted") setNotifMuted(false);
    refreshNotifButton();
  });
}
function refreshNotifButton() {
  const btn = document.getElementById("btn-notif");
  if (!btn) return;
  const p = Notification.permission;
  const muted = p === "granted" && notifMuted();
  btn.textContent = p === "denied" || muted ? "\u{1F515}" : "\u{1F514}";
  btn.title = p === "denied" ? "Notifications blocked" : p === "granted" ? muted ? "Notifications muted \u2014 click to enable" : "Notifications enabled \u2014 click to mute" : "Enable notifications";
  btn.style.opacity = p === "granted" && !muted ? "1" : "0.6";
}
function maybeNotify(text, files) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (notifMuted()) return;
  if (!document.hidden) return;
  try {
    const groupId = chat.groupId || state.groupId || "";
    const g2 = state.groups.find((x2) => x2.id === groupId);
    const title = g2 && g2.name ? g2.name : "NanoClaw";
    let body = (text || "").trim().slice(0, 200);
    if (!body && files && files.length) body = `\u{1F4CE} ${files.length} file${files.length > 1 ? "s" : ""}`;
    const n = new Notification(title, { body, icon: "icon.svg", tag: `${groupId}:${chat.threadId || ""}` });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch (_2) {
  }
}

// src/chat.js
async function loadThreads(groupId) {
  try {
    const { threads } = await api(`api/groups/${encodeURIComponent(groupId)}/chat/threads`);
    chat.threads = threads || [];
  } catch (err) {
    console.error("threads load failed", err);
    chat.threads = [];
  }
  renderThreads();
}
function threadCtx(t) {
  if (!t) return null;
  if (!t.channelType || t.channelType === "web") return null;
  return { channelType: t.channelType, messagingGroupId: t.messagingGroupId, canSend: !!t.canSend };
}
function renderThreads() {
  const list = $2("threads-list");
  list.innerHTML = "";
  if (chat.threads.length === 0) {
    list.appendChild(emptyDiv("No chats yet"));
    return;
  }
  for (const t of chat.threads) {
    const ct = t.channelType || "web";
    const meta = channelMeta(ct);
    const pill = ct !== "web" ? `<span class="ch-pill" title="${escapeHtml(meta.label)}${t.counterparty ? " \xB7 " + escapeHtml(t.counterparty) : ""}">${meta.icon}</span>` : "";
    const row = document.createElement("div");
    row.className = "thread" + (t.threadId === chat.threadId ? " active" : "");
    row.dataset.id = t.threadId;
    const subMeta = `${tsHTML(t.lastActivityAt)}${t.messageCount ? " \xB7 " + t.messageCount + " msg" : ""}${ct !== "web" && t.counterparty ? " \xB7 " + escapeHtml(t.counterparty) : ""}`;
    const delBtn = ct === "web" ? '<button type="button" class="del" title="Delete chat" aria-label="Delete chat">\xD7</button>' : "";
    row.innerHTML = `
        <div class="title">${pill}${escapeHtml(t.title)}</div>
        <div class="meta">${subMeta}</div>
        ${delBtn}`;
    row.addEventListener("click", (ev) => {
      if (ev.target.classList.contains("del")) return;
      openChat(state.groupId, t.threadId, threadCtx(t)).catch((err) => console.error("chat open failed", err));
      closeMobileDrawers();
    });
    const del = row.querySelector(".del");
    if (del) del.addEventListener("click", async (ev) => {
      ev.stopPropagation();
      if (!confirm(`Delete this chat?

"${t.title}"`)) return;
      await deleteThread(t.threadId);
    });
    list.appendChild(row);
  }
}
async function deleteThread(threadId) {
  try {
    const r = await fetch(`api/groups/${encodeURIComponent(state.groupId)}/chat/${encodeURIComponent(threadId)}`, {
      method: "DELETE",
      credentials: "same-origin"
    });
    if (!r.ok) {
      setChatStatus("delete failed (HTTP " + r.status + ")");
      return;
    }
  } catch (err) {
    console.error("delete failed", err);
    setChatStatus("delete failed: " + (err.message || "network error"));
    return;
  }
  chat.threads = chat.threads.filter((x2) => x2.threadId !== threadId);
  if (chat.threadId === threadId) {
    const latest = chat.threads.length > 0 ? chat.threads[0] : null;
    if (latest) openChat(state.groupId, latest.threadId, threadCtx(latest)).catch(console.error);
    else {
      clearChat();
      chat.threadId = null;
      writeHash();
    }
  }
  renderThreads();
}
function bumpActiveThread(maxTs) {
  if (!chat.threadId) return;
  const idx = chat.threads.findIndex((x2) => x2.threadId === chat.threadId);
  if (idx < 0) {
    loadThreads(state.groupId);
    return;
  }
  const t = chat.threads[idx];
  t.lastActivityAt = maxTs || (/* @__PURE__ */ new Date()).toISOString();
  t.messageCount = (t.messageCount || 0) + 1;
  chat.threads.splice(idx, 1);
  chat.threads.unshift(t);
  renderThreads();
}
function updateActiveThreadTitleFromFirstMessage(text) {
  if (!chat.threadId) return;
  const t = chat.threads.find((x2) => x2.threadId === chat.threadId);
  if (t && t.title === "(new chat)") {
    const clean = String(text || "").replace(/^>\s*Context[^\n]*\n+/i, "").replace(/\s+/g, " ").trim();
    if (clean) {
      t.title = clean.slice(0, 60);
      renderThreads();
    }
  }
}
function clearChat() {
  $2("chat-log").innerHTML = '<div class="empty">Pick or start a chat.</div>';
  setChatStatus("");
  stopChatPoll();
  if (chat.ws) {
    try {
      chat.ws.close();
    } catch (_2) {
    }
    chat.ws = null;
  }
  if (chat.reconnectTimer) {
    clearTimeout(chat.reconnectTimer);
    chat.reconnectTimer = null;
  }
  chat.channelType = "web";
  chat.messagingGroupId = null;
  chat.canSend = true;
  chat.lastSeenTs = "";
  setComposerMode("web", true);
}
function setComposerMode(channelType, canSend) {
  const form = $2("chat-form");
  const banner = $2("chat-readonly");
  const subnotice = $2("chat-subnotice");
  const isWeb = !channelType || channelType === "web";
  const showComposer = isWeb || canSend;
  if (form) form.style.display = showComposer ? "" : "none";
  if (banner) {
    banner.hidden = showComposer;
    if (!showComposer) {
      const meta = channelMeta(channelType);
      banner.textContent = `Read-only view \u2014 reply on ${meta.label} to continue this thread.`;
    } else {
      banner.textContent = "";
    }
  }
  if (subnotice) {
    if (showComposer && !isWeb) {
      const meta = channelMeta(channelType);
      const t = chat.threads.find((x2) => x2.threadId === chat.threadId);
      const cp = t && t.counterparty ? ` \xB7 ${t.counterparty}` : "";
      subnotice.hidden = false;
      subnotice.textContent = `${meta.icon} Sending via ${meta.label}${cp}`;
    } else {
      subnotice.hidden = true;
      subnotice.textContent = "";
    }
  }
}
function stopChatPoll() {
  if (chat.pollTimer) {
    clearInterval(chat.pollTimer);
    chat.pollTimer = null;
  }
}
function startChatPoll() {
  stopChatPoll();
  chat.pollTimer = setInterval(async () => {
    if (!chat.threadId || chat.channelType === "web") {
      stopChatPoll();
      return;
    }
    try {
      await refetchThreadHistory(
        /*appendNewOnly*/
        true
      );
    } catch (err) {
      console.error("poll failed", err);
    }
  }, POLL_INTERVAL_MS);
}
function historyUrl(groupId, threadId) {
  let u = `api/groups/${encodeURIComponent(groupId)}/chat/${encodeURIComponent(threadId)}/history`;
  if (chat.channelType && chat.channelType !== "web" && chat.messagingGroupId) {
    u += `?channel=${encodeURIComponent(chat.channelType)}&mg=${encodeURIComponent(chat.messagingGroupId)}`;
  }
  return u;
}
async function refetchThreadHistory(appendNewOnly) {
  const groupId = chat.groupId, threadId = chat.threadId;
  const r = await fetch(historyUrl(groupId, threadId), { credentials: "same-origin" });
  if (!r.ok) return;
  const { messages } = await r.json();
  if (!Array.isArray(messages)) return;
  const tsKey = (s) => {
    if (!s) return 0;
    const norm = s.includes("T") ? s : s.replace(" ", "T") + "Z";
    const n = Date.parse(norm);
    return Number.isFinite(n) ? n : 0;
  };
  if (!appendNewOnly) {
    $2("chat-log").innerHTML = "";
    for (const msg of messages) appendChatMsg(msg.direction === "in" ? "in" : "out", msg.text, msg.files || null, msg.timestamp);
    if (messages.length > 0) chat.lastSeenTs = messages[messages.length - 1].timestamp || "";
    return;
  }
  const seenKey = tsKey(chat.lastSeenTs);
  let maxTs = chat.lastSeenTs;
  let maxKey = seenKey;
  let bumped = false;
  for (const msg of messages) {
    const ts = msg.timestamp || "";
    const k = tsKey(ts);
    if (!seenKey || k > seenKey) {
      appendChatMsg(msg.direction === "in" ? "in" : "out", msg.text, msg.files || null, ts);
      if (k > maxKey) {
        maxKey = k;
        maxTs = ts;
      }
      bumped = true;
      if (msg.direction !== "in") maybeNotify(msg.text, msg.files || []);
    }
  }
  if (bumped) {
    chat.lastSeenTs = maxTs || chat.lastSeenTs;
    bumpActiveThread(maxTs);
  }
}
function setChatStatus(text) {
  $2("chat-status").textContent = text || "";
}
function appendChatMsg(kind, text, files, ts) {
  const log = $2("chat-log");
  const placeholder = log.querySelector(".empty");
  if (placeholder) log.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "msg " + kind;
  const md = renderMarkdown(text);
  if (md != null) {
    wrap.classList.add("markdown");
    wrap.innerHTML = md;
    rewriteFileLinks(wrap, navFile);
  } else wrap.textContent = text || "";
  if (files && files.length) {
    const fl = document.createElement("div");
    fl.className = "files";
    fl.textContent = files.map((f) => `\u{1F4CE} ${f.filename} (${fmtBytes(f.size)})`).join("  ");
    wrap.appendChild(fl);
  }
  const metaHTML = tsHTML(ts || (/* @__PURE__ */ new Date()).toISOString(), "meta");
  if (metaHTML) {
    const meta = document.createElement("div");
    meta.innerHTML = metaHTML;
    wrap.appendChild(meta.firstChild);
  }
  log.appendChild(wrap);
  log.scrollTop = log.scrollHeight;
}
async function openChat(groupId, resumeThreadId, opts) {
  if (resumeThreadId && chat.groupId === groupId && chat.threadId === resumeThreadId) return;
  if (chat.ws) {
    try {
      chat.ws.close();
    } catch (_2) {
    }
    chat.ws = null;
  }
  if (chat.reconnectTimer) {
    clearTimeout(chat.reconnectTimer);
    chat.reconnectTimer = null;
  }
  stopChatPoll();
  chat.groupId = groupId;
  chat.threadId = null;
  chat.reconnectAttempt = 0;
  chat.lastSeenTs = "";
  $2("chat-log").innerHTML = "";
  let channelType = "web", messagingGroupId = null, canSend = true;
  if (opts && opts.channelType) {
    channelType = opts.channelType;
    messagingGroupId = opts.messagingGroupId || null;
    canSend = !!opts.canSend;
  } else if (resumeThreadId) {
    const t = chat.threads.find((x2) => x2.threadId === resumeThreadId);
    if (t && t.channelType && t.channelType !== "web") {
      channelType = t.channelType;
      messagingGroupId = t.messagingGroupId || null;
      canSend = !!t.canSend;
    }
  }
  chat.channelType = channelType;
  chat.messagingGroupId = messagingGroupId;
  chat.canSend = channelType === "web" ? true : canSend;
  setComposerMode(channelType, chat.canSend);
  if (resumeThreadId) {
    chat.threadId = resumeThreadId;
    renderThreads();
    writeHash();
    setChatStatus("loading history\u2026");
    try {
      const r = await fetch(historyUrl(groupId, resumeThreadId), { credentials: "same-origin" });
      if (r.ok) {
        const { messages } = await r.json();
        for (const msg of messages || []) appendChatMsg(msg.direction === "in" ? "in" : "out", msg.text, msg.files || null, msg.timestamp);
        if (Array.isArray(messages) && messages.length > 0) chat.lastSeenTs = messages[messages.length - 1].timestamp || "";
      }
    } catch (err) {
      console.error("history load failed", err);
    }
    if (channelType === "web") connectChatWs();
    else {
      setChatStatus("");
      startChatPoll();
    }
    return;
  }
  chat.channelType = "web";
  chat.messagingGroupId = null;
  chat.canSend = true;
  setComposerMode("web", true);
  setChatStatus("starting\u2026");
  let started;
  try {
    const r = await fetch(`api/groups/${encodeURIComponent(groupId)}/chat/start`, {
      method: "POST",
      credentials: "same-origin"
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    started = await r.json();
  } catch (err) {
    setChatStatus("failed to start chat: " + err.message);
    return;
  }
  chat.threadId = started.threadId;
  chat.threads.unshift({
    threadId: started.threadId,
    sessionId: started.sessionId || null,
    channelType: "web",
    messagingGroupId: started.messagingGroupId || null,
    sessionMode: started.sessionMode || "per-thread",
    title: "(new chat)",
    lastActivityAt: (/* @__PURE__ */ new Date()).toISOString(),
    messageCount: 0
  });
  renderThreads();
  writeHash();
  connectChatWs();
}
function connectChatWs() {
  if (!chat.groupId || !chat.threadId) return;
  const groupId = chat.groupId;
  const threadId = chat.threadId;
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${proto}//${location.host}/ui/chat/api/groups/${encodeURIComponent(groupId)}/chat/${encodeURIComponent(threadId)}/ws`;
  const ws = new WebSocket(wsUrl);
  chat.ws = ws;
  ws.onopen = () => {
    chat.reconnectAttempt = 0;
    setChatStatus("connected");
  };
  ws.onclose = () => {
    if (chat.ws !== ws) return;
    chat.ws = null;
    if (chat.groupId !== groupId || chat.threadId !== threadId) return;
    const attempt = ++chat.reconnectAttempt;
    const delay = Math.min(15e3, 500 * Math.pow(2, attempt - 1));
    setChatStatus(`disconnected \xB7 reconnecting in ${Math.round(delay / 1e3)}s\u2026`);
    chat.reconnectTimer = setTimeout(() => {
      chat.reconnectTimer = null;
      if (chat.groupId === groupId && chat.threadId === threadId) connectChatWs();
    }, delay);
  };
  ws.onerror = () => setChatStatus("connection error");
  ws.onmessage = (ev) => {
    let payload;
    try {
      payload = JSON.parse(ev.data);
    } catch (_2) {
      return;
    }
    if (payload.kind === "ready") return;
    if (payload.kind === "inbound") {
      appendChatMsg("in", payload.text, payload.files || null, payload.timestamp);
      updateActiveThreadTitleFromFirstMessage(payload.text);
      bumpActiveThread();
      return;
    }
    if (payload.kind === "outbound") {
      const c = payload.content || {};
      const text = typeof c === "string" ? c : c.text || c.markdown || "";
      appendChatMsg("out", text, payload.files || [], payload.timestamp);
      bumpActiveThread();
      maybeNotify(text, payload.files || []);
      return;
    }
  };
}
async function sendChat(text, files) {
  if (!chat.groupId || !chat.threadId) return;
  const isWeb = !chat.channelType || chat.channelType === "web";
  const hasFiles = Array.isArray(files) && files.length > 0;
  if (!isWeb) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const fileMetas = hasFiles ? files.map((f) => ({ filename: f.name, size: f.size })) : null;
    appendChatMsg("out", text || "", fileMetas, now);
    chat.lastSeenTs = now;
  }
  let url = `api/groups/${encodeURIComponent(chat.groupId)}/chat/${encodeURIComponent(chat.threadId)}/send`;
  if (!isWeb && chat.messagingGroupId) {
    url += `?channel=${encodeURIComponent(chat.channelType)}&mg=${encodeURIComponent(chat.messagingGroupId)}`;
  }
  try {
    let res;
    if (hasFiles) {
      const fd = new FormData();
      fd.append("text", text || "");
      for (const f of files) fd.append("file", f, f.name);
      res = await fetch(url, { method: "POST", credentials: "same-origin", body: fd });
    } else {
      res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
    }
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const j2 = await res.json();
        if (j2 && j2.error) detail = j2.error + (j2.detail ? ` (${j2.detail})` : "");
      } catch (_2) {
      }
      setChatStatus(`send failed: ${detail}`);
    }
  } catch (err) {
    console.error("send failed", err);
    setChatStatus(`send failed: ${err && err.message ? err.message : "network error"}`);
  }
}
function renderPending() {
  const tray = $2("chat-pending");
  if (!tray) return;
  if (chat.pending.length === 0) {
    tray.hidden = true;
    tray.innerHTML = "";
    return;
  }
  tray.hidden = false;
  tray.innerHTML = "";
  chat.pending.forEach((f, i) => {
    const item = document.createElement("span");
    item.className = "item";
    item.textContent = `\u{1F4CE} ${f.name} (${fmtBytesShort(f.size)})`;
    const x2 = document.createElement("button");
    x2.type = "button";
    x2.textContent = "\xD7";
    x2.title = "Remove";
    x2.addEventListener("click", () => {
      chat.pending.splice(i, 1);
      renderPending();
    });
    item.appendChild(x2);
    tray.appendChild(item);
  });
}
function addPendingFiles(files) {
  if (!files || files.length === 0) return;
  let totalBytes = chat.pending.reduce((n, f) => n + f.size, 0);
  for (const f of files) {
    if (chat.pending.length >= UPLOAD_MAX_FILES) {
      setChatStatus(`max ${UPLOAD_MAX_FILES} files per message`);
      break;
    }
    if (f.size > UPLOAD_MAX_FILE_SIZE) {
      setChatStatus(`${f.name} too large (max ${fmtBytesShort(UPLOAD_MAX_FILE_SIZE)})`);
      continue;
    }
    if (totalBytes + f.size > UPLOAD_MAX_TOTAL_SIZE) {
      setChatStatus(`total upload too large (max ${fmtBytesShort(UPLOAD_MAX_TOTAL_SIZE)})`);
      break;
    }
    chat.pending.push(f);
    totalBytes += f.size;
  }
  renderPending();
}

// src/uploads.js
function curDir() {
  return state.path || "";
}
function joinPath(dir, name) {
  return dir ? dir + "/" + name : name;
}
async function mkdirPrompt() {
  if (!state.groupId || !state.isAdmin) return;
  const name = prompt("New folder name:");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const target = joinPath(curDir(), trimmed);
  const r = await postJson(`api/groups/${state.groupId}/mkdir`, { path: target });
  if (!r.ok) {
    alert("mkdir failed: " + (r.data.error || r.status));
    return;
  }
  await loadTree(state.path);
}
async function touchPrompt() {
  if (!state.groupId || !state.isAdmin) return;
  const name = prompt("New file name:");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  const target = joinPath(curDir(), trimmed);
  const r = await postJson(`api/groups/${state.groupId}/touch`, { path: target });
  if (!r.ok) {
    alert("create file failed: " + (r.data.error || r.status));
    return;
  }
  await loadTree(state.path);
}
async function renameEntry(entry) {
  if (!state.isAdmin) return;
  const next = prompt("Rename to:", entry.name);
  if (!next) return;
  const trimmed = next.trim();
  if (!trimmed || trimmed === entry.name) return;
  const dir = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "";
  const toPath = joinPath(dir, trimmed);
  const r = await postJson(`api/groups/${state.groupId}/rename`, { from: entry.path, to: toPath });
  if (!r.ok) {
    alert("rename failed: " + (r.data.error || r.status));
    return;
  }
  await loadTree(state.path);
}
async function deleteEntry(entry) {
  if (!state.isAdmin) return;
  if (!confirm(`Delete ${entry.type === "dir" ? "folder" : "file"} "${entry.name}"?`)) return;
  const r = await postJson(`api/groups/${state.groupId}/delete`, { path: entry.path });
  if (!r.ok) {
    alert("delete failed: " + (r.data.error || r.status));
    return;
  }
  await loadTree(state.path);
}
function clearUploadStrip() {
  uploadState.items = [];
  const strip = document.getElementById("upload-strip");
  if (strip) {
    strip.innerHTML = "";
    strip.hidden = true;
  }
}
function ensureUploadStrip() {
  const strip = document.getElementById("upload-strip");
  strip.hidden = false;
  return strip;
}
function renderUploadStrip() {
  const strip = ensureUploadStrip();
  strip.innerHTML = "";
  for (const item of uploadState.items) {
    const row = document.createElement("div");
    row.className = "row " + item.status;
    const progress = item.status === "uploading" ? `<div class="bar"><i style="width:${Math.round(item.pct || 0)}%"></i></div>` : "";
    let actions = "";
    if (item.status === "conflict") {
      actions = '<div class="actions"><button data-act="overwrite" title="Replace existing file">Overwrite</button><button data-act="rename" title="Save with a unique name">Rename</button><button data-act="skip" title="Cancel this upload">Skip</button></div>';
    }
    const status = item.statusText || item.status;
    row.innerHTML = `<div class="name">${escapeHtml(item.name)}</div>${progress}<div class="status">${escapeHtml(status)}</div>${actions}`;
    row.querySelectorAll("button[data-act]").forEach((b2) => {
      b2.addEventListener("click", () => resolveConflict(item, b2.dataset.act));
    });
    strip.appendChild(row);
  }
  const anyDone = uploadState.items.length > 0 && uploadState.items.every((i) => i.status !== "uploading");
  if (anyDone) {
    const footer = document.createElement("div");
    footer.className = "footer";
    const okPaths = uploadState.items.filter((i) => i.status === "ok" && i.path).map((i) => i.path);
    const wakeDisabled = okPaths.length === 0 || !chat.threadId ? "disabled" : "";
    const wakeTitle = !chat.threadId ? "Open a chat first" : `Send a message to the agent listing ${okPaths.length} updated file(s)`;
    footer.innerHTML = `<button data-act="wake" ${wakeDisabled} title="${escapeAttr(wakeTitle)}">Notify agent</button><button class="close" data-act="close" title="Dismiss">\u2715</button>`;
    footer.querySelector('[data-act="wake"]').addEventListener("click", () => notifyAgent(okPaths));
    footer.querySelector('[data-act="close"]').addEventListener("click", clearUploadStrip);
    strip.appendChild(footer);
  }
}
async function notifyAgent(paths) {
  if (!chat.threadId || !state.groupId || paths.length === 0) return;
  const list = paths.slice(0, 20).map((p) => "`" + p + "`").join(", ");
  const more = paths.length > 20 ? ` (and ${paths.length - 20} more)` : "";
  const text = `Files updated via web UI: ${list}${more}`;
  const r = await postJson(`api/groups/${state.groupId}/chat/${chat.threadId}/send`, { text });
  if (!r.ok) {
    alert("notify failed: " + (r.data.error || r.status));
    return;
  }
  clearUploadStrip();
}
function resolveConflict(item, action) {
  if (action === "skip") {
    item.status = "error";
    item.statusText = "skipped";
    renderUploadStrip();
    return;
  }
  item.status = "uploading";
  item.pct = 0;
  item.statusText = "uploading\u2026";
  renderUploadStrip();
  uploadOne(item, action).catch((err) => {
    item.status = "error";
    item.statusText = String(err && err.message || err);
    renderUploadStrip();
  });
}
function uploadOne(item, mode) {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.append("file", item.file, item.name);
    const xhr = new XMLHttpRequest();
    const url = `api/groups/${state.groupId}/upload?path=${encodeURIComponent(curDir())}&mode=${encodeURIComponent(mode)}`;
    xhr.open("POST", url);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        item.pct = ev.loaded / ev.total * 100;
        renderUploadStrip();
      }
    };
    xhr.onload = () => {
      let body = {};
      try {
        body = JSON.parse(xhr.responseText || "{}");
      } catch (_2) {
      }
      const r = body.results && body.results[0] || {};
      if (xhr.status >= 200 && xhr.status < 300 && r.status === "ok") {
        item.status = "ok";
        item.statusText = "uploaded";
        item.path = r.path;
      } else if (r.status === "conflict") {
        item.status = "conflict";
        item.statusText = "file exists";
      } else {
        item.status = "error";
        item.statusText = r.reason || r.status || "http " + xhr.status;
      }
      renderUploadStrip();
      resolve();
    };
    xhr.onerror = () => {
      item.status = "error";
      item.statusText = "network error";
      renderUploadStrip();
      resolve();
    };
    xhr.send(fd);
  });
}
async function uploadFiles(fileList) {
  if (!state.groupId || !state.isAdmin || !fileList || fileList.length === 0) return;
  uploadState.items = Array.from(fileList).map((file) => ({
    file,
    name: file.name,
    size: file.size,
    status: "uploading",
    pct: 0,
    statusText: "uploading\u2026",
    path: null
  }));
  renderUploadStrip();
  for (const item of uploadState.items) {
    await uploadOne(item, "skip").catch((err) => {
      item.status = "error";
      item.statusText = String(err && err.message || err);
    });
  }
  renderUploadStrip();
  await loadTree(state.path);
}
function setupDragDrop() {
  const body = document.querySelector(".files-pane .files-body");
  const zone = document.getElementById("dropzone");
  if (!body || !zone) return;
  function highlight(on) {
    zone.classList.toggle("drag-over", !!on);
  }
  function hasFiles(ev) {
    return !!ev.dataTransfer && Array.from(ev.dataTransfer.types || []).includes("Files");
  }
  body.addEventListener("dragenter", (ev) => {
    if (!state.isAdmin || !hasFiles(ev)) return;
    ev.preventDefault();
    uploadState.dragDepth += 1;
    highlight(true);
  });
  body.addEventListener("dragover", (ev) => {
    if (!state.isAdmin || !hasFiles(ev)) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = "copy";
  });
  body.addEventListener("dragleave", () => {
    if (!state.isAdmin) return;
    uploadState.dragDepth -= 1;
    if (uploadState.dragDepth <= 0) {
      uploadState.dragDepth = 0;
      highlight(false);
    }
  });
  body.addEventListener("drop", (ev) => {
    if (!state.isAdmin) return;
    ev.preventDefault();
    uploadState.dragDepth = 0;
    highlight(false);
    const files = ev.dataTransfer && ev.dataTransfer.files;
    if (files && files.length) uploadFiles(files);
  });
}

// src/files.js
function applyAdminFlag() {
  const g2 = state.groups.find((x2) => x2.id === state.groupId);
  state.isAdmin = !!(g2 && g2.isAdmin);
  document.body.classList.toggle("is-admin", state.isAdmin);
}
function sortGroups(groups) {
  return groups.slice().sort((a, b2) => {
    const ta = a.lastActivityAt ? Date.parse(a.lastActivityAt.includes("T") ? a.lastActivityAt : a.lastActivityAt.replace(" ", "T") + "Z") : 0;
    const tb = b2.lastActivityAt ? Date.parse(b2.lastActivityAt.includes("T") ? b2.lastActivityAt : b2.lastActivityAt.replace(" ", "T") + "Z") : 0;
    if (tb !== ta) return tb - ta;
    return a.name.localeCompare(b2.name);
  });
}
function populateGroupSelect() {
  const sel = $2("group-select");
  sel.innerHTML = "";
  for (const g2 of state.groups) {
    const o = document.createElement("option");
    o.value = g2.id;
    const adminTag = g2.isAdmin ? " [admin]" : "";
    o.textContent = `${g2.name}${adminTag}`;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => selectGroup(sel.value));
}
function syncGroupSelect() {
  const sel = $2("group-select");
  if (sel.value !== state.groupId) sel.value = state.groupId || "";
}
async function selectGroup(id) {
  state.groupId = id;
  state.path = "";
  state.file = null;
  applyAdminFlag();
  clearUploadStrip();
  syncGroupSelect();
  await loadThreads(id);
  if (chat.threadsPollTimer) {
    clearInterval(chat.threadsPollTimer);
    chat.threadsPollTimer = null;
  }
  chat.threadsPollTimer = setInterval(() => {
    if (state.groupId === id) loadThreads(id).catch(() => {
    });
    else {
      clearInterval(chat.threadsPollTimer);
      chat.threadsPollTimer = null;
    }
  }, 2e4);
  await loadTree("");
  onSelectionChanged();
  const latest = chat.threads.length > 0 ? chat.threads[0] : null;
  if (latest) {
    openChat(id, latest.threadId, threadCtx(latest)).catch((err) => console.error("chat open failed", err));
  } else {
    clearChat();
    chat.groupId = id;
    chat.threadId = null;
    writeHash();
  }
}
async function loadTree(p) {
  state.path = p;
  state.file = null;
  stopPreviewMedia();
  $2("files-pane").classList.remove("previewing");
  $2("preview").innerHTML = "";
  renderCrumb(p);
  onSelectionChanged();
  const dz = document.getElementById("dropzone-path");
  if (dz) dz.textContent = "/" + p;
  const list = $2("listing");
  list.innerHTML = "";
  list.appendChild(emptyDiv("Loading\u2026"));
  let entries;
  try {
    ({ entries } = await api(`api/groups/${encodeURIComponent(state.groupId)}/tree?path=${encodeURIComponent(p)}`));
  } catch (err) {
    list.innerHTML = "";
    const msg = /HTTP 404/.test(String(err && err.message)) ? "Not found. It may have been renamed or deleted." : String(err && err.message || err);
    list.appendChild(emptyDiv(msg));
    return;
  }
  list.innerHTML = "";
  if (p) {
    const up = document.createElement("div");
    up.className = "row";
    up.innerHTML = '<div class="name">..</div>';
    up.onclick = () => navTree(parentPath(p));
    list.appendChild(up);
  }
  if (!entries.length) {
    list.appendChild(emptyDiv("Empty directory"));
    return;
  }
  for (const e of entries) {
    const row = document.createElement("div");
    row.className = "row tier-" + e.tier;
    row.dataset.path = e.path;
    const icon = e.type === "dir" ? "\u{1F4C1}" : "\u{1F4C4}";
    row.innerHTML = `<div>${icon}</div><div class="name">${escapeHtml(e.name)}</div><div class="size">${fmtBytes(e.size)}</div><div class="meta">${tsHTML(e.mtime)}</div><div class="row-actions admin-only"><button type="button" class="act-ren" title="Rename">\u270E</button><button type="button" class="act-del" title="Delete">\u{1F5D1}</button></div>`;
    row.onclick = (ev) => {
      if (ev.target.closest(".row-actions")) return;
      if (e.type === "dir") navTree(e.path);
      else navFile(e);
    };
    const ren = row.querySelector(".act-ren");
    const del = row.querySelector(".act-del");
    if (ren) ren.addEventListener("click", (ev) => {
      ev.stopPropagation();
      renameEntry(e);
    });
    if (del) del.addEventListener("click", (ev) => {
      ev.stopPropagation();
      deleteEntry(e);
    });
    list.appendChild(row);
  }
}
async function navTree(p) {
  await loadTree(p);
  writeHash();
}
async function navFile(entry) {
  await selectFile(entry);
  writeHash();
  if (MOBILE_MQ.matches) openFilesDrawerIfMobile();
  else if (!state.paneOpen.files) togglePane("files");
}
async function selectFile(entry) {
  state.file = entry.path;
  stopPreviewMedia();
  for (const el of document.querySelectorAll(".files-pane .row")) {
    el.classList.toggle("active", el.dataset.path === entry.path);
  }
  renderCrumb(entry.path);
  $2("files-pane").classList.add("previewing");
  onSelectionChanged();
  const url = `api/groups/${encodeURIComponent(state.groupId)}/file?path=${encodeURIComponent(entry.path)}`;
  const pv = $2("preview");
  let headStatus = 0;
  try {
    const h = await fetch(url, { method: "HEAD", credentials: "same-origin" });
    headStatus = h.status;
    if (h.ok) {
      if (entry.size == null) {
        const cl = h.headers.get("content-length");
        if (cl) entry.size = Number(cl);
      }
      if (!entry.mtime) {
        const lm = h.headers.get("last-modified");
        if (lm) {
          const t = Date.parse(lm);
          if (t) entry.mtime = new Date(t).toISOString();
        }
      }
    }
  } catch (_2) {
  }
  if (headStatus && headStatus >= 400) {
    const msg = headStatus === 404 ? "File not found. It may have been renamed or deleted." : `HTTP ${headStatus}`;
    pv.innerHTML = `<div class="preview-toolbar"></div><div class="empty">${escapeHtml(msg)}</div>`;
    return;
  }
  const toolbar = previewToolbar(entry, url);
  const ext = entry.name.toLowerCase().split(".").pop();
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    pv.innerHTML = `${toolbar}<img alt="${escapeHtml(entry.name)}" src="${url}"/>`;
    return;
  }
  if (["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac", "weba"].includes(ext)) {
    pv.innerHTML = `${toolbar}<audio controls preload="metadata" src="${url}"></audio>`;
    return;
  }
  if (["mp4", "m4v", "mov", "webm", "ogv"].includes(ext)) {
    pv.innerHTML = `${toolbar}<video controls preload="metadata" src="${url}" style="max-width:100%;max-height:80vh"></video>`;
    return;
  }
  if (ext === "pdf") {
    pv.innerHTML = `${toolbar}<iframe src="${url}" style="width:100%;height:90vh;border:0"></iframe>`;
    return;
  }
  const r = await fetch(url, { credentials: "same-origin" });
  if (!r.ok) {
    pv.innerHTML = `${toolbar}<div class="empty">HTTP ${r.status}</div>`;
    return;
  }
  const ct = r.headers.get("content-type") || "";
  if (ct.startsWith("text/") || ct.includes("json") || ct.includes("xml")) {
    const t = await r.text();
    if (ext === "md" || ext === "markdown") {
      const html = renderMarkdown(t);
      if (html != null) {
        pv.innerHTML = `${toolbar}<div class="markdown-preview"></div>`;
        pv.querySelector(".markdown-preview").innerHTML = html;
        return;
      }
    }
    pv.innerHTML = `${toolbar}<pre></pre>`;
    pv.querySelector("pre").textContent = t;
  } else {
    pv.innerHTML = `${toolbar}<div class="empty">Binary file (${escapeHtml(ct)}).</div>`;
  }
}
function previewToolbar(entry, url) {
  const parts = [`<a class="text-btn" href="${url}" download="${escapeAttr(entry.name)}">Download</a>`];
  if (entry.size != null) parts.push(`<span class="meta">${escapeHtml(fmtBytes(entry.size))}</span>`);
  if (entry.mtime) parts.push(tsHTML(entry.mtime, "meta"));
  return `<div class="preview-toolbar">${parts.join("")}</div>`;
}
function setPreview(html) {
  $2("preview").innerHTML = html;
  $2("files-pane").classList.add("previewing");
}
function renderCrumb(p) {
  const segs = p ? p.split("/").filter(Boolean) : [];
  const c = $2("crumb");
  const parts = [];
  const rootCurrent = segs.length === 0 ? " current" : "";
  parts.push(`<button type="button" class="crumb root${rootCurrent}" data-path="" title="Root">/</button>`);
  let acc = "";
  segs.forEach((s, i) => {
    acc = acc ? acc + "/" + s : s;
    const isLast = i === segs.length - 1;
    parts.push(`<span class="sep" aria-hidden="true">\u203A</span>`);
    parts.push(`<button type="button" class="crumb${isLast ? " current" : ""}" data-path="${escapeAttr(acc)}" title="${escapeAttr("/" + acc)}">${escapeHtml(s)}</button>`);
  });
  c.innerHTML = parts.join("");
  for (const a of c.querySelectorAll(".crumb:not(.current)")) {
    a.onclick = () => navTree(a.dataset.path);
  }
  requestAnimationFrame(() => {
    c.scrollLeft = c.scrollWidth;
  });
}
function currentContextPath() {
  if (!state.groupId) return null;
  if (state.file) return { path: state.file, kind: "file" };
  if (state.path) return { path: state.path.replace(/\/?$/, "/"), kind: "dir" };
  return null;
}
function renderContextChip() {
  const el = $2("chat-context");
  if (!el) return;
  const ctx = currentContextPath();
  if (!ctx || chat.contextDismissed) {
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  el.hidden = false;
  el.innerHTML = "";
  const chip = document.createElement("span");
  chip.className = "chip";
  const icon = ctx.kind === "dir" ? "\u{1F4C1}" : "\u{1F4C4}";
  chip.innerHTML = `<span>${icon}</span><span class="path" title="${escapeHtml(ctx.path)}">${escapeHtml(ctx.path)}</span>`;
  const x2 = document.createElement("button");
  x2.type = "button";
  x2.textContent = "\xD7";
  x2.title = "Don\u2019t include this in next message";
  x2.addEventListener("click", () => {
    chat.contextDismissed = true;
    renderContextChip();
  });
  chip.appendChild(x2);
  el.appendChild(chip);
}
function onSelectionChanged() {
  chat.contextDismissed = false;
  renderContextChip();
}

// src/hash.js
function parseHash() {
  const raw = location.hash.replace(/^#/, "");
  if (!raw) return null;
  const qIdx = raw.indexOf("?");
  const pathPart = qIdx < 0 ? raw : raw.slice(0, qIdx);
  const params = new URLSearchParams(qIdx < 0 ? "" : raw.slice(qIdx + 1));
  const threadId = params.get("t") || null;
  const channelType = params.get("c") || null;
  const messagingGroupId = params.get("mg") || null;
  const h = decodeURI(pathPart);
  const base = { threadId, channelType, messagingGroupId };
  if (!h) return threadId ? { groupId: "", path: "", isDir: true, ...base } : null;
  const slash = h.indexOf("/");
  if (slash < 0) return { groupId: h, path: "", isDir: true, ...base };
  const groupId = h.slice(0, slash);
  const rest = h.slice(slash + 1);
  const isDir = rest === "" || rest.endsWith("/");
  const path = isDir ? rest.replace(/\/$/, "") : rest;
  return { groupId, path, isDir, ...base };
}
function writeHash() {
  if (!state.groupId) return;
  let h = "#" + encodeURI(state.groupId);
  if (state.file) h += "/" + encodeURI(state.file);
  else if (state.path) h += "/" + encodeURI(state.path) + "/";
  if (chat.threadId && chat.groupId === state.groupId) {
    h += "?t=" + encodeURIComponent(chat.threadId);
    if (chat.channelType && chat.channelType !== "web") {
      h += "&c=" + encodeURIComponent(chat.channelType);
      if (chat.messagingGroupId) h += "&mg=" + encodeURIComponent(chat.messagingGroupId);
    }
  }
  if (location.hash !== h) {
    state.suppressHashCount++;
    location.hash = h;
  }
}
async function applyHash() {
  const parsed = parseHash();
  if (!parsed) {
    if (state.groups.length) await selectGroup(state.groups[0].id);
    return;
  }
  if (!state.groups.find((g2) => g2.id === parsed.groupId)) {
    setPreview('<div class="empty">No access to group ' + escapeHtml(parsed.groupId) + "</div>");
    return;
  }
  const groupChanged = state.groupId !== parsed.groupId;
  state.groupId = parsed.groupId;
  state.file = null;
  applyAdminFlag();
  syncGroupSelect();
  if (groupChanged) {
    await loadThreads(parsed.groupId);
  }
  if (parsed.threadId) {
    const ctx = parsed.channelType && parsed.channelType !== "web" && parsed.messagingGroupId ? { channelType: parsed.channelType, messagingGroupId: parsed.messagingGroupId } : null;
    openChat(parsed.groupId, parsed.threadId, ctx).catch((err) => console.error("chat open failed", err));
  } else if (groupChanged) {
    const latest = chat.threads.length > 0 ? chat.threads[0] : null;
    if (latest) openChat(parsed.groupId, latest.threadId, threadCtx(latest)).catch((err) => console.error("chat open failed", err));
    else clearChat();
  }
  if (parsed.isDir) {
    await loadTree(parsed.path);
  } else {
    const parent = parentPath(parsed.path);
    await loadTree(parent);
    const name = parent ? parsed.path.slice(parent.length + 1) : parsed.path;
    await selectFile({ path: parsed.path, name });
  }
}

// src/index.js
async function init() {
  const me2 = await api("api/me");
  $2("me").textContent = me2.userId;
  const { groups } = await api("api/groups");
  state.groups = sortGroups(groups);
  populateGroupSelect();
  if (!state.groups.length) {
    $2("preview").innerHTML = '<div class="empty">No accessible groups.</div>';
    $2("files-pane").classList.add("previewing");
    return;
  }
  restorePanelState();
  wireGlobalEvents();
  window.addEventListener("hashchange", () => {
    if (state.suppressHashCount > 0) {
      state.suppressHashCount--;
      return;
    }
    applyHash().catch(console.error);
  });
  await applyHash();
}
function wireGlobalEvents() {
  $2("btn-new-chat").addEventListener("click", () => {
    if (!state.groupId) return;
    openChat(state.groupId, null).then(() => {
      $2("chat-input").focus();
      closeMobileDrawers();
    }).catch(console.error);
  });
  const logoutForm = document.getElementById("logout-form");
  if (logoutForm) {
    logoutForm.addEventListener("submit", (e) => {
      if (MOBILE_MQ.matches && !window.confirm("Log out?")) e.preventDefault();
    });
  }
  wireNotifButton();
  const btnUpload = document.getElementById("btn-upload");
  const btnMkdir = document.getElementById("btn-mkdir");
  const uploadInput = document.getElementById("upload-input");
  if (btnUpload && uploadInput) {
    btnUpload.addEventListener("click", () => uploadInput.click());
    uploadInput.addEventListener("change", () => {
      if (uploadInput.files && uploadInput.files.length) uploadFiles(uploadInput.files);
      uploadInput.value = "";
    });
  }
  if (btnMkdir) btnMkdir.addEventListener("click", () => mkdirPrompt());
  const btnTouch = document.getElementById("btn-touch");
  if (btnTouch) btnTouch.addEventListener("click", () => touchPrompt());
  setupDragDrop();
  function registerPane(p) {
    const pane = $2(p.id);
    if (!pane) return;
    const toggle = () => togglePane(p.key);
    const headEl = pane.querySelector(":scope > .head");
    if (headEl) headEl.addEventListener("click", (ev) => {
      if (ev.target.closest("button, a")) return;
      if (MOBILE_MQ.matches) return;
      ev.stopPropagation();
      toggle();
    });
    pane.addEventListener("click", (ev) => {
      if (state.paneOpen[p.key]) return;
      if (ev.target.closest("button, a")) return;
      if (MOBILE_MQ.matches) return;
      toggle();
    });
    if (p.toggleBtn) $2(p.toggleBtn)?.addEventListener("click", toggle);
    if (p.mobileBtn) $2(p.mobileBtn)?.addEventListener("click", () => toggleMobileDrawer(p.key));
  }
  for (const p of PANES) registerPane(p);
  MOBILE_MQ.addEventListener("change", applyPanelClasses);
  $2("backdrop").addEventListener("click", closeMobileDrawers);
  $2("chat-form").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const input = $2("chat-input");
    const text = input.value.trim();
    const files = chat.pending.slice();
    if (!text && files.length === 0) return;
    const ctx = !chat.contextDismissed ? currentContextPath() : null;
    const fullText = ctx ? `> Context (file browser): \`${ctx.path}\`

${text}` : text;
    input.value = "";
    chat.pending = [];
    renderPending();
    chat.contextDismissed = false;
    renderContextChip();
    sendChat(fullText, files).catch(console.error);
  });
  $2("chat-input").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      $2("chat-form").requestSubmit();
    }
  });
  const attachBtn = $2("chat-attach");
  const fileInput = $2("chat-file");
  if (attachBtn && fileInput) {
    attachBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", () => {
      addPendingFiles(Array.from(fileInput.files || []));
      fileInput.value = "";
    });
  }
  const chatEl = $2("chat-main");
  if (chatEl) {
    let dragDepth = 0;
    chatEl.addEventListener("dragenter", (ev) => {
      if (!ev.dataTransfer || ev.dataTransfer.types.indexOf("Files") < 0) return;
      ev.preventDefault();
      dragDepth++;
      chatEl.classList.add("drag-active");
    });
    chatEl.addEventListener("dragover", (ev) => {
      if (!ev.dataTransfer || ev.dataTransfer.types.indexOf("Files") < 0) return;
      ev.preventDefault();
      ev.dataTransfer.dropEffect = "copy";
    });
    chatEl.addEventListener("dragleave", () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) chatEl.classList.remove("drag-active");
    });
    chatEl.addEventListener("drop", (ev) => {
      if (!ev.dataTransfer) return;
      ev.preventDefault();
      dragDepth = 0;
      chatEl.classList.remove("drag-active");
      const files = Array.from(ev.dataTransfer.files || []);
      if (files.length > 0) addPendingFiles(files);
    });
  }
  $2("chat-input").addEventListener("paste", (ev) => {
    const items = ev.clipboardData && ev.clipboardData.files;
    if (!items || items.length === 0) return;
    ev.preventDefault();
    addPendingFiles(Array.from(items));
  });
  setupViewportFit();
}
function setupViewportFit() {
  const vv = window.visualViewport;
  if (!vv) return;
  const apply = () => {
    document.documentElement.style.setProperty("--app-height", vv.height + "px");
  };
  apply();
  vv.addEventListener("resize", apply);
  vv.addEventListener("scroll", apply);
  const input = $2("chat-input");
  if (input) {
    input.addEventListener("focus", () => {
      setTimeout(() => {
        try {
          input.scrollIntoView({ block: "end", behavior: "smooth" });
        } catch {
        }
      }, 250);
    });
  }
}
init().catch((err) => console.error(err));
//# sourceMappingURL=app.js.map
