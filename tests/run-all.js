/* 全スイート一括実行(SPEC-07d D-06)
 * 実行: fetch('tests/run-all.js').then(r=>r.text()).then(eval) → window.__ALLRESULTS
 * ゲームphase1〜4 → ガイドphaseA〜D の順。入れ子回帰はスキップ(重複排除)
 */
(async ()=>{
  window.__SKIP_NESTED_REG = true;
  const suites = ['1','2','3','4','A','B','C','D','E1'];
  const out = {};
  for(const n of suites){
    const src = await fetch(`/void-gate/tests/phase${n}.js?all=${Date.now()}`).then(r=>r.text());
    await eval(src);
    await new Promise(r=>setTimeout(r, 250));
    const key = '__P' + n + 'RESULTS';
    out['phase' + n] = window[key] || null;
  }
  delete window.__SKIP_NESTED_REG;
  const flat = Object.entries(out).map(([k, v])=>({suite:k,
    total: v ? v.length : 0, ng: v ? v.filter(x=>!x.pass).length : -1,
    fails: v ? v.filter(x=>!x.pass).map(x=>x.id) : ['NO RESULT']}));
  window.__ALLRESULTS = flat;
  const totalNg = flat.reduce((a, s)=>a + Math.max(0, s.ng), 0);
  console.info(`[run-all] ${flat.reduce((a,s)=>a+s.total,0)} tests, ${totalNg} failures`, totalNg ? flat : 'ALL GREEN');
  console.table(flat);
  return flat;
})();
