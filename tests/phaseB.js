/* Phase B (ガイド汎用メカニクス — 章アクションの詳細はphaseE2へ移管/SPEC-08b) */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, G = V && V.Guide, Tl = V && V.Tl;
  t('H-01 Guide公開', !!G && !!Tl && typeof G.info === 'function' && typeof G.stage === 'function');
  if(!G){ window.__PBRESULTS = R; console.table(R); return R; }

  const info = G.info();
  t('B-01 訓練章登録', ['flight','weapons','survival'].every(id=>info.find(c=>c.id === id)),
    info.map(c=>c.id).join(','));
  t('B-01b t範囲が昇順', info.every((c,i)=>c.t1 > c.t0 && (i === 0 || c.t0 >= info[i-1].t0)),
    info.map(c=>`${c.id}:${c.t0.toFixed(2)}-${c.t1.toFixed(2)}`).join(' '));
  const ch = id => info.find(c=>c.id === id);
  const go = (c, k) => { Tl._setT(c.t0 + (c.t1 - c.t0)*k); Tl.update(.016); };

  // テキスト行メカニクス
  const f = ch('flight');
  go(f, .65);
  t('T-01 行点灯(凍結中)', document.querySelectorAll('#ch-flight .ch-line.lit').length >= 3);
  go(f, .05);
  t('T-02 進行度未達は消灯', document.querySelectorAll('#ch-flight .ch-line.lit').length === 0);
  const bodyTxt = document.querySelector('#ch-weapons').textContent;
  t('T-03 操作語の出し分け', V.isTouch ? bodyTxt.includes('FIREボタン') : bodyTxt.includes('左クリック'));

  // 性能
  Tl._setT(.5); Tl.update(.016);
  const t0 = performance.now();
  for(let i = 0; i < 60; i++){ Tl.update(.016); V.pageFx.composer.render(); }
  const per = (performance.now() - t0)/60;
  t('PERF 章駆動込み合成', per < 12, per.toFixed(1)+'ms/frame');

  Tl._setT(0); Tl.update(.016);
  if(window.__SKIP_NESTED_REG){
    t('REG phase1〜4', true, 'skipped (上位スイートで実施)');
  }else{
    for(const n of [1,2,3,4]){
      const src = await fetch(`/void-gate/tests/phase${n}.js?b=1`).then(r=>r.text());
      await eval(src);
      await new Promise(r=>setTimeout(r, 250));
    }
    const regs = [window.__P1RESULTS, window.__P2RESULTS, window.__P3RESULTS, window.__P4RESULTS];
    t('REG phase1〜4', regs.every(x=>x && x.every(y=>y.pass)),
      regs.map((x,i)=>`p${i+1}:${x?x.filter(y=>!y.pass).length:'?'}ng`).join(' '));
  }
  window.__PBRESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[PhaseB] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
