/* Phase A (SPEC-07a 基盤: Assets抽出/Tlタイムライン/カメラパス/ページブルーム) 受け入れテスト
 * 実行: fetch('tests/phaseA.js').then(r=>r.text()).then(eval) → window.__PARESULTS
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;
  t('H-01 公開面', !!V && !!V.Tl && !!V.Assets && !!V.pageFx);
  if(!V || !V.Tl){ window.__PARESULTS = R; console.table(R); return R; }

  // ---- Assets (A-01) ----
  const A = V.Assets;
  t('A-01 API表面', ['deformRock','makeRockTex','mergeGeo','rockGeos','rockMats','buildCore','buildShip']
    .every(k => typeof A[k] === 'function'));
  const geos = A.rockGeos();
  t('A-01b 岩プール8種', Array.isArray(geos) && geos.length === 8
    && new Set(geos.map(g=>g.uuid)).size === 8);
  t('A-01c 岩マテリアル3色', A.rockMats().length === 3);
  const core = A.buildCore();
  t('A-01d buildCore構造', !!(core && core.userData.ring1 && core.userData.ring2 && core.children.length >= 3));
  const ship = A.buildShip();
  t('A-01e buildShip構造', !!(ship && ship.group && ship.parts
    && ship.parts.exhaust.length === 2 && ship.parts.tips.length === 2));

  // ---- ゲームがAssetsを使用 (A-02) ----
  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 400));
  const D = V.AsteroidRun.debug();
  t('A-02 起動', !!D.playing);
  const poolIds = new Set(A.rockGeos().map(g=>g.uuid));
  t('A-02b 岩がAssetsプール由来', D.rocks && D.rocks.distinctGeos >= 8 && poolIds.size === 8
    && D.rocksFromAssets === true, 'fromAssets='+D.rocksFromAssets);
  V.closeLayer();

  // ---- Tl (A-03/04) ----
  const Tl = V.Tl;
  let seen = [];
  Tl.register({id:'__test', t0:.2, t1:.4, update: tl=>seen.push(+tl.toFixed(3))});
  Tl._setT(.3); Tl.update(.016);
  Tl._setT(.1); Tl.update(.016);
  Tl._setT(.9); Tl.update(.016);
  t('A-04 章ローカル進行度', seen[0] === .5 && seen[1] === 0 && seen[2] === 1, JSON.stringify(seen));
  Tl._unregister('__test');

  // 決定性(A-03): 往復で同値
  const c1 = Tl.camAt(.35);
  Tl._setT(.8); Tl.update(.016);
  const c2 = Tl.camAt(.35);
  t('A-03 camAt決定性', JSON.stringify(c1) === JSON.stringify(c2), JSON.stringify(c1));

  // ---- カメラパス (A-05): 現行挙動の再現(t=0でz80, t=1でz-180) ----
  const k0 = Tl.camAt(0), k1 = Tl.camAt(1), km = Tl.camAt(.5);
  t('A-05 キーフレーム端点', Math.abs(k0.z - 80) < .001 && Math.abs(k1.z - (-180)) < .001,
    `z0=${k0.z} z1=${k1.z}`);
  t('A-05b 中間補間', km.z < k0.z && km.z > k1.z, 'zm='+km.z);

  // ---- ページブルーム (A-06) ----
  const pf = V.pageFx;
  const names = pf.composer.passes.map(p=>p.constructor.name);
  if(V.isTouch === true || matchMedia('(hover:none)').matches){
    t('A-06 SPは素通し', !names.includes('UnrealBloomPass'), names.join('→'));
  }else{
    t('A-06 PCブルーム', names.includes('UnrealBloomPass') && names[0] === 'RenderPass', names.join('→'));
  }

  // ---- 性能 ----
  const t0 = performance.now();
  for(let i = 0; i < 60; i++) pf.composer.render();
  const per = (performance.now() - t0)/60;
  t('PERF ページ合成', per < 12, per.toFixed(1)+'ms/frame');

  // ---- 回帰(ゲーム) ----
  if(window.__SKIP_NESTED_REG){
    t('REG phase1〜4', true, 'skipped (上位スイートで実施)');
    window.__PARESULTS = R;
    console.info(`[PhaseA] ${R.length-R.filter(x=>!x.pass).length}/${R.length} pass (nested-reg skipped)`);
    console.table(R);
    return R;
  }
  for(const n of [1,2,3,4]){
    const src = await fetch(`/void-gate/tests/phase${n}.js?a=1`).then(r=>r.text());
    await eval(src);
    await new Promise(r=>setTimeout(r, 250));
  }
  const regs = [window.__P1RESULTS, window.__P2RESULTS, window.__P3RESULTS, window.__P4RESULTS];
  t('REG phase1〜4', regs.every(x=>x && x.every(y=>y.pass)),
    regs.map((x,i)=>`p${i+1}:${x?x.filter(y=>!y.pass).length:'?'}ng`).join(' '));

  window.__PARESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[PhaseA] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
