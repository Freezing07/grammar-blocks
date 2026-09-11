/*
 * 内容 + 结构 + 玩法 的回归自检。
 *
 * 用法：
 *   node smoke-test.js          校验（改完内容/代码跑一下）
 *   node smoke-test.js --sync   把 index.html 里的关卡 JSON 抽到 levels/*.json
 *
 * 为什么要有这个文件：
 *   这个项目的命脉是「内容」（怎么拆积木、讲解写得对不对），
 *   而内容全塞在 index.html 的 <script type="application/json"> 里。
 *   手改 JSON 很容易手滑，所以用机器把结构性的错误先挡掉，
 *   剩下的「讲解讲得好不好」才是人该判断的事。
 *
 * 第三部分会在 node 里用一套最小 DOM 直接跑 index.html 的主脚本，
 * 逐关自动通关，测的不是复制出来的假代码。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = path.join(__dirname, 'index.html');
const LEVELS_DIR = path.join(__dirname, 'levels');

const html = fs.readFileSync(HTML_PATH, 'utf8');

/* ---------- 取出内嵌关卡数据 ---------- */
const dataMatch = html.match(/<script id="levelData" type="application\/json">([\s\S]*?)<\/script>/);
if (!dataMatch) fail(['找不到 <script id="levelData" type="application/json">']);

let DATA;
try {
  DATA = JSON.parse(dataMatch[1]);
} catch (e) {
  fail(['关卡 JSON 解析失败：' + e.message]);
}
const CHAPTERS = DATA.chapters || [];
const ALL_LEVELS = [];
CHAPTERS.forEach(c => (c.levels || []).forEach(lv => ALL_LEVELS.push(lv)));

/* ---------- 设计稿里的词性配色（和 README 里那张表对应）---------- */
const POS_SPEC = {
  noun:    { label: '名词',   color: '#4A90D9' },
  pronoun: { label: '代词',   color: '#06B6D4' },
  verb:    { label: '动词',   color: '#EF4444' },
  adj:     { label: '形容词', color: '#10B981' },
  adv:     { label: '副词',   color: '#F59E0B' },
  article: { label: '冠词',   color: '#9CA3AF' },
  prep:    { label: '介词',   color: '#8B5CF6' },
  conj:    { label: '连词',   color: '#EAB308' },
  inf:     { label: '不定式符号', color: '#F472B6' }
};

