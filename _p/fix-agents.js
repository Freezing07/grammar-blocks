/* 修代理交付内容里被自检抓到的 9 处问题 */
const fs = require('fs');
const path = require('path');
const F = path.join(__dirname, 'practice-all.json');
const P = JSON.parse(fs.readFileSync(F, 'utf8'));
const report = [];

/* 1) 3-8 的疑问句骨架：vq 被 np1 隔开，分组不连续
     把句首那个助动词单独成组，序列变成 vqpre / np1 / vq / vq / pp / pp */
(function () {
  const lv = P['3-8'];
  if (!lv.groups.some(g => g.id === 'vqpre')) {
    lv.groups.push({ id: 'vqpre', label: '助动词（提到句首）' });
  }
  let n = 0;
  lv.patterns.forEach(function (pat) {
    // 找出「vq 出现两次且被 np1 隔开」的骨架
    const groups = pat.map(s => s[2]);
    const firstVq = groups.indexOf('vq');
    if (firstVq === 0 && groups.indexOf('np1') > 0 && groups.lastIndexOf('vq') > groups.indexOf('np1')) {
      pat[0][2] = 'vqpre';
      n++;
    }
  });
  report.push('3-8 修骨架 ' + n + ' 条');
})();

/* 2) 5-3 第 27/28 句：套错了骨架（4 词句子套了 4 槽但形状不对），
     而且 d 的下标 4 越界。补一条正确的 4 槽骨架。 */
(function () {
  const lv = P['5-3'];
  const want = [['pronoun', '主语', 'main'], ['verb', '谓语', 'main'], ['adv', '状语', 'main'], ['verb', '现在分词', 'part']];
  let idx = lv.patterns.findIndex(p => JSON.stringify(p) === JSON.stringify(want));
  if (idx < 0) { lv.patterns.push(want); idx = lv.patterns.length - 1; }
  let n = 0;
  lv.items.forEach(function (it) {
    if (it.w.length !== 4) return;
    const pat = lv.patterns[it.p || 0];
    if (pat && JSON.stringify(pat) === JSON.stringify(want)) return;
    if (JSON.stringify(it.w) === JSON.stringify(['She', 'stood', 'there', 'crying']) ||
        JSON.stringify(it.w) === JSON.stringify(['They', 'stood', 'there', 'waiting'])) {
      it.p = idx;
      Object.keys(it.d).forEach(function (k) { it.d[k] = 3; });
      n++;
    }
  });
  report.push('5-3 修句子 ' + n + ' 句');
})();

/* 3) 4-3 第 18 句：干扰词 is 和正解里的 is 重名。
     换成这句真正该考的错法（The reason is that，不是 because） */
(function () {
  const it = P['4-3'].items[17];
  if (JSON.stringify(it.w) === JSON.stringify(['The', 'problem', 'is', 'that', 'we', 'are', 'late'])) {
    it.d = { 'because': 3 };
    it.r = 0;
    report.push('4-3 第18句改干扰项');
  } else {
    report.push('✗ 4-3 第18句对不上：' + JSON.stringify(it.w));
  }
})();

fs.writeFileSync(F, JSON.stringify(P, null, 2) + '\n', 'utf8');
report.forEach(r => console.log('  ' + r));
