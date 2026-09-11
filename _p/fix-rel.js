/* 定语从句的先行词有时是主语 NP、有时是宾语 NP，而练习的 groups 是整关共享的 ——
   一个 rel 分组没法同时挂在 np1 和 np2 下面。这里按先行词把 rel 拆成两个分组：
     rel  -> 修饰主语 NP（parent: np1）
     rel2 -> 修饰宾语 NP（parent: np2）
   判据：句型里紧挨在 rel 那一段前面的分组是谁，就归谁。
   用法：node _p/fix-rel.js */
const fs = require('fs');
const path = require('path');
const ALL = path.join(__dirname, 'practice-all.json');
const P = JSON.parse(fs.readFileSync(ALL, 'utf8'));

const TARGETS = ['4-4', '4-5'];
const report = [];

TARGETS.forEach(function (lid) {
  const lv = P[lid];
  if (!lv || !lv.patterns) return;

  // 先让 rel 明确挂到 np1 上
  const rel = lv.groups.find(function (g) { return g.id === 'rel'; });
  if (!rel) return;
  rel.clause = true;
  rel.parent = 'np1';
  rel.label = '定语从句（修饰主语 NP）';

  if (!lv.groups.some(function (g) { return g.id === 'rel2'; })) {
    lv.groups.push({
      id: 'rel2', label: '定语从句（修饰宾语 NP）', clause: true, parent: 'np2'
    });
  }

  // 逐个句型：rel 那一段前面紧挨着的是谁
  let moved = 0;
  lv.patterns.forEach(function (pat) {
    const gs = pat.map(function (s) { return s[2]; });
    let i = 0;
    while (i < gs.length) {
      if (gs[i] !== 'rel') { i++; continue; }
      const start = i;
      while (i < gs.length && gs[i] === 'rel') i++;
      const before = start > 0 ? gs[start - 1] : null;
      if (before === 'np2') {
        for (let j = start; j < i; j++) { pat[j][2] = 'rel2'; moved++; }
      }
    }
  });
  report.push(lid + '：' + moved + ' 个槽位改挂到 rel2（修饰宾语 NP）');
});

fs.writeFileSync(ALL, JSON.stringify(P));
report.forEach(function (s) { console.log('  · ' + s); });
console.log('  ✓ 已写回 practice-all.json（接着跑 node _p/rebuild.js）');
