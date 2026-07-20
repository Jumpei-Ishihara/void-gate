/* Phase 2 (SPEC-03 小惑星 / SPEC-04 戦闘エフェクト) 受け入れテスト
 * 実行: ゲームページで fetch('tests/phase2.js').then(r=>r.text()).then(eval)
 * 非表示タブでも動くよう、時間進行は debug().fx.step(dt) の手動ステップで行う
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;
  t('H-01 VG公開', !!V);
  if(!V){ window.__P2RESULTS = R; console.table(R); return R; }

  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 400));
  let D = V.AsteroidRun.debug();
  t('H-02 起動', !!D.playing);

  // ---- SPEC-03 小惑星 ----
  const rk = D.rocks;
  t('AST-01 ジオメトリ8種プール', rk && rk.distinctGeos >= 8, 'distinct='+(rk&&rk.distinctGeos));
  t('AST-01b 頂点変位(個体差)', rk && rk.radiusSpread > .15, 'spread='+(rk&&rk.radiusSpread));
  t('AST-03 テクスチャ適用', rk && rk.hasMap && rk.hasBump);
  t('AST-04 色3系統', rk && rk.distinctColors >= 3, 'colors='+(rk&&rk.distinctColors));
  t('AST-05 自転パラメータ', rk && rk.spinOk);
  t('AST-06 当たり半径維持', rk && rk.rOk);
  t('AST-07 respawnで再生成なし', rk && rk.respawnStable);

  // ---- SPEC-04 エフェクト ----
  const fx = D.fx;
  t('FX-08 プール構成', !!fx, fx ? JSON.stringify(fx.stats().pool) : 'fxなし');
  if(fx){
    const pool = fx.stats().pool;
    t('FX-08b プールサイズ', pool.rings === 4 && pool.flashes === 4 && pool.tracers === 2
      && pool.muzzles === 2 && pool.shards >= fx.shardsPerBoom*2, JSON.stringify(pool));

    fx.spawnTest();
    const a1 = fx.stats().active;
    t('FX-01 三層爆発起動', a1.rings >= 1 && a1.flashes >= 1 && a1.shards >= fx.shardsPerBoom,
      JSON.stringify(a1));
    D = V.AsteroidRun.debug();
    t('FX-07 ブルーム一時ブースト', D.bloom.strength > .86, 'strength='+D.bloom.strength.toFixed(2));

    fx.step(2);
    const a2 = fx.stats().active;
    t('FX-08c プール回収', a2.rings === 0 && a2.shards === 0 && a2.sparks === 0, JSON.stringify(a2));
    t('FX-07b ブースト解除', Math.abs(V.AsteroidRun.debug().bloom.strength - .85) < .01,
      V.AsteroidRun.debug().bloom.strength.toFixed(2));

    V.AsteroidRun.fire();
    const a3 = fx.stats().active;
    t('FX-03/04 マズル+太いトレーサー', a3.muzzles >= 1 && a3.tracers >= 1, JSON.stringify(a3));
    fx.step(1);

    // 同時爆発上限(4)
    for(let i = 0; i < 6; i++) fx.spawnTest();
    t('FX-09 同時上限4', fx.stats().active.rings <= 4, 'rings='+fx.stats().active.rings);
    fx.step(3);
  }

  // 被弾: 計器グリッチ + 既存挙動(シールド減少)
  const sBefore = V.AsteroidRun.debug().shields;
  V.AsteroidRun.debug().testHit();
  const D2 = V.AsteroidRun.debug();
  t('FX-06 計器グリッチ', D2.glitchActive === true);
  t('REG 被弾挙動維持', D2.shields === sBefore - 1, `shields ${sBefore}→${D2.shields}`);

  // ---- 性能(render直計測) ----
  const t0 = performance.now();
  for(let i = 0; i < 60; i++) D2.composer.render();
  const per = (performance.now() - t0)/60;
  t('PERF レンダー時間', per < 20, per.toFixed(1)+'ms/frame');

  V.closeLayer();
  window.__P2RESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[Phase2] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
