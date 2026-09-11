/* 练习数据管线：
   1) 从 index.html 抽出 practice 对象（或读已有的 _p/practice-all.json）
   2) 合并 _p/practice-*.json 片段（新关卡）
   3) 做一遍规范化修补（骨架长度自动匹配、表语分组纠正）
   4) 紧凑写回 index.html，并保存 practice-all.json
   用法：node _p/rebuild.js */
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'index.html');
const ALL = path.join(__dirname, 'practice-all.json');
let t = fs.readFileSync(HTML, 'utf8');
const report = [];

/* ---------- 1. 取数据 ---------- */
let P;
if (fs.existsSync(ALL)) {
  P = JSON.parse(fs.readFileSync(ALL, 'utf8'));
  report.push('读 practice-all.json');
} else {
  const s = t.indexOf('"practice": {');
  const e = t.lastIndexOf('\n}\n</script>');
  if (s < 0 || e < 0) { console.log('  ✗ 找不到 practice 块'); throw new Error('rebuild stopped'); }
  const raw = '{"practice": ' + t.slice(s + '"practice": '.length, e) + '}';
  P = JSON.parse(raw).practice;
  report.push('从 index.html 抽出练习数据');
}

/* ---------- 2. 合并片段 ---------- */
fs.readdirSync(__dirname).filter(f => /^practice-\d+\.json$/.test(f)).forEach(function (f) {
  const frag = JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));
  let added = 0;
  Object.keys(frag).forEach(function (k) {
    if (P[k]) return;
    P[k] = frag[k];
    added++;
  });
  if (added) report.push(`合并 ${f}：新增 ${added} 关`);
});

/* ---------- 3. 规范化修补 ---------- */

// 表语的分组应该是 np2，不是 np1
let fixedGroup = 0;
Object.keys(P).forEach(function (lid) {
  const lv = P[lid];
  if (!lv.patterns) return;   // 段落排序的练习没有句型骨架
  lv.patterns.forEach(function (pat) {
    pat.forEach(function (s) {
      if (s[1] === '表语' && s[2] === 'np1') { s[2] = 'np2'; fixedGroup++; }
    });
  });
  const usesNp2 = lv.patterns.some(pat => pat.some(s => s[2] === 'np2'));
  if (usesNp2 && !lv.groups.some(g => g.id === 'np2')) {
    lv.groups.push({ id: 'np2', label: '宾语 / 表语 NP' });
  }
  // ensure group 覆盖骨架用到的所有分组
  const gids = lv.groups.map(g => g.id);
  lv.patterns.forEach(function (pat) {
    pat.forEach(function (s) {
      if (gids.indexOf(s[2]) < 0) { lv.groups.push({ id: s[2], label: s[2] }); gids.push(s[2]); }
    });
  });
});
if (fixedGroup) report.push('纠正表语分组 ' + fixedGroup + ' 处');

// 例题里的从句分组带 clause:true（渲染成琥珀色）和 parent（从句嵌在主句里）。
// 练习的 groups 是整关共享的，也照抄一份 —— 否则同一个语法点，
// 例题是嵌套的琥珀树、练习却变成一排扁平的灰框。
const CLAUSE_LABEL = /从句/;
let fixedClause = 0;
let fixedParent = 0;
const noNest = [];
Object.keys(P).forEach(function (lid) {
  const lv = P[lid];
  if (!lv.patterns || !lv.groups) return;
  let real = null;
  try {
    real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'levels', lid + '.json'), 'utf8'));
  } catch (e) { return; }
  const realRounds = real.rounds || real;
  if (!Array.isArray(realRounds)) return;
  // 同一关的不同例题里，同一个分组的 parent 可能写成不一样的 id
  // （比如有的例题用 vp，有的用 vp2）。所以把候选全收起来，
  // 再挑第一个「练习的 groups 里真的存在」的，避免抄到一个不存在的父节点。
  const meta = {};
  realRounds.forEach(function (r) {
    (r.groups || []).forEach(function (g) {
      if (!g.clause && !g.parent) return;
      const m = meta[g.id] || (meta[g.id] = { clause: false, parents: [] });
      if (g.clause) m.clause = true;
      if (g.parent && m.parents.indexOf(g.parent) < 0) m.parents.push(g.parent);
    });
  });
  const ids = lv.groups.map(function (g) { return g.id; });

  /* 能不能把 cid 挂到 pid 下面，取决于「挂上去之后语法树会不会读错顺序」：
     父节点（含所有子节点）的积木必须始终是一段连续的位置。
     如果一个分组在不同句型里承担的句法角色不一样（比如动名词有时作主语、
     有时作宾语），那它就没有一个统一的父节点 —— 这种情况保持平铺才对。 */
  function canNest(cid, pid) {
    const parentOf = {};
    lv.groups.forEach(function (g) { if (g.parent) parentOf[g.id] = g.parent; });
    const inSub = {};
    lv.groups.forEach(function (g) {
      let cur = g.id, hops = 0;
      while (cur && hops++ < 12) {
        if (cur === pid) { inSub[g.id] = true; break; }
        cur = parentOf[cur];
      }
    });
    inSub[pid] = true;
    return lv.patterns.every(function (pat) {
      const at = [];
      pat.forEach(function (s, i) { if (inSub[s[2]] || s[2] === cid) at.push(i); });
      if (!at.length) return true;
      return at[at.length - 1] - at[0] + 1 === at.length;
    });
  }

  lv.groups.forEach(function (g) {
    const m = meta[g.id];
    if (!g.clause) {
      if (m && m.clause) g.clause = true;
      else if (CLAUSE_LABEL.test(g.label || '')) g.clause = true;
      else return;
      fixedClause++;
    }
    // 已经标了 clause 的分组也要能补 parent，所以这段不能放进上面的分支里
    if (!g.parent && m) {
      const p = m.parents.filter(function (x) {
        return x !== g.id && ids.indexOf(x) >= 0 && canNest(g.id, x);
      })[0];
      if (p) { g.parent = p; fixedParent++; }
      else if (m.parents.length) noNest.push(lid + ' 的「' + g.label + '」');
    }
  });
});
if (fixedClause) report.push('补上从句标记 ' + fixedClause + ' 处');
if (fixedParent) report.push('补上从句嵌套关系 ' + fixedParent + ' 处');
if (noNest.length) report.push('保持平铺（没有统一的父节点）' + noNest.length + ' 处：' + noNest.join('、'));

