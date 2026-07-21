/* Phase E3 (SPEC-08c 射出/CLEARANCE/帰投・最終化) 受け入れテスト */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, G = V && V.Guide, Tl = V && V.Tl;
  t('H-01', !!G && !!G.sortie);
  if(!G){ window.__PE3RESULTS = R; console.table(R); return R; }
  G.measure();
  const info = G.info();
  const ch = id => info.find(c=>c.id === id);
  const go = (c, k) => { Tl._setT(c.t0 + (c.t1 - c.t0)*k); Tl.update(.016); };
  V.pageMouse.x = 0; V.pageMouse.y = 0;

  // E3-02: SORTIE章で機体が遠方から接近(射出)
  const so = ch('sortie');
  t('E3-02 sortie章', !!so && info[0].id === 'sortie', info.map(d=>d.id).join(','));
  const dzAt = k=>{ go(so, k); return G.sortie.ship.position.z - Tl.camAt(G.gT()).z; };
  const dz1 = dzAt(.12), dz2 = dzAt(.7);
  t('E3-02b 射出接近', dz1 < -40 && dz2 > -22, `dz ${dz1.toFixed(1)}→${dz2.toFixed(1)}`);

  // E3-01: GATEでは遠方シルエット
  Tl._setT(.005); Tl.update(.016);
  const dzGate = G.sortie.ship.position.z - Tl.camAt(G.gT()).z;
  t('E3-01 GATEシルエット', dzGate < -40, 'dz='+dzGate.toFixed(1));

  // E3-03: CLEARANCEで岩帯が減衰し、惑星がコース上に居る
  const rockScaleAt = tt=>{ Tl._setT(tt); Tl.update(.016); return G.sortie.rocks[0].scale.x; };
  const mid = .5, late = (ch('survival').t1 + 1)/2;
  const s1 = rockScaleAt(mid), s2 = rockScaleAt(.97);
  t('E3-03 岩帯減衰', s2 < s1*.3, `scale ${s1.toFixed(2)}→${s2.toFixed(2)}`);

  // E3-05: HUDラベル
  document.documentElement.style.scrollBehavior = 'auto';
  const secAt = id=>{ const el = document.getElementById(id);
    window.scrollTo(0, Math.max(0, el.offsetTop + 10)); dispatchEvent(new Event('scroll'));
    return document.getElementById('hud-status').textContent; };
  const lS = secAt('ch-sortie'), lG = secAt('gallery');
  window.scrollTo(0, 0); dispatchEvent(new Event('scroll'));
  t('E3-05 HUD最終化', lS.includes('SORTIE') && lG.includes('CLEARANCE'), `${lS} | ${lG}`);

  // E3-07: reduced縮退が新構成でも成立
  G._forceReduced(true);
  const f = ch('flight');
  go(f, .15);
  const allLit = document.querySelectorAll('#ch-flight .ch-line.lit').length === 3;
  G._forceReduced(null);
  t('E3-07 reduced縮退', allLit);

  Tl._setT(0); Tl.update(.016);
  window.__PE3RESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[PhaseE3] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
