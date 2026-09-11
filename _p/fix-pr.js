/* 自检增加练习题校验 */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'smoke-test.js');
let t = fs.readFileSync(F, 'utf8');
const report = [];
let failed = false;

function sub(name, from, to) {
  const n = t.split(from).length - 1;
  if (n !== 1) { report.push(`✗ ${name}：锚点 ${n} 次`); failed = true; return; }
  t = t.replace(from, to);
  report.push('✓ ' + name);
}

/* 1. 练习题数据的结构校验 */
sub('练习题结构校验',
`/* ============================================================
   二、结构：元素 id、els 表、脚本语法
   ============================================================ */`,
`/* ============================================================
   一之二、练习题内容
   练习题是紧凑写法（句型骨架 + 一行一题），展开前先把结构性的坑挡掉。
   最关键的一条：句子的词数必须和它用的骨架长度一致 ——
   长度不匹配时展开会默默套用最后一个位置的词性，把介词标成名词这种错就出来了。
   ============================================================ */
const LEVEL_IDS = new Set(ALL_LEVELS.map(l => l.id));
const practiceTotal = { levels: 0, items: 0 };

Object.keys(DATA.practice || {}).forEach(function (lid) {
  const p = DATA.practice[lid];
  const at = \`练习 \${lid}\`;
  check(LEVEL_IDS.has(lid), \`\${at}: 这个关卡 id 在 chapters 里不存在\`);
  check(Array.isArray(p.patterns) && p.patterns.length > 0, \`\${at}: 缺少 patterns（句型骨架）\`);
  (p.patterns || []).forEach((pat, i) => {
    check(Array.isArray(pat) && pat.length >= 2, \`\${at}: 第 \${i + 1} 个骨架太短\`);
    (pat || []).forEach(s => {
      check(Array.isArray(s) && s.length === 3,
        \`\${at}: 骨架的一个位置必须写成 [词性, 语法角色, 分组]\`);
      if (Array.isArray(s)) check(POS_SPEC[s[0]], \`\${at}: 骨架里有未知词性 "\${s[0]}"\`);
    });
  });
  check(Array.isArray(p.groups) && p.groups.length > 0, \`\${at}: 缺少 groups\`);
  const pgids = (p.groups || []).map(g => g.id);
  check(Array.isArray(p.rules) && p.rules.length > 0, \`\${at}: 缺少 rules\`);
  (p.rules || []).forEach((r, i) => {
    check(typeof r === 'string' && r.length > 4, \`\${at}: 第 \${i + 1} 条规则太短\`);
  });
  // 骨架里的分组必须在 groups 里
  (p.patterns || []).forEach((pat, i) => {
    (pat || []).forEach(s => {
      if (Array.isArray(s)) check(pgids.includes(s[2]), \`\${at}: 骨架 \${i + 1} 的分组 "\${s[2]}" 不在 groups 里\`);
    });
  });

  check(Array.isArray(p.items) && p.items.length >= 20,
    \`\${at}: 练习题只有 \${(p.items || []).length} 句，太少（目标 30 句）\`);
  (p.items || []).forEach((it, k) => {
    const one = \`\${at} 第 \${k + 1} 句\`;
    const pi = it.p || 0;
    const pat = (p.patterns || [])[pi];
    check(!!pat, \`\${one}: 指定的骨架 \${pi} 不存在\`);
    check(Array.isArray(it.w) && it.w.length > 0, \`\${one}: 缺少词\`);
    if (pat) {
      check(it.w.length === pat.length,
        \`\${one}: 有 \${it.w.length} 个词，但骨架是 \${pat.length} 个 —— 词性会标错\`);
    }
    if (it.r !== undefined) check(!!(p.rules || [])[it.r], \`\${one}: 引用了不存在的规则 \${it.r}\`);
    if (it.c !== undefined) check(typeof it.c === 'string' && it.c.length > 0, \`\${one}: 中文意思写空了\`);
    const dws = Object.keys(it.d || {});
    dws.forEach(w => {
      check((it.w || []).indexOf(w) < 0, \`\${one}: 干扰词 "\${w}" 和正解重名\`);
      const at2 = it.d[w];
      check(Number.isInteger(at2) && at2 >= 0 && at2 < (it.w || []).length,
        \`\${one}: 干扰词 "\${w}" 的位置 \${at2} 越界\`);
    });
    if (!it.c) {
      check(dws.length > 0, \`\${one}: 既没有中文意思、又没有干扰项 —— 改错题会没有提示\`);
    }
    practiceTotal.items++;
  });
  practiceTotal.levels++;
});

/* ============================================================
   二、结构：元素 id、els 表、脚本语法
   ============================================================ */`);

/* 2. 报告里带上练习统计 */
sub('报告带练习统计',
`console.log(\`  覆盖词性：\${[...posUsed].map(p => POS_SPEC[p].label).join('、')}\`);`,
`console.log(\`  覆盖词性：\${[...posUsed].map(p => POS_SPEC[p].label).join('、')}\`);
console.log(\`  练习模式：\${practiceTotal.levels}/\${ALL_LEVELS.length} 关有练习，共 \${practiceTotal.items} 句\`);`);

/* 3. 展开之后再验一遍（在玩法自检里跑真代码） */
sub('展开后校验',
`  check(prs.every(r => r.explain && r.explain.length > 5), '练习句缺讲解');`,
`  check(prs.every(r => r.explain && r.explain.length > 5), '练习句缺讲解');

  // 练习题展开之后，也要过一遍和普通句子一样的内容规则
  let checkedPractice = 0;
  GB.LEVELS.forEach((lv, i) => {
    GB.practiceRounds(i).forEach((r, k) => {
      const at = \`练习 \${lv.id}-p\${k + 1}\`;
      checkedPractice++;
      const gids = (r.groups || []).map(g => g.id);
      check(r.groups && r.groups.length > 0, \`\${at}: 缺 groups\`);
      check(r.blocks.length >= 2, \`\${at}: 积木太少\`);
      r.blocks.forEach(b => {
        check(POS_SPEC[b.pos], \`\${at}: 积木 "\${b.text}" 词性不对\`);
        check(!!b.role, \`\${at}: 积木 "\${b.text}" 缺语法角色\`);
        check(gids.indexOf(b.group) >= 0, \`\${at}: 积木 "\${b.text}" 的分组不在 groups 里\`);
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
      check(ok, \`\${at}: 同一分组的积木不连续，语法树会画错\`);
      // prefill 必须能从现有积木里找到（否则玩家永远拼不出来）
      const pool = new Set(r.blocks.concat(r.distractors).map(b => b.text));
      (r.prefill || []).forEach((txt, j) => {
        check(pool.has(txt), \`\${at}: prefill[\${j}]="\${txt}" 在库里找不到\`);
      });
      check(!r.prefill || r.prefill.length === r.blocks.length,
        \`\${at}: prefill 长度和积木数对不上\`);
    });
  });
  check(checkedPractice === practiceTotal.items,
    \`展开出来的练习题数量对不上：\${checkedPractice} vs \${practiceTotal.items}\`);`);

if (!failed) fs.writeFileSync(F, t, 'utf8');
report.forEach(r => console.log('  ' + r));
console.log(failed ? '\n未写入' : '\n已更新 smoke-test.js');
process.exit(failed ? 1 : 0);