const posInHtml = {};
for (const m of html.matchAll(/(\w+)\s*:\s*\{\s*label:\s*'([^']+)',\s*color:\s*'(#[0-9A-Fa-f]{6})'\s*\}/g)) {
  posInHtml[m[1]] = { label: m[2], color: m[3].toUpperCase() };
}

const errors = [];
const notes = [];
function fail(list) {
  console.error('\n✗ 自检不通过：\n' + list.map(s => '  · ' + s).join('\n') + '\n');
  process.exit(1);
}
function check(cond, msg) { if (!cond) errors.push(msg); }

/* ============================================================
   一、内容：词性、章节、每一关每一句
   ============================================================ */
Object.keys(POS_SPEC).forEach(k => {
  check(posInHtml[k], `index.html 缺少词性配色：${k}`);
  if (posInHtml[k]) {
    check(posInHtml[k].label === POS_SPEC[k].label,
      `${k} 的中文名应为「${POS_SPEC[k].label}」，实际「${posInHtml[k].label}」`);
    check(posInHtml[k].color === POS_SPEC[k].color,
      `${k} 的颜色应为 ${POS_SPEC[k].color}，实际 ${posInHtml[k].color}`);
  }
});

check(Array.isArray(DATA.chapters) && DATA.chapters.length > 0, 'chapters 必须是非空数组');

const seenRoundIds = new Set();
const seenLevelIds = new Set();
const posUsed = new Set();
const stat = { rounds: 0, blocks: 0, distract: 0, fix: 0, timed: 0, ask: 0 };

CHAPTERS.forEach((ch, ci) => {
  const atCh = `第 ${ci + 1} 章「${ch.name || '无 name'}」`;
  check(typeof ch.name === 'string' && ch.name, `${atCh}: 缺少 name`);
  check(typeof ch.emoji === 'string' && ch.emoji, `${atCh}: 缺少 emoji`);
  check(typeof ch.subtitle === 'string' && ch.subtitle, `${atCh}: 缺少 subtitle`);
  check(Array.isArray(ch.levels) && ch.levels.length > 0, `${atCh}: levels 必须是非空数组`);
  check(ch.levels[ch.levels.length - 1].boss === true, `${atCh}: 最后一关应该标成 boss`);
  notes.push(`${ch.emoji} ${ch.name} · ${ch.subtitle}`);

  (ch.levels || []).forEach((lv, li) => {
  const atLv = `${ch.name} ${lv.id || '无 id'}`;
  check(typeof lv.id === 'string' && /^\d+-\d+$/.test(lv.id), `${atLv}: id 要形如 1-1`);
  check(!seenLevelIds.has(lv.id), `${atLv}: 关卡 id 重复`);
  seenLevelIds.add(lv.id);
  check(typeof lv.topic === 'string' && lv.topic, `${atLv}: 缺少 topic`);
  check(typeof lv.emoji === 'string' && lv.emoji, `${atLv}: 缺少 emoji`);
  check(typeof lv.goal === 'string' && lv.goal, `${atLv}: 缺少 goal`);
  const rounds = Array.isArray(lv.rounds) ? lv.rounds : [];
  check(rounds.length >= 3, `${atLv}: 只有 ${rounds.length} 句，太少了（建议 ≥5）`);

  rounds.forEach((r, ri) => {
    const at = `${lv.id} 第 ${ri + 1} 句（${r.id || '无 id'}）`;
    check(typeof r.id === 'string' && r.id, `${at}: 缺少 id`);
    check(!seenRoundIds.has(r.id), `${at}: id 重复`);
    seenRoundIds.add(r.id);
    check(typeof r.cn === 'string' && r.cn, `${at}: 缺少中文意思 cn`);
    check(typeof r.tip === 'string' && r.tip, `${at}: 缺少提示 tip`);
    check(typeof r.explain === 'string' && r.explain.length >= 8, `${at}: 讲解 explain 太短或缺失`);
    check(typeof r.example === 'string' && r.example, `${at}: 缺少 example`);
    check(typeof r.win === 'string' && r.win, `${at}: 缺少 win（答对时「你掌握了…」那句）`);

    const isOrderRound = r.mode === 'order';
    if (r.mode !== undefined) check(r.mode === 'order', `${at}: mode 目前只支持 "order"`);

    const groups = Array.isArray(r.groups) ? r.groups : [];
    if (!isOrderRound) check(groups.length > 0, `${at}: 缺少 groups（语法树要靠它分组）`);
    const gids = groups.map(g => g.id);
    check(new Set(gids).size === gids.length, `${at}: groups 的 id 有重复`);
    groups.forEach(g => check(typeof g.label === 'string' && g.label, `${at}: group ${g.id} 缺少 label`));

    const blocks = Array.isArray(r.blocks) ? r.blocks : [];
    const distractors = Array.isArray(r.distractors) ? r.distractors : [];
    check(blocks.length >= 2, `${at}: 正解积木少于 2 块`);
    check(blocks.length <= 10, `${at}: ${blocks.length} 块积木太多，一行摆不下`);

    const all = blocks.concat(distractors);
    all.forEach(b => {
      check(typeof b.text === 'string' && b.text.trim() === b.text && b.text.length > 0,
        `${at}: 积木文字有首尾空格或为空 → "${b.text}"`);
      if (!isOrderRound) check(POS_SPEC[b.pos], `${at}: 未知词性 "${b.pos}"（积木 ${b.text}）`);
      check(typeof b.role === 'string' && b.role, `${at}: 积木 ${b.text} 缺少 role（语法角色）`);
      if (!isOrderRound) check(gids.includes(b.group), `${at}: 积木 ${b.text} 的 group="${b.group}" 不在 groups 里`);
      if (b.nonfinite !== undefined) {
        check(b.nonfinite === true, `${at}: 积木 ${b.text} 的 nonfinite 只能写 true`);
      }
      if (POS_SPEC[b.pos]) posUsed.add(b.pos);
    });

    // 同一个词不能既是正解又是干扰项 —— 那样判定会有歧义。
    // 但正解之间重名是允许的（"I will call you if I have time" 里就有两个 I）
    const blockTexts = blocks.map(b => b.text);
    const disTexts = distractors.map(b => b.text);
    const clash = disTexts.filter(t => blockTexts.includes(t));
    check(clash.length === 0,
      `${at}: 干扰项和正解重名：${[...new Set(clash)].join(', ')}（判定会有歧义）`);
    const dupIn = blockTexts.filter((t, i) => blockTexts.indexOf(t) !== i);
    if (dupIn.length) {
      notes.push(`    （${lv.id} ${r.id} 有同形积木：${[...new Set(dupIn)].join('、')}）`);
    }

    // parent：从句（或分词短语）挂在哪个组下面
    groups.forEach(g => {
      if (g.parent === undefined) return;
      check(gids.includes(g.parent), `${at}: group ${g.id} 的 parent="${g.parent}" 不存在`);
      check(g.parent !== g.id, `${at}: group ${g.id} 的 parent 指向自己`);
      let cur = g.parent, hops = 0;
      while (cur && hops++ < 12) {
        const p = groups.find(x => x.id === cur);
        cur = p && p.parent;
      }
      check(hops < 12, `${at}: group ${g.id} 的 parent 链成环了`);
    });

    // 一个组（连同它的所有子组）必须占一段连续区间，
    // 否则语法树从左到右读出来就不是原句的顺序
    const subtreeIdx = id => {
      const own = blocks.map((b, i) => (b.group === id ? i : -1)).filter(i => i >= 0);
      groups.filter(g => g.parent === id).forEach(g => own.push(...subtreeIdx(g.id)));
      return own;
    };
    if (!isOrderRound) {
      groups.forEach(g => {
        const idxs = subtreeIdx(g.id).sort((a, b) => a - b);
        check(idxs.length > 0, `${at}: group ${g.id} 里没有任何积木`);
        check(idxs[idxs.length - 1] - idxs[0] + 1 === idxs.length,
          `${at}: group ${g.id}（含子组）的积木不连续，语法树会读错顺序`);
      });
    }

    // 改错模式：prefill 必须能从现有积木里找到，而且不能等于正确答案
    if (r.prefill !== undefined) {
      stat.fix++;
      check(Array.isArray(r.prefill), `${at}: prefill 必须是数组`);
      check(r.prefill.length === blocks.length,
        `${at}: prefill 有 ${r.prefill.length} 项，但正解有 ${blocks.length} 块`);
      const pool = new Set(all.map(b => b.text));
      (r.prefill || []).forEach((t, i) => {
        check(pool.has(t), `${at}: prefill[${i}]="${t}" 不在 blocks/distractors 里，玩家永远拼不出来`);
      });
      check((r.prefill || []).join('\u0000') !== blocks.map(b => b.text).join('\u0000'),
        `${at}: prefill 和正确答案一模一样，那就不是改错了`);
    }

    // 疑问句句末该是问号，陈述句该是句号
    if (r.punct !== undefined) {
      check(r.punct === '?' || r.punct === '.', `${at}: punct 只能是 ? 或 .`);
    }
    if (r.punct === '?') stat.ask++;
    check(/[？?]$/.test(r.cn) === (r.punct === '?'),
      `${at}: 中文意思是疑问句，punct 就该是 ?；反之则不该有 punct`);

    // marks：在指定槽位后插标点。下标必须落在范围内，值必须是标点
    if (isOrderRound) {
      check(Array.isArray(r.links), `${at}: 段落排序缺少 links`);
      check((r.links || []).length === blocks.length - 1,
        `${at}: links 应该有 ${blocks.length - 1} 个（句子数减一），实际 ${(r.links || []).length}`);
      check(blocks.length >= 3, `${at}: 段落排序至少要 3 句`);
      check(distractors.length <= 1, `${at}: 段落排序最多放 1 个干扰句`);
      check(r.groups === undefined, `${at}: 段落排序不该有 groups（那是语法树用的）`);
    } else {
      check(r.links === undefined, `${at}: links 只能用在段落排序（mode: "order"）里`);
    }

    if (r.marks !== undefined) {
      check(r.marks && typeof r.marks === 'object' && !Array.isArray(r.marks),
        `${at}: marks 必须是对象`);
      Object.keys(r.marks || {}).forEach(k => {
        const idx = Number(k);
        check(Number.isInteger(idx) && idx >= 0 && idx < blocks.length,
          `${at}: marks 的下标 ${k} 越界（这一句共 ${blocks.length} 块）`);
        check(/^[,.?!;:]$/.test(String(r.marks[k])),
          `${at}: marks["${k}"] 只能是标点，实际 "${r.marks[k]}"`);
      });
    }
    if (r.rootLabel !== undefined) {
      check(typeof r.rootLabel === 'string' && r.rootLabel.length > 0,
        `${at}: rootLabel 必须是非空字符串`);
    }

    if (r.timeLimit !== undefined) {
      stat.timed++;
      check(typeof r.timeLimit === 'number' && r.timeLimit >= 10 && r.timeLimit <= 120,
        `${at}: timeLimit=${r.timeLimit} 不合理（建议 15~60 秒）`);
    }

    stat.rounds++;
    stat.blocks += blocks.length;
    stat.distract += distractors.length;
  });

  const timedInLv = rounds.filter(r => r.timeLimit).length;
  if (lv.boss) {
    check(timedInLv === rounds.length, `${atLv}: Boss 关每一句都该限时（现在只有 ${timedInLv}/${rounds.length}）`);
    check(li === ch.levels.length - 1, `${atLv}: Boss 应该是本章最后一关`);
  } else {
    check(timedInLv === 0, `${atLv}: 只有 Boss 关限时，这一关不该有 timeLimit`);
  }
  notes.push(`  ${lv.emoji} ${lv.id} ${lv.topic}　${rounds.length} 句` +
    `（改错 ${rounds.filter(r => r.prefill).length}）`);
  });
});

/* ============================================================
   一之二、练习题内容
   练习题是紧凑写法（句型骨架 + 一行一题），展开前先把结构性的坑挡掉。
   最关键的一条：句子的词数必须和它用的骨架长度一致 ——
   长度不匹配时展开会默默套用最后一个位置的词性，把介词标成名词这种错就出来了。
   ============================================================ */
const LEVEL_IDS = new Set(ALL_LEVELS.map(l => l.id));
const practiceTotal = { levels: 0, items: 0 };

Object.keys(DATA.practice || {}).forEach(function (lid) {
  const p = DATA.practice[lid];
  const at = `练习 ${lid}`;
  check(LEVEL_IDS.has(lid), `${at}: 这个关卡 id 在 chapters 里不存在`);
  // 段落排序的练习是另一种形状：一段一段给句子
  if (p.paragraphs) {
    check(Array.isArray(p.rules) && p.rules.length > 0, `${at}: 缺少 rules`);
    check(p.paragraphs.length >= 5,
      `${at}: 只有 ${p.paragraphs.length} 段练习，太少（目标 8 段）`);
    p.paragraphs.forEach((it, k) => {
      const one = `${at} 第 ${k + 1} 段`;
      check(Array.isArray(it.s) && it.s.length >= 3, `${one}: 句子少于 3 句`);
      (it.s || []).forEach(x => check(typeof x === 'string' && x.length > 8, `${one}: 有句子写得不完整`));
      check(Array.isArray(it.links) && it.links.length === (it.s || []).length - 1,
        `${one}: links 应该有 ${(it.s || []).length - 1} 个，实际 ${(it.links || []).length}`);
      if (it.roles) check(it.roles.length === it.s.length, `${one}: roles 数量对不上`);
      if (it.r !== undefined) check(!!(p.rules || [])[it.r], `${one}: 引用了不存在的规则 ${it.r}`);
      (it.d || []).forEach(x => check((it.s || []).indexOf(x) < 0, `${one}: 多余的那句和正解重了`));
    });
    practiceTotal.levels++;
    practiceTotal.orderItems = (practiceTotal.orderItems || 0) + p.paragraphs.length;
    return;
  }
  check(Array.isArray(p.patterns) && p.patterns.length > 0, `${at}: 缺少 patterns（句型骨架）`);
  (p.patterns || []).forEach((pat, i) => {
    check(Array.isArray(pat) && pat.length >= 2, `${at}: 第 ${i + 1} 个骨架太短`);
    (pat || []).forEach(s => {
      check(Array.isArray(s) && s.length === 3,
        `${at}: 骨架的一个位置必须写成 [词性, 语法角色, 分组]`);
      if (Array.isArray(s)) check(POS_SPEC[s[0]], `${at}: 骨架里有未知词性 "${s[0]}"`);
    });
  });
  check(Array.isArray(p.groups) && p.groups.length > 0, `${at}: 缺少 groups`);
  const pgids = (p.groups || []).map(g => g.id);
  check(Array.isArray(p.rules) && p.rules.length > 0, `${at}: 缺少 rules`);
  (p.rules || []).forEach((r, i) => {
    check(typeof r === 'string' && r.length > 4, `${at}: 第 ${i + 1} 条规则太短`);
  });
  // 骨架里的分组必须在 groups 里
  (p.patterns || []).forEach((pat, i) => {
    (pat || []).forEach(s => {
      if (Array.isArray(s)) check(pgids.includes(s[2]), `${at}: 骨架 ${i + 1} 的分组 "${s[2]}" 不在 groups 里`);
    });
  });

  check(Array.isArray(p.items) && p.items.length >= 20,
    `${at}: 练习题只有 ${(p.items || []).length} 句，太少（目标 30 句）`);
  (p.items || []).forEach((it, k) => {
    const one = `${at} 第 ${k + 1} 句`;
    const pi = it.p || 0;
    const pat = (p.patterns || [])[pi];
    check(!!pat, `${one}: 指定的骨架 ${pi} 不存在`);
    check(Array.isArray(it.w) && it.w.length > 0, `${one}: 缺少词`);
    if (pat) {
      check(it.w.length === pat.length,
        `${one}: 有 ${it.w.length} 个词，但骨架是 ${pat.length} 个 —— 词性会标错`);
    }
    if (it.r !== undefined) check(!!(p.rules || [])[it.r], `${one}: 引用了不存在的规则 ${it.r}`);
    if (it.c !== undefined) check(typeof it.c === 'string' && it.c.length > 0, `${one}: 中文意思写空了`);
    const dws = Object.keys(it.d || {});
    dws.forEach(w => {
      check((it.w || []).indexOf(w) < 0, `${one}: 干扰词 "${w}" 和正解重名`);
      const at2 = it.d[w];
      check(Number.isInteger(at2) && at2 >= 0 && at2 < (it.w || []).length,
        `${one}: 干扰词 "${w}" 的位置 ${at2} 越界`);
    });
    if (it.o !== undefined) {
      check(Array.isArray(it.o) && it.o.length === it.w.length,
        `${one}: o（预填顺序）的长度要和句子一致`);
      (it.o || []).forEach((txt, j) => {
        check(it.w.indexOf(txt) >= 0 || dws.indexOf(txt) >= 0,
          `${one}: o[${j}]="${txt}" 在积木和干扰项里都找不到`);
      });
    }
    if (!it.c && it.o === undefined) {
      check(dws.length > 0, `${one}: 既没有中文意思、又没有干扰项 —— 改错题会没有提示`);
    }
    practiceTotal.items++;
  });
  practiceTotal.levels++;
});

/* ============================================================
   二、结构：元素 id、els 表、脚本语法
   ============================================================ */
const idsInJs = new Set();
for (const m of html.matchAll(/(?:\$|getElementById)\(\s*'([A-Za-z0-9_-]+)'\s*\)/g)) idsInJs.add(m[1]);
const idsInHtml = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
[...idsInJs].forEach(id => {
  check(idsInHtml.has(id), `JS 里用了 #${id}，但 HTML 里没有这个元素`);
});

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
check(scripts.length > 0, 'index.html 里没有主脚本');
const js = scripts[scripts.length - 1][1];
try { new Function(js); } catch (e) { errors.push('主脚本语法错误：' + e.message); }

/* els 表里漏一项，浏览器里就是「白屏 + 控制台一行红字」。
   这类低级错误靠肉眼很难发现，所以在这里静态挡掉。 */
const elsBlock = js.match(/var els = \{([\s\S]*?)\n  \};/);
if (!elsBlock) {
  errors.push('找不到 els 元素表');
} else {
  const defined = new Set([...elsBlock[1].matchAll(/(\w+)\s*:\s*\$/g)].map(m => m[1]));
  const used = new Set([...js.matchAll(/\bels\.(\w+)/g)].map(m => m[1]));
  [...used].forEach(name => {
    check(defined.has(name), `JS 里用了 els.${name}，但 els 表里没定义（会直接报错白屏）`);
  });
  [...defined].forEach(name => {
    check(idsInHtml.has(name), `els 表里的 ${name} 在 HTML 里没有对应 id`);
  });
}

/* ============================================================
   三、玩法：最小 DOM 里跑真脚本，逐关自动通关
   ============================================================ */

/* ---------- 最小 DOM ---------- */
function parseSimple(sel) {
  const out = { tag: null, id: null, classes: [], attrs: [] };
  const tagM = /^[a-zA-Z][\w-]*/.exec(sel);
  let rest = sel;
  if (tagM) { out.tag = tagM[0].toUpperCase(); rest = sel.slice(tagM[0].length); }
  for (const m of rest.matchAll(/(#[^.#\[]+)|(\.[^.#\[]+)|(\[([^\]]+)\])/g)) {
    if (m[1]) out.id = m[1].slice(1);
    else if (m[2]) out.classes.push(m[2].slice(1));
    else if (m[3]) out.attrs.push(m[4]);
  }
  return out;
}
function matchSimple(el, sel) {
  const p = parseSimple(sel);
  if (p.tag && el.tagName !== p.tag) return false;
  if (p.id && el.attrs.id !== p.id) return false;
  for (const c of p.classes) if (!el._classes.has(c)) return false;
  for (const a of p.attrs) {
    const m = /^([\w-]+)(?:="([^"]*)")?$/.exec(a);
    if (!m) return false;
    let val = el.attrs[m[1]];
    if (val === undefined && m[1].startsWith('data-')) {
      const camel = m[1].slice(5).replace(/-([a-z])/g, (s, c) => c.toUpperCase());
      val = el.dataset[camel];
    }
    if (m[2] === undefined) { if (val === undefined) return false; }
    else if (String(val) !== m[2]) return false;
  }
  return true;
}
function descendantsOf(node, out) {
  out = out || [];
  for (const c of node.children) { out.push(c); descendantsOf(c, out); }
  return out;
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this._classes = new Set();
    this.attrs = {};
    this.dataset = {};
    this._listeners = {};
    this._text = '';
    this._cssText = '';
    this._props = {};
    this.hidden = false;
    this.disabled = false;
    this.title = '';
    const self = this;
    this.style = {
      setProperty(k, v) { self._props[k] = String(v); },
      getPropertyValue(k) { return self._props[k] === undefined ? '' : self._props[k]; },
      get cssText() { return self._cssText; },
      set cssText(v) { self._cssText = String(v); }
    };
    this.classList = {
      add() { for (const c of arguments) self._classes.add(c); },
      remove() { for (const c of arguments) self._classes.delete(c); },
      contains(c) { return self._classes.has(c); },
      toggle(c, on) {
        const want = on === undefined ? !self._classes.has(c) : !!on;
        if (want) self._classes.add(c); else self._classes.delete(c);
        return want;
      }
    };
  }
  get className() { return [...this._classes].join(' '); }
  set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get textContent() {
    if (this.children.length) return this.children.map(c => c.textContent).join('');
    return this._text;
  }
  set textContent(v) { this._text = String(v); this.children = []; }
  get innerHTML() { return this._text; }
  set innerHTML(v) { this._text = String(v); if (v === '') this.children = []; }
  get firstChild() { return this.children[0] || null; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] === undefined ? null : this.attrs[k]; }
  appendChild(node) {
    if (node.parentNode) {
      const i = node.parentNode.children.indexOf(node);
      if (i >= 0) node.parentNode.children.splice(i, 1);
    }
    node.parentNode = this;
    this.children.push(node);
    return node;
  }
  removeChild(node) {
    const i = this.children.indexOf(node);
    if (i >= 0) this.children.splice(i, 1);
    node.parentNode = null;
    return node;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  addEventListener(type, fn) { (this._listeners[type] = this._listeners[type] || []).push(fn); }
  removeEventListener(type, fn) {
    const a = this._listeners[type];
    if (!a) return;
    const i = a.indexOf(fn);
    if (i >= 0) a.splice(i, 1);
  }
  dispatchEvent(ev) {
    (this._listeners[ev.type] || []).slice().forEach(fn => fn(ev));
    return true;
  }
  click() { this.dispatchEvent({ type: 'click', preventDefault() {} }); }
  focus() {}
  blur() {}
  querySelector(sel) { return queryAll(this, sel)[0] || null; }
  querySelectorAll(sel) { return queryAll(this, sel); }
  closest(sel) {
    let n = this;
    while (n) { if (matchSimple(n, sel)) return n; n = n.parentNode; }
    return null;
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
}
function queryAll(root, sel) {
  const out = [];
  sel.split(',').forEach(part => {
    const steps = part.trim().split(/\s+/).filter(Boolean);
    let current = [root];
    steps.forEach(step => {
      const next = [];
      current.forEach(node => {
        descendantsOf(node).forEach(d => {
          if (matchSimple(d, step) && !next.includes(d)) next.push(d);
        });
      });
      current = next;
    });
    current.forEach(n => { if (!out.includes(n)) out.push(n); });
  });
  return out;
}

/* ---------- 假时钟 ---------- */
function makeClock() {
  const timers = [];
  let id = 1, now = 0;
  return {
    setTimeout(fn, delay) { const t = { id: id++, fn, time: now + (delay || 0) }; timers.push(t); return t.id; },
    clearTimeout(tid) { const i = timers.findIndex(t => t.id === tid); if (i >= 0) timers.splice(i, 1); },
    flush(maxMs, onError) {
      const end = now + (maxMs === undefined ? 60000 : maxMs);
      let guard = 0;
      while (guard++ < 3000) {
        const due = timers.filter(t => t.time <= end).sort((a, b) => a.time - b.time);
        if (!due.length) break;
        const t = due[0];
        timers.splice(timers.indexOf(t), 1);
        now = t.time;
        try { t.fn(); } catch (e) { if (onError) onError(e); }
      }
      return guard;
    }
  };
}

/* HTML 里每个 id 元素原本带的 class 也要带过来 */
const idMeta = {};
for (const m of html.matchAll(/<([a-zA-Z][\w-]*)([^>]*?)>/g)) {
  const idm = /\bid="([^"]+)"/.exec(m[2]);
  if (!idm) continue;
  const clsm = /\bclass="([^"]*)"/.exec(m[2]);
  idMeta[idm[1]] = { tag: m[1], classes: clsm ? clsm[1].split(/\s+/).filter(Boolean) : [] };
}

