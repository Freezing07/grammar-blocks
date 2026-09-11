/* 第七章练习：段落排序题型
   紧凑格式：一段写一次句子数组 + 角色 + 衔接关系 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const report = [];
let failed = false;

/* ---------- 1. 展开器 ---------- */
{
  const F = path.join(root, 'index.html');
  let t = fs.readFileSync(F, 'utf8');
  const from = `  function expandPractice(lv) {
    var p = (DATA.practice || {})[lv.id];
    if (!p || !p.patterns || !p.items) return [];`;
  const to = `  function expandPractice(lv) {
    var p = (DATA.practice || {})[lv.id];
    if (!p) return [];
    // 段落排序的练习：给一串打乱的句子，排出通顺的一段
    if (p.paragraphs) {
      return p.paragraphs.map(function (it, k) {
        return {
          id: lv.id + '-p' + (k + 1),
          practice: true,
          mode: 'order',
          rootLabel: '句群',
          cn: it.cn || '把这几句话排成一段通顺的话',
          tip: '练习：把句子排成通顺的一段',
          blocks: it.s.map(function (text, i) {
            return { text: text, role: (it.roles && it.roles[i]) || '' };
          }),
          distractors: (it.d || []).map(function (text) {
            return { text: text, role: '多余的一句' };
          }),
          links: it.links || [],
          explain: (p.rules && p.rules[it.r || 0]) || '看看段落是怎么串起来的。',
          example: '正确顺序：' + it.s.join(' '),
          win: '这一段你顺下来了。'
        };
      });
    }
    if (!p.patterns || !p.items) return [];`;
  if (t.split(from).length - 1 !== 1) { report.push('✗ 展开器锚点'); failed = true; }
  else {
    t = t.replace(from, to);
    const scripts = [...t.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    try { new Function(scripts[scripts.length - 1][1]); fs.writeFileSync(F, t, 'utf8'); report.push('✓ 展开器支持段落排序练习'); }
    catch (e) { report.push('✗ 主脚本语法错误：' + e.message); failed = true; }
  }
}

/* ---------- 2. 自检：段落排序练习的校验 ---------- */
{
  const F = path.join(root, 'smoke-test.js');
  let t = fs.readFileSync(F, 'utf8');
  const from = `  check(Array.isArray(p.patterns) && p.patterns.length > 0, \`\${at}: 缺少 patterns（句型骨架）\`);`;
  const to = `  // 段落排序的练习是另一种形状：一段一段给句子
  if (p.paragraphs) {
    check(Array.isArray(p.rules) && p.rules.length > 0, \`\${at}: 缺少 rules\`);
    check(p.paragraphs.length >= 5,
      \`\${at}: 只有 \${p.paragraphs.length} 段练习，太少（目标 8 段）\`);
    p.paragraphs.forEach((it, k) => {
      const one = \`\${at} 第 \${k + 1} 段\`;
      check(Array.isArray(it.s) && it.s.length >= 3, \`\${one}: 句子少于 3 句\`);
      (it.s || []).forEach(x => check(typeof x === 'string' && x.length > 8, \`\${one}: 有句子写得不完整\`));
      check(Array.isArray(it.links) && it.links.length === (it.s || []).length - 1,
        \`\${one}: links 应该有 \${(it.s || []).length - 1} 个，实际 \${(it.links || []).length}\`);
      if (it.roles) check(it.roles.length === it.s.length, \`\${one}: roles 数量对不上\`);
      if (it.r !== undefined) check(!!(p.rules || [])[it.r], \`\${one}: 引用了不存在的规则 \${it.r}\`);
      (it.d || []).forEach(x => check((it.s || []).indexOf(x) < 0, \`\${one}: 多余的那句和正解重了\`));
    });
    practiceTotal.levels++;
    practiceTotal.orderItems = (practiceTotal.orderItems || 0) + p.paragraphs.length;
    return;
  }
  check(Array.isArray(p.patterns) && p.patterns.length > 0, \`\${at}: 缺少 patterns（句型骨架）\`);`;
  if (t.split(from).length - 1 !== 1) { report.push('✗ 自检锚点'); failed = true; }
  else { fs.writeFileSync(F, t.replace(from, to), 'utf8'); report.push('✓ 自检支持段落排序练习'); }
}

/* ---------- 3. 自检：展开后校验要跳过段落排序 ---------- */
{
  const F = path.join(root, 'smoke-test.js');
  let t = fs.readFileSync(F, 'utf8');
  const from = `      const gids = (r.groups || []).map(g => g.id);
      check(r.groups && r.groups.length > 0, \`\${at}: 缺 groups\`);`;
  const to = `      if (r.mode === 'order') {
        // 段落排序：没有词性、没有语法树，只检查句子和衔接关系
        check(r.blocks.length >= 3, \`\${at}: 句子太少\`);
        check(r.blocks.every(b => b.text && b.role), \`\${at}: 有句子缺文字或角色\`);
        check(Array.isArray(r.links) && r.links.length === r.blocks.length - 1,
          \`\${at}: links 数量应该是 \${r.blocks.length - 1}\`);
        return;
      }
      const gids = (r.groups || []).map(g => g.id);
      check(r.groups && r.groups.length > 0, \`\${at}: 缺 groups\`);`;
  if (t.split(from).length - 1 !== 1) { report.push('✗ 展开校验锚点'); failed = true; }
  else { fs.writeFileSync(F, t.replace(from, to), 'utf8'); report.push('✓ 展开校验跳过段落排序'); }
}

/* ---------- 4. 报告口径 ---------- */
{
  const F = path.join(root, 'smoke-test.js');
  let t = fs.readFileSync(F, 'utf8');
  const from = `  check(checkedPractice === practiceTotal.items,`;
  const to = `  check(checkedPractice === practiceTotal.items + (practiceTotal.orderItems || 0),`;
  if (t.split(from).length - 1 !== 1) { report.push('✗ 报告锚点'); failed = true; }
  else { fs.writeFileSync(F, t.replace(from, to), 'utf8'); report.push('✓ 报告口径'); }
}

report.forEach(r => console.log('  ' + r));
process.exit(failed ? 1 : 0);
