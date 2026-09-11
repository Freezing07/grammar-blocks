/* rebuild.js 的输出格式要支持段落排序练习 */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, 'rebuild.js');
let t = fs.readFileSync(F, 'utf8');

const from = `    lines.push('      "rules": ' + JSON.stringify(lv.rules) + ',');
    lines.push('      "items": [');
    lv.items.forEach(function (it, j) {
      lines.push('        ' + JSON.stringify(it) + (j < lv.items.length - 1 ? ',' : ''));
    });
    lines.push('      ]');`;

const to = `    if (lv.paragraphs) {
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
    }`;

if (t.split(from).length - 1 !== 1) { console.log('  ✗ 锚点不唯一'); process.exit(1); }
t = t.replace(from, to);
// 上面已经把 groups/patterns 挪进 else 分支，把原来重复的两行删掉
t = t.replace(`    lines.push('      "groups": ' + JSON.stringify(lv.groups) + ',');
    lines.push('      "patterns": ' + JSON.stringify(lv.patterns) + ',');
    if (lv.paragraphs) {`, `    if (lv.paragraphs) {`);
fs.writeFileSync(F, t, 'utf8');
console.log('  ✓ rebuild.js 输出支持段落排序');