// 给 2-3 / 2-7 补上缺少的短骨架（幂等）
const extra = {
  '2-3': [['pronoun', '主语', 'np1'], ['verb', '谓语', 'vp'], ['noun', '表语', 'np2']],
  '2-7': [['verb', '谓语', 'vp'], ['pronoun', '主语', 'np1'], ['adj', '表语', 'np2']]
};
Object.keys(extra).forEach(function (lid) {
  if (!P[lid] || !P[lid].patterns) return;
  const pat = extra[lid];
  if (!P[lid].patterns.some(p => JSON.stringify(p) === JSON.stringify(pat))) {
    P[lid].patterns.push(pat);
    report.push(`${lid} 补了一个 ${pat.length} 槽骨架`);
  }
});

// 骨架长度不匹配时，自动换到长度相同的骨架
let switched = 0;
const stillBad = [];
Object.keys(P).forEach(function (lid) {
  const lv = P[lid];
  if (!lv.items) return;
  lv.items.forEach(function (it, k) {
    const cur = lv.patterns[it.p || 0];
    if (cur && it.w.length === cur.length) return;
    const alt = lv.patterns.findIndex(p => p.length === it.w.length);
    if (alt >= 0) { it.p = alt; switched++; }
    else stillBad.push(lid + ' 第' + (k + 1) + '句（' + it.w.length + ' 词）');
  });
});
if (switched) report.push('自动改骨架 ' + switched + ' 句');
if (stillBad.length) { console.log('  ✗ 这些句子没有长度匹配的骨架：' + stillBad.join('、')); throw new Error('rebuild stopped'); }

/* ---------- 4. 紧凑写回 ---------- */
function fmtPractice(p) {
  const keys = Object.keys(p);
  const lines = ['"practice": {'];
  keys.forEach(function (k, i) {
    const lv = p[k];
    lines.push('    ' + JSON.stringify(k) + ': {');
    if (lv.punct) lines.push('      "punct": ' + JSON.stringify(lv.punct) + ',');
    if (lv.paragraphs) {
      lines.push('      "rules": ' + JSON.stringify(lv.rules) + ',');
      lines.push('      "paragraphs": [');
      lv.paragraphs.forEach(function (it, j) {
        lines.push('        ' + JSON.stringify(it) + (j < lv.paragraphs.length - 1 ? ',' : ''));
      });
      lines.push('      ]');
    } else {
      lines.push('      "groups": ' + JSON.stringify(lv.groups) + ',');
      lines.push('      "patterns": ' + JSON.stringify(lv.patterns) + ',');
      lines.push('      "rules": ' + JSON.stringify(lv.rules) + ',');
      lines.push('      "items": [');
      lv.items.forEach(function (it, j) {
        lines.push('        ' + JSON.stringify(it) + (j < lv.items.length - 1 ? ',' : ''));
      });
      lines.push('      ]');
    }
    lines.push('    }' + (i < keys.length - 1 ? ',' : ''));
  });
  lines.push('  }');
  return lines.join('\n');
}

fs.writeFileSync(ALL, JSON.stringify(P, null, 2) + '\n', 'utf8');

const s = t.indexOf('"practice": {');
const e = t.lastIndexOf('\n}\n</script>');
if (s < 0 || e < 0) { console.log('  ✗ 找不到 practice 块'); throw new Error('rebuild stopped'); }
t = t.slice(0, s) + fmtPractice(P) + t.slice(e);

let jsonOk = '';
try {
  const jm = t.match(/<script id="levelData" type="application\/json">([\s\S]*?)<\/script>/);
  const p = JSON.parse(jm[1]);
  const ids = Object.keys(p.practice);
  jsonOk = '✓ index.html JSON 合法：练习覆盖 ' + ids.length + ' 关，共 ' +
    ids.reduce((sum, k) => sum + (p.practice[k].items || p.practice[k].paragraphs || []).length, 0) + ' 组';
} catch (err) {
  console.error('JSON 错误原文：' + err.message);
  const mm = /position (\d+)/.exec(err.message);
  if (mm) {
    const pos = Number(mm[1]);
    const body = jm[1];
    console.error('出错位置附近：' + JSON.stringify(body.slice(Math.max(0, pos - 220), pos + 60)));
  }
  jsonOk = '✗ index.html JSON 解析失败：' + err.message;
  throw new Error('rebuild stopped');
}

const scripts = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)];
try { new Function(scripts[scripts.length - 1][1]); } catch (err) { console.log('  ✗ 主脚本语法错误：' + err.message); throw new Error('rebuild stopped'); }

fs.writeFileSync(HTML, t, 'utf8');
report.forEach(r => console.log('  · ' + r));
console.log('  ' + jsonOk);
