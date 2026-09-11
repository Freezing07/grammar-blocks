/* 练习题格式扩展：支持 m（行内标点），这样第六章的衔接词题能写成两句 */
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

sub('展开器支持 marks',
`      if (p.punct) round.punct = p.punct;`,
`      if (it.m) round.marks = it.m;
      if (p.punct) round.punct = p.punct;`);

const scripts = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)];
try { new Function(scripts[scripts.length - 1][1]); report.push('✓ 主脚本语法正常'); }
catch (e) { report.push('✗ 主脚本语法错误：' + e.message); failed = true; }

if (!failed) fs.writeFileSync(F, t, 'utf8');
report.forEach(r => console.log('  ' + r));
process.exit(failed ? 1 : 0);
