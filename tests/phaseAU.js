/* Phase AU (SPEC-11 効果音のタイミング) 受け入れテスト
 * 実行: fetch('tests/phaseAU.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, SE = V && V.SoundEngine;
  t('H-01 _render', !!SE && typeof SE._render === 'function');
  if(!SE || !SE._render){ window.__PAURESULTS = R; console.table(R); return R; }

  // AU-T01/02: 立ち上がりと爆発音の高域
  const list = [['gun'], ['explosion', 1], ['explosion', 4], ['impact', false], ['coreGet'], ['whoosh', 1, 0], ['combo', 1], ['warn'], ['sector']];
  const res = {};
  for(const [n, ...a] of list) res[n + (a.length ? '(' + a[0] + ')' : '')] = await SE._render(n, ...a);
  const slow = Object.entries(res).filter(([, r])=>r.full.t50 > 10 || r.high.t50 > 10).map(([k])=>k);
  t('AU-T01 全効果音の立ち上がり ≤10ms', slow.length === 0, slow.join(',') || 'all ≤10ms');
  const ex = [res['explosion(1)'], res['explosion(4)']];
  t('AU-T02 爆発音の高域ピーク ≥0.15', ex.every(r=>r.high.peak >= .15), ex.map(r=>r.high.peak).join(' / '));

  // AU-T03: 先行ニアミス音のピーク時刻
  const w = await SE._render('whoosh', 1, .12);
  t('AU-T03 whoosh(0.12s先行)のピーク≈120ms', Math.abs(w.full.tPeak - 120) <= 20, `tPeak=${w.full.tPeak}ms`);

  // AU-T04: ゲームの先行ニアミス音
  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 300));
  const D = V.AsteroidRun.debug(), st = D.stRef, A = V.Assets;
  const ship = D.shipObj; ship.position.set(0, 0, 0); ship.rotation.set(0, 0, 0); ship.updateMatrixWorld();
  const sph = A.shipSpheresWorld(ship), m0 = D.asts[0];
  D.asts.forEach((m, i)=>{ if(i) m.position.set(0, 0, -5000 - i*50); });
  m0.visible = true; m0.quaternion.identity(); m0.userData.r = 3; m0.scale.setScalar(3); m0.userData.nm = false; m0.userData.ws = false;
  st.inv = 0; st.speed = 300; st.score = 0; st.tally.near.n = 0;
  // 通過時(z=0付近)に表面から1.5になる x
  let lo = 0, hi = 60; for(let k = 0; k < 40; k++){ const mid = (lo + hi)/2; m0.position.set(mid, 0, 0); m0.updateMatrixWorld();
    if(A.clearance(m0, sph, 0) < 1.5) lo = mid; else hi = mid; }
  const x = (lo + hi)/2;
  const c0 = SE._test().counts.whoosh || 0;
  m0.position.set(x, 0, -300*.1); D.collideSd(performance.now(), 5);          // 通過0.1秒前(速度300)
  const early = (SE._test().counts.whoosh || 0) - c0, earlyLead = SE._test().lastSfx && SE._test().lastSfx.lead;
  const nearBefore = st.tally.near.n;
  m0.position.set(x, 0, 2); D.collideSd(performance.now(), 5);               // 通過フレーム
  const after = (SE._test().counts.whoosh || 0) - c0;
  t('AU-T04 風切り音は通過前に先行・通過時に得点・音は1回', early === 1 && earlyLead > .05 && nearBefore === 0 && st.tally.near.n === 1 && after === 1,
    `先行=${early}(lead ${earlyLead && earlyLead.toFixed(3)}s) 得点=${nearBefore}→${st.tally.near.n} 音の回数=${after}`);
  V.AsteroidRun.stop(); V.closeLayer();

  // AU-T05/06: サイトの章は映像の時間で発火
  const G = V.Guide, Tl = V.Tl; G.measure();
  const info = G.info(), ch = id=>info.find(c=>c.id === id);
  const go = (c, k)=>{ Tl._setT(c.t0 + (c.t1 - c.t0)*k); Tl.update(.016); };
  const last = ()=>SE._test().lastSfx || {};
  const wp = ch('weapons');
  go(wp, .40); SE.ui('select');
  go(wp, .495); const s1 = last();
  SE.ui('select'); go(wp, .79); go(wp, .80); const s2 = last();
  go(wp, .86); const s3 = last();
  t('AU-T05 WEAPONS: 着弾(ta.49)で着弾音 / 解除直後は鳴らず / 爆発(ta.55)で爆発音',
    s1.type === 'explosion' && s1.r === 1 && s2.type !== 'explosion' && s3.type === 'explosion' && s3.r === 2,
    `ta.49=${s1.type}(${s1.r}) tl.80=${s2.type} ta.55=${s3.type}(${s3.r})`);
  const sv = ch('survival');
  go(sv, .6); SE.ui('select');
  go(sv, .80); const v1 = last();
  go(sv, .83); const v2 = last();
  t('AU-T06 SURVIVAL: 警告音はシールド砕散(ta.505)で', !(v1.type === 'impact' && v1.warn) && v2.type === 'impact' && v2.warn,
    `tl.80=${v1.type}${v1.warn ? '(warn)' : ''} 砕散=${v2.type}${v2.warn ? '(warn)' : ''}`);
  Tl._setT(0); Tl.update(.016);

  window.__PAURESULTS = R;
  console.table(R);
  return R;
})();