function runPage() {
  const clock = makeClock();
  const runtimeErrors = [];
  const store = {};
  const docEl = new El('html');
  const body = new El('body');
  docEl.appendChild(body);

  const byId = {};
  function getElementById(id) {
    if (!byId[id]) {
      const meta = idMeta[id] || { tag: 'div', classes: [] };
      const e = new El(meta.tag);
      e.attrs.id = id;
      meta.classes.forEach(c => e._classes.add(c));
      if (id === 'btnNextLevel') e.disabled = true;
      byId[id] = e;
      body.appendChild(e);
    }
    return byId[id];
  }
  getElementById('levelData').textContent = dataMatch[1];

  const document = {
    body, documentElement: docEl, children: [docEl],
    getElementById,
    createElement: t => new El(t),
    createElementNS: (ns, t) => new El(t),
    createTextNode: t => { const e = new El('#text'); e.textContent = t; return e; },
    querySelector: sel => queryAll(docEl, sel)[0] || null,
    querySelectorAll: sel => queryAll(docEl, sel),
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
    elementFromPoint() { return null; }
  };

  const win = {
    document,
    matchMedia: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {}, removeEventListener() {},
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    requestAnimationFrame: fn => clock.setTimeout(fn, 16),
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    }
  };
  win.window = win;

  const ctx = vm.createContext({
    window: win, document,
    localStorage: win.localStorage,
    setTimeout: clock.setTimeout,
    clearTimeout: clock.clearTimeout,
    requestAnimationFrame: win.requestAnimationFrame,
    console
  });
  try {
    vm.runInContext(js, ctx, { filename: 'index.html<inline>' });
  } catch (e) {
    runtimeErrors.push('启动就抛异常：' + e.message);
  }
  return { win, document, clock, runtimeErrors, GB: win.__GB__ };
}

