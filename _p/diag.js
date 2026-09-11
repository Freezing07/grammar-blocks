/* 诊断：按 rebuild.js 的方式拼出 JSON，找出语法错误在哪 */
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'index.html');
const t = fs.readFileSync(HTML, 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(__dirname, 'practice-all.json'), 'utf8'));

console.log('关卡数：' + Object.keys(P).length);
const byChapter = {};
Object.keys(P).forEach(function (k) {
  const ch = k.split('-')[0];
  byChapter[ch] = (byChapter[ch] || 0) + 1;
});
console.log('按章：' + JSON.stringify(byChapter));

const keys = Object.keys(P);
keys.forEach(function (k) {
  const lv = P[k];
  const hasP = Array.isArray(lv.paragraphs);
  const hasI = Array.isArray(lv.items);
  if (!hasP && !hasI) console.log('  !! ' + k + ' 既没有 items 也没有 paragraphs');
  if (hasP && hasI) console.log('  !! ' + k + ' 两种形状都有');
});

function fmt(p) {
  const ks = Object.keys(p);
  const lines = ['"practice": {'];
  ks.forEach(function (k, i) {
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
    lines.push('    }' + (i < ks.length - 1 ? ',' : ''));
  });
  lines.push('  }');
  return lines.join('\n');
}

const s = t.indexOf('"practice": {');
const e = t.lastIndexOf('\n}\n</script>');
console.log('practice 起点 ' + s + '，结尾 ' + e);
const out = t.slice(0, s) + fmt(P) + t.slice(e);

const jm = out.match(/<script id="levelData" type="application\/json">([\s\S]*?)<\/script>/);
if (!jm) { console.log('找不到 JSON 块'); process.exit(0); }
try {
  JSON.parse(jm[1]);
  console.log('✓ 拼出来的 JSON 合法');
} catch (err) {
  console.log('✗ ' + err.message);
  const m = /position (\d+)/.exec(err.message);
  if (m) {
    const pos = Number(m[1]);
    console.log('错误位置附近：');
    console.log(JSON.stringify(jm[1].slice(Math.max(0, pos - 200), pos + 80)));
  }
}
