/* 修 1-8 里 5 句「The X is Y but Z」（6 词）套了 5 槽骨架的问题 */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, '..', 'index.html');
let t = fs.readFileSync(F, 'utf8');
const report = [];
let failed = false;

function sub(name, from, to) {
  const n = t.split(from).length - 1;
  if (n !== 1) { report.push(`✗ ${name}：锚点 ${n} 次`); failed = true; return; }
  t = t.replace(from, to);
  report.push('✓ ' + name);
}

/* 1. 补一个 6 槽的「The X is Y but Z」骨架 */
sub('补 6 槽骨架',
`[["pronoun", "主语", "s1"], ["verb", "谓语", "s1"], ["adj", "表语", "s1"], ["conj", "连词", "s2"], ["pronoun", "主语", "s2"], ["verb", "谓语", "s2"]]
    ],`,
`[["pronoun", "主语", "s1"], ["verb", "谓语", "s1"], ["adj", "表语", "s1"], ["conj", "连词", "s2"], ["pronoun", "主语", "s2"], ["verb", "谓语", "s2"]],
      [["article", "限定词", "np1"], ["noun", "主语", "np1"], ["verb", "谓语", "vp"], ["adj", "表语", "np2"], ["conj", "连词", "np2"], ["adj", "表语", "np2"]]
    ],`);

/* 2. 五句改用新骨架 */
['["The", "room", "is", "small", "but", "clean"]',
 '["The", "task", "is", "hard", "but", "useful"]',
 '["The", "book", "is", "old", "but", "interesting"]',
 '["The", "road", "is", "narrow", "but", "safe"]',
 '["The", "soup", "is", "hot", "but", "tasty"]'].forEach(function (w, i) {
  const from = `{ "w": ${w}, "d": { "and": 4 }, "p": 1, "r": 1 }`;
  const to = `{ "w": ${w}, "d": { "and": 4 }, "p": 4, "r": 1 }`;
  sub('改骨架 ' + (i + 1), from, to);
});

let jsonOk = '';
try {
  const jm = t.match(/<script id="levelData" type="application\/json">([\s\S]*?)<\/script>/);
  const p = JSON.parse(jm[1]);
  jsonOk = '✓ JSON 合法，练习共 ' +
    Object.keys(p.practice).reduce((s, k) => s + p.practice[k].items.length, 0) + ' 句';
} catch (e) { jsonOk = '✗ JSON 解析失败：' + e.message; failed = true; }

if (!failed) fs.writeFileSync(F, t, 'utf8');
report.forEach(r => console.log('  ' + r));
console.log('  ' + jsonOk);
process.exit(failed ? 1 : 0);