const page = runPage();
const GB = page.GB;
const doc = page.document;
page.runtimeErrors.forEach(e => errors.push(e));

if (GB) {
  try {
  const flush = (ms) => page.clock.flush(ms, e => errors.push(
    '定时器回调抛异常：' + e.message + '　@' + GB.LEVELS[GB.state.li].id + ' 第' + (GB.state.qi + 1) + '句  round=' + GB.LEVELS[GB.state.li].rounds[GB.state.queue[GB.state.qi]].id));
  const save = () => JSON.parse(page.win.localStorage.getItem('grammarBlocks.v2') || '{}');
  const lv = () => GB.LEVELS[GB.state.li];
  const target = (r) => r.blocks.map(b => b.text);
  const slotTexts = () => GB.state.slots.map(u => (u ? GB.state.pool[u].text : null));

  function fillByIndex() {
    const node = GB.state.queue[GB.state.qi];
    const src = node.src === 'practice' ? 'practiceRounds' : 'rounds';
    const r = GB.LEVELS[node.li][src][node.ri];
    target(r).forEach((txt, i) => {
      if (slotTexts()[i] === txt) return;
      const uid = GB.uidByText(txt);
      if (uid) GB.placeInto(uid, i);
    });
  }
  function playRound() {
    if (GB.state.phase !== 'play') return;
    fillByIndex();
    GB.els.btnSubmit.click();
    flush();
  }
  function playLevel(i) {
    let guard = 0;
    while (!GB.els.done.classList.contains('show')) {
      if (guard++ > 40) { errors.push(`自动通关 ${GB.LEVELS[i].id} 卡住了`); return; }
      if (GB.state.phase === 'tree') { GB.els.btnSubmit.click(); flush(); }
      else playRound();
    }
  }

  /* --- 启动：应该停在关卡地图上 --- */
  check(doc.querySelectorAll('#map .lv').length === GB.LEVELS.length, '地图上的关卡卡片数量不对');
  check(!GB.els.mapView.hidden, '启动后应该显示关卡地图');
  check(GB.els.playView.hidden, '启动时不该显示关卡内容');
  check(GB.els.btnMap.hidden, '没在玩的时候不该出现「返回地图」');
  const cards = doc.querySelectorAll('#map .lv');
  check(cards.filter(c => !c.classList.contains('locked')).length === 1, '一开始只该解锁第 1 关');
  check(!GB.isUnlocked(1), '没通关 1-1 之前，1-2 不该解锁');
  check(doc.querySelectorAll('#map .chapter').length === GB.CHAPTERS.length, '地图上的章节分组数量不对');
  check(doc.querySelectorAll('#map .chapter.locked').length === GB.CHAPTERS.length - 1,
    '除第一章之外的章节都该是锁着的');
  check(!GB.isChapterUnlocked(1), '没通关第一章 Boss 之前，第二章不该解锁');

  /* --- 点卡片进入第 1 关 --- */
  cards[0].querySelector('.lv-play').click();
  check(!GB.els.playView.hidden, '点了关卡卡片后应该进入关卡');
  check(GB.els.mapView.hidden, '进入关卡后地图该藏起来');
  check(GB.state.li === 0 && GB.state.qi === 0, '应该从第 1 关第 1 句开始');
  check(GB.state.queue.length === GB.LEVELS[0].rounds.length, '正常模式的队列该是全部句子');
  check(GB.els.btnMap.hidden === false, '玩的时候要能看到「返回地图」');
  check(doc.querySelectorAll('#dots .dot').length === GB.LEVELS[0].rounds.length, '关卡内进度点数量不对');

  /* --- 第 1 句：轻点摆积木 → 提交 → 语法树 --- */
  const r0 = GB.LEVELS[0].rounds[0];
  target(r0).forEach(t => { const u = GB.uidByText(t); if (u) GB.tapBlock(u); });
  check(slotTexts().join(' ') === target(r0).join(' '), '轻点摆积木没有按顺序填满槽位');
  GB.els.btnSubmit.click();
  check(!!doc.querySelector('.fb.good'), '答对了却没出现「答对」反馈卡');
  flush();
  check(GB.els.board.classList.contains('tree-mode'), '答对后没有切到语法树视图');
  check(GB.els.treeGroups.querySelectorAll('.leaf .block').length === r0.blocks.length,
    '积木没有全部落进语法树（升起动画失败）');
  check(GB.els.treeLines.children.length > 0, '语法树连线没画出来');
  const leafOrder = Array.prototype.map.call(
    GB.els.treeGroups.querySelectorAll('.leaf'), n => Number(n.dataset.i)).sort((a, b) => a - b);
  check(leafOrder.join(',') === r0.blocks.map((_, i) => i).join(','),
    '语法树上的积木顺序和原句对不上：' + leafOrder.join(','));
  check(Number(GB.els.hudXp.textContent) === 35, `一次过应得 35 XP，实际 ${GB.els.hudXp.textContent}`);
  check(save().levels['1-1'].rounds[r0.id] === 3, '一次过应该记 3 星');

  /* --- 答错：标红、保留对的、错的退回库 --- */
  GB.els.btnSubmit.click();   // 下一句
  flush();
  check(GB.state.qi === 1, '没走到第 2 句');
  const r1 = GB.LEVELS[0].rounds[1];
  const trayBefore = GB.state.tray.length;
  target(r1).slice().reverse().forEach(t => { const u = GB.uidByText(t); if (u) GB.tapBlock(u); });
  GB.els.btnSubmit.click();
  check(!!doc.querySelector('.fb.bad'), '答错了却没出现「答错」反馈卡');
  const wrongCount = doc.querySelectorAll('#slotRow .slot.wrong').length;
  check(wrongCount > 0, '答错却没有槽位标红');
  check(doc.querySelectorAll('#slotRow .slot.right').length > 0, '答对的那几块应该保留并打勾');
  check((doc.querySelector('.fb.bad').textContent || '').length > 30, '答错反馈里没有讲解文字');
  flush();
  check(GB.state.phase === 'play', '答错后应能重新作答');
  check(GB.state.tray.length === trayBefore - r1.blocks.length + wrongCount,
    '错的积木没有正确退回库里');

  /* --- 提示不弄丢积木 --- */
  const totalBefore = GB.state.tray.length + GB.state.slots.filter(Boolean).length;
  GB.hint();
  const totalAfter = GB.state.tray.length + GB.state.slots.filter(Boolean).length;
  check(totalAfter === totalBefore, '用了提示之后积木总数变了（有积木凭空消失）');
  check(slotTexts()[0] === target(r1)[0], '提示应先把第 1 个槽位填对');

  /* --- 逐关通关，并检查解锁链 --- */
  const levelReports = [];
  for (let i = 0; i < GB.LEVELS.length; i++) {
    if (i > 0) {
      check(GB.isUnlocked(i), `通关第 ${i} 关后，第 ${i + 1} 关应该解锁了`);
      GB.startLevel(i);
    }
    const L = GB.LEVELS[i];
    // 改错关：开局槽位就该是满的，而且藏着一个错
    const fixRound = L.rounds.findIndex(r => r.prefill);
    if (fixRound >= 0) {
      GB.startRound(fixRound);
      check(GB.state.slots.every(Boolean), `${L.id} 第 ${fixRound + 1} 句是改错，开局槽位应该已摆好`);
      check(slotTexts().join(' ') !== target(L.rounds[fixRound]).join(' '),
        `${L.id} 第 ${fixRound + 1} 句开局就该是错的`);
      check(GB.els.modeBadge.textContent === '改错', '改错模式没有显示「改错」标记');
      GB.startRound(0);
    }
    // Boss 关：该显示倒计时
    if (L.boss) {
      check(GB.els.timerWrap.hidden === false, `${L.id} 是 Boss 关，应该显示倒计时`);
      check(/\d+s/.test(GB.els.timerText.textContent), '倒计时的秒数没渲染出来');
    } else {
      check(GB.els.timerWrap.hidden === true, `${L.id} 不该显示倒计时`);
    }

    playLevel(i);
    check(GB.els.done.classList.contains('show'), `${L.id} 玩完后没有出现通关页`);
    const s = save().levels[L.id];
    check(s && s.cleared, `${L.id} 通关后没记到存档里`);
    check(s && s.stars >= 1 && s.stars <= 3, `${L.id} 的星级 ${s && s.stars} 不合法`);
    levelReports.push(`${L.id} ${L.topic}　★${s.stars}　${s.rounds ? Object.keys(s.rounds).length : 0} 句`);

    // 第 1 关里我们故意答错过一句，通关页应该能「重练答错的句子」
    if (i === 0) {
      check(GB.els.btnReview.hidden === false, '有答错的句子时，通关页应该出现「重练」按钮');
      check(/重练/.test(GB.els.btnReview.textContent), '重练按钮的文案不对：' + GB.els.btnReview.textContent);
      GB.els.btnReview.click();
      check(GB.state.review === true, '点了重练应该进入重练模式');
      check(GB.state.queue.length >= 1, '重练队列不该是空的');
      check(GB.state.queue.length < L.rounds.length, '重练队列应该只含答错的那几句');
      check(GB.els.modeBadge.textContent === '错题重练', '重练模式应该显示标记');
      let g2 = 0;
      while (!GB.els.done.classList.contains('show') && g2++ < 20) {
        if (GB.state.phase === 'tree') { GB.els.btnSubmit.click(); flush(); }
        else playRound();
      }
      check(GB.els.done.classList.contains('show'), '重练结束后应该回到通关页');
      check(/这一轮|重练|拿下/.test(GB.els.doneTitle.textContent), '重练结束的通关页标题不对：' + GB.els.doneTitle.textContent);
      GB.els.btnBackMap.click();
    }
    if (i === GB.LEVELS.findIndex(x => x.boss)) {
      const ci = GB.LEVELS[i]._ci;
      if (ci + 1 < GB.CHAPTERS.length) {
        check(GB.isChapterUnlocked(ci + 1), `通关 ${L.id} 后，下一章应该解锁`);
      }
    }
    GB.els.btnBackMap.click();
    check(doc.querySelectorAll('#map .lv.cleared').length === i + 1, `${L.id} 通关后地图上应该有 ${i + 1} 张卡片变绿`);
  }

  /* --- 全通关之后 --- */
  const finalSave = save();
  check(GB.isUnlocked(GB.LEVELS.length - 1), '全通关后最后一关应该是解锁的');
  const totalStars = GB.LEVELS.reduce((s, L) => s + (finalSave.levels[L.id].stars || 0), 0);
  check(totalStars >= GB.LEVELS.length, `总星数太少：${totalStars}`);
  check(finalSave.xp >= 300, `通关整章至少该有 300 XP，实际 ${finalSave.xp}`);
  check(levelOfCheck(), '等级/星数换算不对');

  function levelOfCheck() {
    return GB.levelOf(0) === 1 && GB.levelOf(100) === 2 && GB.levelOf(250) === 3 &&
           GB.starStr(2) === '★★☆';
  }

  /* --- 从句嵌套：语法树里必须真的出现「节点套节点」 --- */
  const nestIdx = GB.LEVELS.findIndex(x => x.id === '4-4');
  if (nestIdx >= 0) {
    GB.startLevel(nestIdx);
    playRound();
    check(GB.els.treeGroups.querySelectorAll('.tnode').length >= 2,
      '定语从句关的语法树节点太少，说明没渲染成树');
    check(GB.els.treeGroups.querySelectorAll('.tnode .tnode').length >= 1,
      '定语从句没有嵌进名词短语里（语法树还是平的）');
    check(GB.els.treeGroups.querySelectorAll('.tnode.clause').length >= 1,
      '从句节点没有被标记成 clause');
    check(GB.els.treeGroups.querySelectorAll('.leaf .block').length ===
      GB.LEVELS[nestIdx].rounds[0].blocks.length, '嵌套之后积木没有全部落进语法树');
    // 嵌套层数：根下面是 tnode，tnode 里面还有 tnode
    const deepest = GB.els.treeGroups.querySelectorAll('.tnode .tnode .leaf').length;
    check(deepest >= 2, '嵌套层里的积木没挂对：' + deepest);
    GB.showMap();

    /* 练习模式用的是同一关共享的 groups，也要能嵌 —— 例题是嵌套的琥珀树，
       练习却变成一排扁平的灰框，那这个语法点最值钱的视觉就丢了 */
    GB.startPractice(nestIdx);
    playRound();
    check(GB.els.treeGroups.querySelectorAll('.tnode .tnode').length >= 1,
      '练习模式的定语从句没有嵌进名词短语里（语法树还是平的）');
    check(GB.els.treeGroups.querySelectorAll('.tnode.clause').length >= 1,
      '练习模式里从句节点没有被标记成 clause（不会显示成琥珀色）');
    GB.showMap();
  }

  /* --- 答对后跳别的句子，按钮不该同时触发「提交」和「下一句」 --- */
  const jumpIdx = GB.LEVELS.findIndex(x => x.id === '5-2');
  if (jumpIdx >= 0) {
    GB.startLevel(jumpIdx);
    playRound();                       // 做完第 1 句，按钮此时是「下一句」
    GB.startRound(2);                  // 模拟点了进度点，跳到第 3 句
    playRound();                       // 再做一句
    check(GB.state.qi === 2,
      '提交的同时被「下一句」带走了：qi=' + GB.state.qi + '（按钮上挂了多个处理函数）');
    check(GB.els.board.classList.contains('tree-mode'),
      '点进度点之后提交，语法树没出来');
    check(GB.els.treeGroups.querySelectorAll('.leaf .block').length ===
      GB.LEVELS[jumpIdx].rounds[2].blocks.length, '跳句之后积木没落进语法树');
    GB.showMap();
  }

  /* --- 非谓语标记：分词/动名词/不定式要能看出来 --- */
  const nfIdx = GB.LEVELS.findIndex(x => x.id === '5-3');
  if (nfIdx >= 0) {
    GB.startLevel(nfIdx);
    playRound();
    check(GB.els.treeGroups.querySelectorAll('.leaf.nonfinite').length >= 1,
      '非谓语积木在语法树里没有被标记出来');
    check(GB.els.treeGroups.querySelectorAll('.leaf .block').length ===
      GB.LEVELS[nfIdx].rounds[0].blocks.length, '第五章的积木没有全部落进语法树');
    GB.showMap();
  }

  /* --- 多句衔接：中间的句号和逗号要真的渲染出来 --- */
  const discIdx = GB.LEVELS.findIndex(x => x.id === '6-1');
  if (discIdx >= 0) {
    GB.startLevel(discIdx);
    const dr = GB.LEVELS[discIdx].rounds[0];
    fillByIndex();
    check(GB.els.slotRow.querySelectorAll('.period').length === 3,
      '两句之间的标点没渲染出来，期望 2 个，实际 ' +
      GB.els.slotRow.querySelectorAll('.period').length);
    const marks = Array.prototype.map.call(
      GB.els.slotRow.querySelectorAll('.period'), n => n.textContent).join('');
    check(marks === '.,.', '标点应该是 句号+逗号+句末句号，实际 ' + marks);
    GB.els.btnSubmit.click();
    flush();
    check(/hard\. However, he failed the exam\./.test(GB.els.treeSentence.textContent),
      '语法树上那句话的标点不对：' + GB.els.treeSentence.textContent);
    check(GB.els.treeRoot.textContent === '句群', '句群关的树根标签应该是「句群」');
    check(GB.els.treeGroups.querySelectorAll('.leaf .block').length === dr.blocks.length,
      '句群关的积木没有全部落进语法树');
    GB.showMap();
  }

  /* --- 练习模式 --- */
  const pIdx = GB.LEVELS.findIndex(x => x.id === '1-1');
  const prs = GB.practiceRounds(pIdx);
  check(prs.length >= 30, '1-1 的练习题太少：' + prs.length);
  check(prs.every(r => r.practice), '练习句应该都带 practice 标记');
  check(prs.every(r => r.blocks && r.blocks.length >= 3), '练习句没展开成积木');
  check(prs.every(r => r.blocks.every(b => b.pos && b.role && b.group)),
    '练习句里有积木缺词性 / 角色 / 分组');
  check(prs.every(r => r.id.indexOf('1-1-p') === 0), '练习句的 id 前缀不对');
  check(prs.filter(r => r.prefill).length >= 20,
    '大部分练习应该是改错题（带 prefill），实际 ' + prs.filter(r => r.prefill).length);
  check(prs.every(r => r.explain && r.explain.length > 5), '练习句缺讲解');

  // 练习题展开之后，也要过一遍和普通句子一样的内容规则
  let checkedPractice = 0;
  const looseGroups = new Set();
  GB.LEVELS.forEach((lv, i) => {
    GB.practiceRounds(i).forEach((r, k) => {
      const at = `练习 ${lv.id}-p${k + 1}`;
      checkedPractice++;
      if (r.mode === 'order') {
        // 段落排序：没有词性、没有语法树，只检查句子和衔接关系
        check(r.blocks.length >= 3, `${at}: 句子太少`);
        check(r.blocks.every(b => b.text && b.role), `${at}: 有句子缺文字或角色`);
        check(Array.isArray(r.links) && r.links.length === r.blocks.length - 1,
          `${at}: links 数量应该是 ${r.blocks.length - 1}`);
        return;
      }
      const gids = (r.groups || []).map(g => g.id);
      check(r.groups && r.groups.length > 0, `${at}: 缺 groups`);
      check(r.blocks.length >= 2, `${at}: 积木太少`);
      r.blocks.forEach(b => {
        check(POS_SPEC[b.pos], `${at}: 积木 "${b.text}" 词性不对`);
        check(!!b.role, `${at}: 积木 "${b.text}" 缺语法角色`);
        check(gids.indexOf(b.group) >= 0, `${at}: 积木 "${b.text}" 的分组不在 groups 里`);
      });
      // 每个组的积木必须连续
      const seq = r.blocks.map(b => gids.indexOf(b.group));
      const seen = new Set();
      let last = -1, ok = true;
      seq.forEach(g => {
        if (g !== last) {
          if (seen.has(g)) ok = false;
          seen.add(g); last = g;
        }
      });
      check(ok, `${at}: 同一分组的积木不连续，语法树会画错`);
      // 带 parent 的分组（从句嵌在名词短语里）要连整个子树一起看：
      // 父节点 + 所有后代的积木必须是一段连续的位置，否则树读出来的顺序是错的
      const parentOf = {};
      (r.groups || []).forEach(g => { if (g.parent) parentOf[g.id] = g.parent; });
      (r.groups || []).forEach(g => {
        if (!g.parent) return;
        const inSub = new Set([g.id]);
        (r.groups || []).forEach(o => {
          let cur = o.id, hops = 0;
          while (cur && hops++ < 12) {
            if (cur === g.id) { inSub.add(o.id); break; }
            cur = parentOf[cur];
          }
        });
        const at2 = [];
        r.blocks.forEach((b, i) => { if (inSub.has(b.group)) at2.push(i); });
        check(at2.length === 0 || at2[at2.length - 1] - at2[0] + 1 === at2.length,
          `${at}: 分组 "${g.id}" 连同它的子组积木不连续，嵌套进语法树会读错顺序`);
      });
      // 练习的 groups 是整关共享的，某题没用到某个分组 -> 语法树里会多一个空框。
      // 渲染层已经会跳过没有积木的分组，所以这不算错，只是数据可以更紧 —— 记进提示里。
      const gidList = (r.groups || []).map(g => g.id);
      const subtreeHasBlock = gid => gidList.some((id, idx) => {
        if (id !== gid) {
          let cur = (r.groups || [])[idx].parent, hops = 0;
          while (cur && hops++ < 12) {
            if (cur === gid) break;
            const pg = (r.groups || []).find(x => x.id === cur);
            cur = pg ? pg.parent : null;
          }
          if (cur !== gid) return false;
        }
        return r.blocks.some(b => b.group === id);
      });
      (r.groups || []).forEach(g => {
        if (!subtreeHasBlock(g.id)) looseGroups.add(lv.id + ' 的「' + g.label + '」');
      });
      // 反馈面板的「正确：」必须是带标点的完整句子，标点要贴着前面的词
      if (r.example) {
        check(!/ [.,!?;:]/.test(r.example),
          `${at}: example 里的标点前多了空格："${r.example}"`);
        check(/[.?!]["']?$/.test(r.example.trim()),
          `${at}: example 结尾没有标点："${r.example}"`);
      }
      // prefill 必须能从现有积木里找到（否则玩家永远拼不出来）
      const pool = new Set(r.blocks.concat(r.distractors).map(b => b.text));
      (r.prefill || []).forEach((txt, j) => {
        check(pool.has(txt), `${at}: prefill[${j}]="${txt}" 在库里找不到`);
      });
      check(!r.prefill || r.prefill.length === r.blocks.length,
        `${at}: prefill 长度和积木数对不上`);
    });
  });
  check(checkedPractice === practiceTotal.items + (practiceTotal.orderItems || 0),
    `展开出来的练习题数量对不上：${checkedPractice} vs ${practiceTotal.items}`);
  if (looseGroups.size) {
    notes.push(`按练习数据，有 ${looseGroups.size} 个「整关声明了、但这句用不到」的分组；` +
      '渲染时会自动跳过，不影响玩法，只是数据可以更紧：');
    [...looseGroups].slice(0, 12).forEach(s => notes.push('    · ' + s));
    if (looseGroups.size > 12) notes.push(`    …… 另有 ${looseGroups.size - 12} 个`);
  }
  GB.showMap();
  check(doc.querySelectorAll('#map .lv-practice').length >= 1,
    '通关之后地图卡片上应该出现练习按钮');
  const starsBefore = GB.levelSave('1-1').stars;
  GB.startPractice(pIdx);
  check(GB.state.session === 'practice', '没进入练习模式');
  check(GB.state.queue.length === prs.length, '练习队列长度不对');
  check(GB.els.modeBadge.textContent === '练习', '练习模式没显示标记');
  check(GB.els.slotRow.querySelectorAll('.slot').length === prs[0].blocks.length,
    '练习第一句没渲染出来');
  // 连做三句
  for (let i2 = 0; i2 < 3; i2++) {
    if (GB.state.phase === 'tree') { GB.els.btnSubmit.click(); flush(); }
    else playRound();
  }
  check(GB.state.qi >= 1, '练习模式推进不了，停在第 ' + GB.state.qi + ' 句');
  check(GB.levelSave('1-1').stars === starsBefore, '练习模式不该改变关卡星级');

  /* --- 练习的 groups 是整关共享的，用不到的分组不能在树里留下空框 --- */
  const looseLv = GB.LEVELS.findIndex(x => x.id === '1-1');
  const looseRound = GB.practiceRounds(looseLv)[0];
  const looseGids = looseRound.groups.map(g => g.id);
  const usedGids = new Set(looseRound.blocks.map(b => b.group));
  check(looseGids.length > usedGids.size,
    '1-1 练习第一句本该有「用不到的分组」，用例前提变了');
  GB.showMap();
  GB.startPractice(looseLv);
  playRound();
  const emptyNodes = Array.prototype.filter.call(
    GB.els.treeGroups.querySelectorAll('.tnode'),
    n => n.querySelector('.tnode-kids').children.length === 0);
  check(emptyNodes.length === 0,
    '语法树里出现了空框（用不到的分组被画进去了）：' +
    emptyNodes.map(n => n.querySelector('.tree-node').textContent).join('、'));
  check(GB.els.treeGroups.querySelectorAll('.leaf .block').length === looseRound.blocks.length,
    '跳过空分组之后积木数对不上');
  GB.showMap();

  /* --- 错题本 --- */
  const pList = () => GB.pocketList(false);
  check(pList().length >= 1, '故意答错之后，错题本里应该记下来');
  const pFirst = pList()[0];
  check(!!pFirst && Number.isInteger(pFirst.li) && Number.isInteger(pFirst.ri),
    '错题本记录的定位信息不对');
  check(pFirst.e.n >= 1, '错误次数没记上');
  check(GB.LEVELS[pFirst.li].rounds[pFirst.ri].id === '1-1-r2',
    '记下来的应该是刚才做错的那一句，实际 ' +
    GB.LEVELS[pFirst.li].rounds[pFirst.ri].id);

  GB.showPocket();
  check(!GB.els.pocketView.hidden, '错题本视图没打开');
  check(GB.els.mapView.hidden && GB.els.playView.hidden, '打开错题本时其它视图应该藏起来');
  check(GB.els.pocket.querySelectorAll('.pcard').length === pList().length,
    '错题本的卡片数量对不上');
  check(GB.els.btnPocket.textContent.indexOf(String(pList().length)) >= 0,
    '顶栏的错题本按钮没显示数量：' + GB.els.btnPocket.textContent);

  // 单练这一句，第一次就做对 → 应该被划掉
  const beforePocket = pList().length;
  GB.startSession([{ li: pFirst.li, ri: pFirst.ri }], 'pocket');
  check(GB.state.session === 'pocket', '没进入错题本模式');
  check(GB.state.queue.length === 1, '单练一句的队列长度不对');
  check(GB.els.playView.hidden === false, '错题练习应该切到关卡视图');
  playRound();
  check(pList().length === beforePocket - 1,
    '错题本里一次就做对的句子应该被划掉，实际还剩 ' + pList().length);

  // 跨关卡：两条记录来自不同关卡
  GB.noteWrong('3-1', '3-1-r1');
  GB.noteWrong('5-2', '5-2-r2');
  const cross = GB.pocketList(false);
  check(cross.length === 2, '跨关卡记录数量不对：' + cross.length);
  check(GB.LEVELS[cross[0].li].id !== GB.LEVELS[cross[1].li].id,
    '两条记录应该来自不同关卡');
  GB.startSession(cross.map(x => ({ li: x.li, ri: x.ri })), 'pocket');
  check(GB.state.queue.length === 2, '跨关卡练习的队列长度不对');
  check(GB.els.slotRow.querySelectorAll('.slot').length ===
    GB.LEVELS[cross[0].li].rounds[cross[0].ri].blocks.length,
    '跨关卡练习的第一句没渲染出来');
  check(GB.els.dots.querySelectorAll('.dot.wide-dot').length === 2,
    '跨关卡时进度点应该显示关卡号');
  check(GB.state.li === cross[0].li, '跨关卡练习时当前关卡没跟着切');
  GB.showMap();

  /* --- 段落排序：竖排 + 答对后的逻辑链 --- */
  const ordIdx = GB.LEVELS.findIndex(x => x.id === '7-1');
  if (ordIdx >= 0) {
    GB.startLevel(ordIdx);
    const or0 = GB.LEVELS[ordIdx].rounds[0];
    check(GB.els.slotRow.classList.contains('vertical'), '段落排序的槽位应该是竖排');
    check(GB.els.tray.classList.contains('vertical'), '段落排序的积木库应该是竖排');
    check(GB.els.slotRow.querySelectorAll('.slot.wide').length === or0.blocks.length,
      '段落排序的槽位没有全部铺开');
    check(GB.els.slotRow.querySelectorAll('.period').length === 0,
      '段落排序不该自动加标点（句子自己带着）');
    fillByIndex();
    GB.els.btnSubmit.click();
    flush();
    check(GB.els.board.classList.contains('flow-mode'), '答对后没有切到段落结构视图');
    check(!GB.els.board.classList.contains('tree-mode'), '段落排序不该走语法树视图');
    check(GB.els.flow.querySelectorAll('.flow-item').length === or0.blocks.length,
      '段落结构里的句子数量不对：' + GB.els.flow.querySelectorAll('.flow-item').length);
    check(GB.els.flow.querySelectorAll('.flow-link').length === or0.blocks.length - 1,
      '段落结构里的关系箭头数量不对：' + GB.els.flow.querySelectorAll('.flow-link').length);
    check(GB.els.flow.textContent.includes(or0.links[0]), '关系标签没显示出来');
    check(GB.els.flow.textContent.includes(or0.blocks[0].role), '句子角色没显示出来');
    GB.showMap();
  }

  /* --- 疑问句的句末标点 --- */
  const qIdx = GB.LEVELS.findIndex(x => x.id === '2-7');
  if (qIdx >= 0) {
    GB.startLevel(qIdx);
    const qri = GB.LEVELS[qIdx].rounds.findIndex(r => r.punct === '?');
    GB.startRound(qri);
    const per = GB.els.slotRow.querySelector('.period');
    check(per && per.textContent === '?', '疑问句的句末应该是问号');
    check(GB.punctOf(GB.LEVELS[qIdx].rounds[qri]) === '?', 'punctOf 没有返回问号');
    GB.showMap();
  }

  /* --- 静音开关 --- */
  const beforeMute = JSON.parse(page.win.localStorage.getItem('grammarBlocks.v2')).muted;
  GB.els.btnMute.click();
  check(JSON.parse(page.win.localStorage.getItem('grammarBlocks.v2')).muted === !beforeMute, '静音状态没存进存档');
  check(/🔇|🔊/.test(GB.els.btnMute.textContent), '静音按钮没有图标');
  GB.els.btnMute.click();
  check(JSON.parse(page.win.localStorage.getItem('grammarBlocks.v2')).muted === beforeMute, '再点一下应该切回来');

  notes.push('玩法自检：练习模式（' + GB.practiceRounds(0).length + ' 句/关）→ 地图 → 章节解锁 → 拼句 → 判定 → 语法树 → 改错 → 疑问句 → Boss 限时 → 错题重练 → 错题本（含跨关卡）→ 全部通关');
  levelReports.forEach(r => notes.push('   ' + r));
  } catch (e) {
    errors.push('玩法自检中途抛异常：' + (e && e.message) + '\n    ' + String(e && e.stack).split('\n')[1]);
  }
} else {
  errors.push('主脚本没有导出 __GB__，无法做玩法自检');
}

/* ============================================================
   四、levels/*.json 与内嵌数据同步
   ============================================================ */
const sync = process.argv.includes('--sync');
if (sync) {
  fs.mkdirSync(LEVELS_DIR, { recursive: true });
  ALL_LEVELS.forEach(lv => {
    fs.writeFileSync(path.join(LEVELS_DIR, lv.id + '.json'), JSON.stringify(lv, null, 2) + '\n', 'utf8');
  });
  CHAPTERS.forEach((ch, ci) => {
    fs.writeFileSync(path.join(LEVELS_DIR, 'chapter-' + (ci + 1) + '.json'), JSON.stringify(ch, null, 2) + '\n', 'utf8');
  });
  if (DATA.practice) {
    fs.writeFileSync(path.join(LEVELS_DIR, 'practice.json'), JSON.stringify(DATA.practice, null, 2) + '\n', 'utf8');
  }
  notes.push('已写出 levels/（每关一个 json + 每章一个 chapter-N.json）');
} else {
  if (!fs.existsSync(LEVELS_DIR)) {
    errors.push('levels/ 不存在，运行 node smoke-test.js --sync 生成');
  } else {
    ALL_LEVELS.forEach(lv => {
      const f = path.join(LEVELS_DIR, lv.id + '.json');
      if (!fs.existsSync(f)) { errors.push(`levels/${lv.id}.json 不存在`); return; }
      let same = false;
      try { same = JSON.stringify(JSON.parse(fs.readFileSync(f, 'utf8'))) === JSON.stringify(lv); } catch (e) { same = false; }
      check(same, `levels/${lv.id}.json 和 index.html 里的不一致（跑 node smoke-test.js --sync 同步）`);
    });
  }
}

/* ---------- 报告 ---------- */
if (errors.length) fail(errors);

console.log('✓ 自检通过');
console.log(`  内容：${CHAPTERS.length} 章 / ${ALL_LEVELS.length} 关 / ${stat.rounds} 句`);
console.log(`  ${stat.blocks} 块正解 / ${stat.distract} 块干扰项 / ${stat.fix} 句改错 / ${stat.timed} 句限时 / ${stat.ask} 句疑问`);
console.log(`  覆盖词性：${[...posUsed].map(p => POS_SPEC[p].label).join('、')}`);
console.log(`  练习模式：${practiceTotal.levels}/${ALL_LEVELS.length} 关有练习，共 ${practiceTotal.items} 句`);
notes.forEach(n => console.log('  ' + n));
