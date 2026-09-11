/* 练习题格式再加一项：o（显式预填顺序），用来出「顺序错」的改错题 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const report = [];
let failed = false;

/* 1. 展开器 */
{
  const F = path.join(root, 'index.html');
  let t = fs.readFileSync(F, 'utf8');
  const from = `      // 有中文就当「照中文拼句子」，没中文就当改错题（用错误形式预填）
      if (!it.c && firstWrong) {`;
  const to = `      // 预填：o 是显式的错误顺序（用来出「顺序错」的题）；
      // 否则有中文就照中文拼句子，没中文就用错误形式预填成改错题
      if (it.o) {
        round.prefill = it.o.slice();
        round.tip = '改错练习：把它调回正确的顺序';
      } else if (!it.c && firstWrong) {`;
  if (t.split(from).length - 1 !== 1) { report.push('✗ 展开器锚点'); failed = true; }
  else {
    t = t.replace(from, to);
    const scripts = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    try { new Function(scripts[scripts.length - 1][1]); fs.writeFileSync(F, t, 'utf8'); report.push('✓ 展开器支持 o'); }
    catch (e) { report.push('✗ 主脚本语法错误：' + e.message); failed = true; }
  }
}

/* 2. 自检：有 o 的题不强制要 d */
{
  const F = path.join(root, 'smoke-test.js');
  let t = fs.readFileSync(F, 'utf8');
  const from = `    if (!it.c) {
      check(dws.length > 0, \`\${one}: 既没有中文意思、又没有干扰项 —— 改错题会没有提示\`);
    }`;
  const to = `    if (it.o !== undefined) {
      check(Array.isArray(it.o) && it.o.length === it.w.length,
        \`\${one}: o（预填顺序）的长度要和句子一致\`);
      (it.o || []).forEach((txt, j) => {
        check(it.w.indexOf(txt) >= 0 || dws.indexOf(txt) >= 0,
          \`\${one}: o[\${j}]="\${txt}" 在积木和干扰项里都找不到\`);
      });
    }
    if (!it.c && it.o === undefined) {
      check(dws.length > 0, \`\${one}: 既没有中文意思、又没有干扰项 —— 改错题会没有提示\`);
    }`;
  if (t.split(from).length - 1 !== 1) { report.push('✗ 自检锚点'); failed = true; }
  else { fs.writeFileSync(F, t.replace(from, to), 'utf8'); report.push('✓ 自检允许 o'); }
}

/* 3. 规范文件补充说明 */
{
  const F = path.join(root, '_p', 'spec.md');
  let t = fs.readFileSync(F, 'utf8');
  const anchor = '```\n\n然后把文件路径告诉我';
  const add = `\n| \`items[].o\` | 可选，**显式的错误顺序**（一个和 \`w\` 等长的数组）。用来出「顺序错」的题：比如双宾语的 \`["She","gives","a","pen","me"]\`、倒装的 \`["Never","I","have","seen"]\`。写了 o 就不用写 d |\n`;
  const marker = '\n然后把文件路径告诉我';
  if (t.includes(marker)) {
    const idx = t.lastIndexOf('## 自检');
    t = t.slice(0, idx) + `### 顺序错的题（\`o\`）\n\n有些错不是「词用错了」而是「顺序错了」，这时用 \`o\` 写显式的错误顺序：\n\n\`\`\`json\n{ "w": ["She", "gives", "me", "a", "pen"], "o": ["She", "gives", "a", "pen", "me"], "r": 0 }\n\`\`\`\n\n\`o\` 必须和 \`w\` 等长，用到的词都得能在积木或干扰项里找到。\n\n` + t.slice(idx);
    fs.writeFileSync(F, t, 'utf8');
    report.push('✓ 规范补充 o');
  } else { report.push('✗ 规范锚点'); failed = true; }
}

report.forEach(r => console.log('  ' + r));
process.exit(failed ? 1 : 0);
