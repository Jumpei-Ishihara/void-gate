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

  // FB: 凍結点=すれ違いの瞬間であること(岩と機体がほぼ同じ奥行き)
  const fCh = ch('flight');
  go(fCh, .6);   // 凍結中
  const rockW = Sf.bigRock.getWorldPosition(new (Sf.bigRock.position.constructor)());
  const shipW = G.sortie.ship.position;
  const dzCross = Math.abs(rockW.z - shipW.z);
  t('FB-02 凍結点が交差の瞬間', dzCross < 3, `|Δz|=${dzCross.toFixed(2)}`);
  // FB: すり抜けていない(中心間距離 > 岩半径+機体半幅)
  const dx = rockW.x - shipW.x, dy = rockW.y - shipW.y;
  const dist = Math.hypot(dx, dy, rockW.z - shipW.z);
  const rockR = Sf.bigRock.scale.x*1.3, shipR = 3.94;   // 岩は変位で最大1.3倍
  t('FB-02b すり抜けなし(離隔確保)', dist > rockR + shipR,
    `dist=${dist.toFixed(2)} > ${(rockR+shipR).toFixed(2)} (dx=${dx.toFixed(1)} dy=${dy.toFixed(1)})`);
  // FB: 岩は接近するほど機体から離れる方向(=避けている)
  const sepAt = k=>{ go(fCh, k); const r = Sf.bigRock.getWorldPosition(new (Sf.bigRock.position.constructor)());
    return Math.hypot(r.x - G.sortie.ship.position.x, r.y - G.sortie.ship.position.y); };
  const sepMid = sepAt(.6);
  t('FB-02c 交差時に横方向へ退避', sepMid > 7, `横離隔=${sepMid.toFixed(2)}`);
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

  // ---- FB: フリーズ中のカメラ寄りが蓄積せず、機体が画面内に留まる ----
  const camObj = V.pageFx.camera, stepCam = V.pageFx.stepCamera;
  V.pageMouse.x = 0; V.pageMouse.y = 0; V.pageMouse.tx = 0; V.pageMouse.ty = 0;
  const svCh = ch('survival');
  go(svCh, .6);                       // 凍結中(camOffが最大)
  for(let i = 0; i < 240; i++) stepCam();   // 定常状態まで回す
  const camTgt = G.camMod();
  const tgt = Tl.camAt(G.gT());
  const driftX = Math.abs(camObj.position.x - (tgt.x + camTgt.x));
  const driftY = Math.abs(camObj.position.y - (tgt.y + camTgt.y));
  t('FB-04 カメラ寄りが蓄積しない', driftX < .5 && driftY < .5,
    `drift=(${driftX.toFixed(2)}, ${driftY.toFixed(2)}) camOff=(${camTgt.x}, ${camTgt.y})`);

  // 機体が視錐台内(PC/SP両アスペクト)に収まる
  const shipPos = G.sortie.ship.position.clone();
  const inFrame = aspect=>{
    const a0 = camObj.aspect;
    camObj.aspect = aspect; camObj.updateProjectionMatrix(); camObj.updateMatrixWorld();
    const n = shipPos.clone().project(camObj);
    camObj.aspect = a0; camObj.updateProjectionMatrix(); camObj.updateMatrixWorld();
    return {x:+n.x.toFixed(2), y:+n.y.toFixed(2), ok: Math.abs(n.x) < .9 && Math.abs(n.y) < .9 && n.z < 1};
  };
  const framePC = inFrame(16/9), frameSP = inFrame(375/812);
  t('FB-04b 機体が画面内(PC)', framePC.ok, `ndc=(${framePC.x}, ${framePC.y})`);
  t('FB-04c 機体が画面内(SP縦)', frameSP.ok, `ndc=(${frameSP.x}, ${frameSP.y})`);

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
