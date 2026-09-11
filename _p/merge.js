/* 把练习片段文件合并进 index.html 的 practice 对象
   用法：node _p/merge.js _p/practice-2.json [_p/practice-3.json ...] */
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'index.html');
let t = fs.readFileSync(HTML, 'utf8');

const files = process.argv.slice(2);
if (!files.length) { console.log('  没给片段文件'); process.exit(1); }

function indent(str, n) {
  const pad = ' '.repeat(n);
  return str.split('\n').map((l, i) => (i === 0 ? l : pad + l)).join('\n');
}

const chunks = [];
let totalItems = 0, totalLevels = 0;
files.forEach(function (f) {
  const p = path.join(__dirname, path.basename(f));
  if (!fs.existsSync(p)) { console.log('  ✗ 找不到 ' + f); process.exit(1); }
  let frag;
  try { frag = JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.log(`  ✗ ${f} JSON 非法：${e.message}`); process.exit(1); }
  const keys = Object.keys(frag);
  keys.forEach(function (k) {
    // 已经存在的关卡要挡掉，免得静默覆盖
    if (t.indexOf('"' + k + '": {') >= 0) {
      console.log(`  ✗ ${k} 已经存在，不覆盖`);
      process.exit(1);
    }
    chunks.push('  ' + JSON.stringify(k) + ': ' + indent(JSON.stringify(frag[k], null, 2), 2));
    totalItems += frag[k].items.length;
    totalLevels++;
  });
  console.log(`  ✓ ${path.basename(f)}：${keys.length} 关 / ${keys.reduce((s, k) => s + frag[k].items.length, 0)} 句`);
});

// practice 对象的收尾：最后一个关卡的 `}` + practice 自己的 `}`
const anchor = '\n    ]\n  }\n}';
const at = t.lastIndexOf(anchor);
if (at < 0) { console.log('  ✗ 找不到 practice 对象的结尾'); process.exit(1); }
t = t.slice(0, at) + '\n    ]\n  },\n' + chunks.join(',\n') + '\n}' + t.slice(at + anchor.length);

let jsonOk = '';
try {
  const jm = t.match(/<script id="levelData" type="application\/json">([\s\S]*?)<\/script>/);
  const p = JSON.parse(jm[1]);
  const ids = Object.keys(p.practice);
  jsonOk = '✓ JSON 合法：练习覆盖 ' + ids.length + ' 关，共 ' +
    ids.reduce((s, k) => s + p.practice[k].items.length, 0) + ' 句';
} catch (e) { jsonOk = '✗ JSON 解析失败：' + e.message; process.exit(1); }

const scripts = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)];
try { new Function(scripts[scripts.length - 1][1]); } catch (e) { console.log('  ✗ 主脚本语法错误：' + e.message); process.exit(1); }

fs.writeFileSync(HTML, t, 'utf8');
console.log('  ✓ 合并 ' + totalLevels + ' 关 / ' + totalItems + ' 句');
console.log('  ' + jsonOk);
