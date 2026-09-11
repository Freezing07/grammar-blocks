/* 修第二章练习里的骨架问题 */
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

/* --- 2-3：补一个没有冠词的 3 槽骨架 --- */
sub('2-3 补骨架',
`        [["article", "限定词", "np1"], ["noun", "主语", "np1"], ["verb", "谓语", "vp"], ["adj", "表语", "np2"]]
      ],`,
`        [["article", "限定词", "np1"], ["noun", "主语", "np1"], ["verb", "谓语", "vp"], ["adj", "表语", "np2"]],
        [["pronoun", "主语", "np1"], ["verb", "谓语", "vp"], ["noun", "表语", "np2"]]
      ],`);

['{ "w": ["They", "are", "students"], "d": { "student": 2 }, "p": 1, "r": 2 }',
 '{ "w": ["We", "are", "friends"], "d": { "friend": 2 }, "p": 1, "r": 2 }',
 '{ "w": ["They", "are", "doctors"], "d": { "doctor": 2 }, "p": 1, "r": 2 }'
].forEach(function (line, i) {
  sub('2-3 改骨架 ' + (i + 1), line, line.replace('"p": 1', '"p": 3'));
});

/* --- 2-6：表语错标成了主语组 np1，应该是 np2 --- */
sub('2-6 p2 分组',
`        [["pronoun", "限定词", "np1"], ["noun", "主语", "np1"], ["verb", "谓语", "vp"], ["adj", "表语", "np1"]],`,
`        [["pronoun", "限定词", "np1"], ["noun", "主语", "np1"], ["verb", "谓语", "vp"], ["adj", "表语", "np2"]],`);
sub('2-6 p3 分组',
`        [["article", "限定词", "np1"], ["noun", "主语", "np1"], ["verb", "谓语", "vp"], ["adj", "表语", "np1"]]`,
`        [["article", "限定词", "np1"], ["noun", "主语", "np1"], ["verb", "谓语", "vp"], ["adj", "表语", "np2"]]`);
sub('2-6 np2 标签',
`        { "id": "ex", "label": "引导词" },
        { "id": "vp", "label": "谓语 VP" },
        { "id": "np1", "label": "真正的主语 NP" },
        { "id": "pp", "label": "地点 PP" },
        { "id": "np2", "label": "宾语 NP" }`,
`        { "id": "ex", "label": "引导词" },
        { "id": "vp", "label": "谓语 VP" },
        { "id": "np1", "label": "真正的主语 NP" },
        { "id": "pp", "label": "地点 PP" },
        { "id": "np2", "label": "宾语 / 表语 NP" }`);

/* --- 2-7：补一个 3 槽的 be 动词疑问句骨架 --- */
sub('2-7 补骨架',
`        [["adv", "疑问词", "q"], ["verb", "助动词", "vp"], ["pronoun", "主语", "np1"], ["verb", "谓语", "vp2"]]
      ],`,
`        [["adv", "疑问词", "q"], ["verb", "助动词", "vp"], ["pronoun", "主语", "np1"], ["verb", "谓语", "vp2"]],
        [["verb", "谓语", "vp"], ["pronoun", "主语", "np1"], ["adj", "表语", "np2"]]
      ],`);
sub('2-7 np2 标签',
`      { "id": "vp2", "label": "谓语 VP" },
      { "id": "np2", "label": "宾语 NP" },
      { "id": "q", "label": "疑问词" }`,
`      { "id": "vp2", "label": "谓语 VP" },
      { "id": "np2", "label": "宾语 / 表语 NP" },
      { "id": "q", "label": "疑问词" }`);

['{ "w": ["Are", "we", "late"], "d": { "Do": 0 }, "p": 2, "r": 2 }',
 '{ "w": ["Are", "you", "busy"], "d": { "Do": 0 }, "p": 2, "r": 2 }'
].forEach(function (line, i) {
  sub('2-7 改骨架 ' + (i + 1), line, line.replace('"p": 2', '"p": 4'));
});

let jsonOk = '';
try {
  const jm = t.match(/<script id="levelData" type="application\/json">([\s\S]*?)<\/script>/);
  const p = JSON.parse(jm[1]);
  jsonOk = '✓ JSON 合法：练习覆盖 ' + Object.keys(p.practice).length + ' 关';
} catch (e) { jsonOk = '✗ JSON 解析失败：' + e.message; failed = true; }

if (!failed) fs.writeFileSync(F, t, 'utf8');
report.forEach(r => console.log('  ' + r));
console.log('  ' + jsonOk);
process.exit(failed ? 1 : 0);
