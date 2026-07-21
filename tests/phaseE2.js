/* Phase E2 (SPEC-08b Sortie連続機体+タイムワープ+フリーズビート) 受け入れテスト */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, G = V && V.Guide, Tl = V && V.Tl;
  t('H-01 公開面', !!G && typeof G.warp === 'function' && !!G.sortie);
  if(!G || !G.warp){ window.__PE2RESULTS = R; console.table(R); return R; }

  // ---- E2-01: warp/fzDepth 単体(期待値表) ----
  const w = G.warp, fd = G.fzDepth;
  const near = (a, b)=>Math.abs(a - b) < 1e-9;
  t('E2-01 warp写像', near(w(.2, .4, .8), .2) && near(w(.4, .4, .8), .4) && near(w(.6, .4, .8), .4)
    && near(w(.8, .4, .8), .4) && near(w(.9, .4, .8), .7) && near(w(1, .4, .8), 1),
    [w(.2,.4,.8), w(.6,.4,.8), w(.9,.4,.8)].join(','));
  t('E2-01b fzDepth', fd(.3, .4, .8) === 0 && fd(.6, .4, .8) === 1 && fd(.42, .4, .8) > 0
    && fd(.42, .4, .8) < 1 && fd(.85, .4, .8) === 0);

  // ---- E2-02/03: 機体の連続性 ----
  V.pageMouse.x = 0; V.pageMouse.y = 0;
  const shipVisAt = k=>{ Tl._setT(k); Tl.update(.016); return G.sortie.ship.visible; };
  t('E2-03 機体が全域で連続', [.05, .25, .45, .65, .85].every(shipVisAt));
  t('E2-02 岩帯', G.sortie.rocks.length === (V.isTouch ? 16 : 26), 'rocks='+G.sortie.rocks.length);

  const info = G.info();
  const ch = id => info.find(c=>c.id === id);
  const at = (c, k) => c.t0 + (c.t1 - c.t0)*k;
  const go = (c, k) => { Tl._setT(at(c, k)); Tl.update(.016); };

  // ---- 各章: フリーズ静止検証(FZ内2点で道具座標が完全一致) ----
  function frozenCheck(id, propGetter, p1, p2){
    const c = ch(id);
    go(c, p1);
    const s1 = propGetter().map(v=>+v.toFixed(5)).join(',');
    go(c, p2);
    const s2 = propGetter().map(v=>+v.toFixed(5)).join(',');
    return s1 === s2 && s1.length > 0;
  }
  const Sf = G.stage('flight'), Sw = G.stage('weapons'), Ss = G.stage('survival');
  t('E2-04 FLIGHT凍結静止', frozenCheck('flight', ()=>Sf.bigRock.position.toArray(), .5, .7));
  t('E2-04b WEAPONS凍結静止(閃光)', frozenCheck('weapons', ()=>[Sw.flash.scale.x, Sw.flash.material.opacity, ...Sw.tracers[0].position.toArray()], .58, .74));
  t('E2-04c SURVIVAL凍結静止(火花)', frozenCheck('survival', ()=>[...Ss.sparks[0].position.toArray(), Ss.film.material.opacity], .55, .72));

  // ---- 凍結中の行点灯 / 凍結外は消灯 ----
  const f = ch('flight');
  go(f, .6);
  const litFz = document.querySelectorAll('#ch-flight .ch-line.lit').length;
  go(f, .1);
  const litPre = document.querySelectorAll('#ch-flight .ch-line.lit').length;
  t('E2-06 凍結中に行点灯', litFz >= 3 && litPre === 0, `fz=${litFz} pre=${litPre}`);

  // ---- E2-05: 減彩フィルタ + TIME HOLDバッジ ----
  go(f, .6);
  const sp = document.getElementById('space');
  const fzOn = (sp.style.filter || '').includes('saturate');
  const badgeOn = document.getElementById('time-hold').style.display !== 'none';
  go(f, .05);
  const fzOff = !(sp.style.filter || '').includes('saturate');
  const badgeOff = document.getElementById('time-hold').style.display === 'none';
  t('E2-05 凍結演出', fzOn && badgeOn && fzOff && badgeOff, `on=${fzOn}/${badgeOn} off=${fzOff}/${badgeOff}`);

  // ---- エッジ音: f0上向き=hold / f1上向き=sync ----
  go(f, .2);
  V.SoundEngine.ui('select');
  go(f, .5);   // f0(.42)を上向き通過
  const holdFx = V.SoundEngine._test().lastSfx.type;
  go(f, .9);   // f1(.78)を上向き通過
  const relFx = V.SoundEngine._test().lastSfx.type;
  V.SoundEngine.ui('select');
  go(f, .5);   // 下向き通過は無音
  const downFx = V.SoundEngine._test().lastSfx.type;
  t('E2-05b エッジ音', holdFx === 'ui:hold' && relFx === 'ui:sync' && downFx === 'ui:select',
    `f0=${holdFx} f1=${relFx} down=${downFx}`);

  // ---- 結末再生: SURVIVAL解除後にシールド砕片+赤ビネット ----
  const sv = ch('survival');
  go(sv, .86);
  const fragsFly = Ss.frags.some(m=>m.visible && m.position.length() > .5);
  const vignOn = parseFloat(Ss.vign.style.opacity) > .05;
  go(sv, .3);
  const fragsPre = !Ss.frags.some(m=>m.visible);
  t('E2-04d 激突の結末再生', fragsFly && vignOn && fragsPre, `fly=${fragsFly} vign=${vignOn}`);

  // ---- 決定性: 凍結跨ぎ往復 ----
  const wp = ch('weapons');
  go(wp, .9);
  const snap1 = Sw.shards[0].position.toArray().map(v=>+v.toFixed(5)).join(',');
  go(wp, .2); go(wp, .9);
  const snap2 = Sw.shards[0].position.toArray().map(v=>+v.toFixed(5)).join(',');
  t('E2 決定性(凍結跨ぎ)', snap1 === snap2);

  Tl._setT(0); Tl.update(.016);

  // ---- 性能 ----
  const t0 = performance.now();
  for(let i = 0; i < 60; i++){ Tl.update(.016); V.pageFx.composer.render(); }
  const per = (performance.now() - t0)/60;
  t('PERF', per < 12, per.toFixed(1)+'ms/frame');

  window.__PE2RESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[PhaseE2] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
