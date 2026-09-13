/* 把 51 关的写作提示词一次性生成出来，供人工过一遍。
   用法：node _p/gen-prompts.js
   输出：_p/prompts-review.md（带目录和逐关全文）+ _p/prompts-all.json（给后续接 UI 用） */
const fs = require('fs');
const path = require('path');
const buildWritingPrompt = require('./prompt.js').buildWritingPrompt;

const ROOT = path.join(__dirname, '..');
const P = JSON.parse(fs.readFileSync(path.join(__dirname, 'practice-all.json'), 'utf8'));

// 按章号、关号自然排序（1-1, 1-2, … 1-10, 2-1 …）
const ids = Object.keys(P).sort(function (a, b) {
  const A = a.split('-').map(Number), B = b.split('-').map(Number);
  return A[0] - B[0] || A[1] - B[1];
});

const data = {};
const table = [];

ids.forEach(function (id) {
  if (id.indexOf('7-') === 0) return;              // 第七章（段落排序）不做
  const mode = id.split('-')[0] === '6' ? 'pair' : 'sentence';
  const lv = JSON.parse(fs.readFileSync(path.join(ROOT, 'levels', id + '.json'), 'utf8'));
  const rules = P[id].rules || [];
  const text = buildWritingPrompt(id, lv.topic, lv.goal || '', rules, mode, lv.boss === true);

  data[id] = { topic: lv.topic, mode: mode, boss: lv.boss === true, text: text };
  table.push('| ' + id + ' | ' + lv.topic + ' | ' + (mode === 'pair' ? '两句' : '单句') +
    ' | ' + (lv.boss ? 'Boss' : '—') +
    ' | ' + rules.length + ' | ' + text.length + ' |');
});

const md = [];
md.push('# 写作提示词 — 51 关全文（供过目）');
md.push('');
md.push('> 由 `_p/prompt.js` 按「关卡名 + goal + rules」自动生成，还没有接进界面。');
md.push('> 第 1~5 章是**单句翻译**；第 6 章语法点跨句，改成**两句翻译**；第 7 章（段落排序）不做。');
md.push('');
md.push('## 目录');
md.push('');
md.push('| 关 | 主题 | 形态 | Boss | 规则条数 | 提示词字数 |');
md.push('|---|---|---|---|---|---|');
table.forEach(function (r) { md.push(r); });
md.push('');
md.push('---');
md.push('');

Object.keys(data).forEach(function (id) {
  const d = data[id];
  md.push('## ' + id + '　' + d.topic + '　（' + (d.mode === 'pair' ? '两句' : '单句') + '）');
  md.push('');
  md.push('```text');
  md.push(d.text);
  md.push('```');
  md.push('');
});

fs.writeFileSync(path.join(__dirname, 'prompts-review.md'), md.join('\n'));
fs.writeFileSync(path.join(__dirname, 'prompts-all.json'), JSON.stringify(data, null, 1));

const n = Object.keys(data).length;
console.log('  关卡数 ' + n + '（两句形态 ' + Object.keys(data).filter(function (k) {
  return data[k].mode === 'pair';
}).length + ' 关）');
console.log('  提示词总字数 ' + Object.keys(data).reduce(function (s, k) {
  return s + data[k].text.length;
}, 0));
console.log('  ✓ _p/prompts-review.md');
console.log('  ✓ _p/prompts-all.json');
