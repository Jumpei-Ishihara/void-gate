/* Phase S1 (SPEC-10 機体デザイン刷新) 受け入れテスト
 * 実行: fetch('tests/phaseS1.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, T = V && V.THREE, A = V && V.Assets;
  t('H-01', !!A && !!T);
  if(!A){ window.__PS1RESULTS = R; console.table(R); return R; }

  const sb = A.buildShip(), g = sb.group, P = sb.parts;
  g.updateMatrixWorld(true);
  const meshes = []; g.traverse(o=>{ if(o.isMesh) meshes.push(o); });
  const solid = meshes.filter(m=>!m.material.transparent && !m.material.isShaderMaterial);
  const hullMs = meshes.filter(m=>m.material === P.hull);

  // S-T01: 外板に Cone/Box なし・胴体はロフト(断面 ≥6)
  const prim = hullMs.filter(m=>['ConeGeometry', 'BoxGeometry'].includes(m.geometry.type) || (m.geometry.userData && m.geometry.userData.src === 'Cone'));
  const fus = P.fuselage;
  t('S-T01 胴体はロフト形状(Cone/Boxなし)', prim.length === 0 && fus && fus.geometry.userData.sections >= 6,
    `primitive=${prim.length} sections=${fus && fus.geometry.userData.sections}`);

  // S-T02: 部品の連結(境界箱の交差グラフが1つにつながる)
  const boxes = solid.map(m=>new T.Box3().setFromObject(m));
  const seen = new Set([0]), q = [0];
  while(q.length){ const i = q.pop(); boxes.forEach((b, j)=>{ if(!seen.has(j) && b.intersectsBox(boxes[i])){ seen.add(j); q.push(j); } }); }
  t('S-T02 浮いた部品がない(連結)', solid.length >= 5 && seen.size === solid.length, `${seen.size}/${solid.length}`);

  // S-T11: 垂直尾翼は中央に1枚(ユーザーFB: 2枚は違和感)
  const tailM = P.tail;
  const tb = tailM && new T.Box3().setFromObject(tailM);
  t('S-T11 垂直尾翼は中央に1枚', tailM && Math.abs((tb.min.x + tb.max.x)/2) < .02 && (tb.max.x - tb.min.x) < .3 && tb.max.y > 1.1,
    tb ? `中心x=${((tb.min.x + tb.max.x)/2).toFixed(2)} 厚み=${(tb.max.x - tb.min.x).toFixed(2)} 高さ=${tb.max.y.toFixed(2)}` : 'なし');

  // S-T03: 外形寸法
  const bb = new T.Box3(); solid.forEach(m=>bb.expandByObject(m));
  const W = bb.max.x - bb.min.x, L = bb.max.z - bb.min.z, H = bb.max.y - bb.min.y;
  t('S-T03 寸法(全幅7.5±.3/全長5.2〜6.4/高さ≤2.6)', Math.abs(W - 7.5) <= .3 && L >= 5.2 && L <= 6.4 && H <= 2.6,
    `W=${W.toFixed(2)} L=${L.toFixed(2)} H=${H.toFixed(2)}`);

  // S-T04: 当たり判定4球の被覆
  const SS = A.SHIP_SPHERES;
  const primD = (v, S)=>{ if(!S.c2) return Math.hypot(v.x - S.c[0], v.y - S.c[1], v.z - S.c[2]);   // 球 or カプセル
    const a = new T.Vector3(...S.c), b = new T.Vector3(...S.c2), ab = b.clone().sub(a);
    const k = Math.min(1, Math.max(0, v.clone().sub(a).dot(ab)/ab.lengthSq()));
    return v.distanceTo(a.addScaledVector(ab, k)); };
  const inS = (v, k = 1)=>SS.some(S=>primD(v, S) <= S.r*k + 1e-6);
  let n = 0, inside = 0; const v = new T.Vector3();
  const ext = {xmax: null, xmin: null, zmin: null, ymax: null};
  for(const m of solid){ const p = m.geometry.attributes.position;
    for(let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); n++; if(inS(v)) inside++;
      if(!ext.xmax || v.x > ext.xmax.x) ext.xmax = v.clone(); if(!ext.xmin || v.x < ext.xmin.x) ext.xmin = v.clone();
      if(!ext.zmin || v.z < ext.zmin.z) ext.zmin = v.clone(); if(!ext.ymax || v.y > ext.ymax.y) ext.ymax = v.clone(); } }
  const cov = inside/n, endsOk = Object.values(ext).every(p=>inS(p));
  t('S-T04 当たり形状の被覆 ≥95%・端点包含', SS.length >= 4 && SS.length <= 12 && cov >= .95 && endsOk,
    `被覆=${(cov*100).toFixed(1)}% 端点=${Object.entries(ext).map(([k, p])=>`${k}:${inS(p) ? 'ok' : 'NG'}`).join(' ')}`);

  // S-T10: 難度を変えない — 当たり形状の体積(寛容係数.9適用後)が旧4球の1.2倍以内(モンテカルロ)
  const OLD = [{c:[0, 0, -1.8], r:.85}, {c:[0, -.1, .9], r:1.35}, {c:[-2.6, -.4, 1.2], r:1.15}, {c:[2.6, -.4, 1.2], r:1.15}];
  let sd = 1; const rnd = ()=>((sd = (sd*1664525 + 1013904223)>>>0)/4294967296);
  let inO = 0, inN = 0; const pv = new T.Vector3();
  for(let i = 0; i < 120000; i++){ pv.set(-4.5 + rnd()*9, -2 + rnd()*4.2, -3.5 + rnd()*7.5);
    if(OLD.some(S=>primD(pv, S) <= S.r*.9)) inO++; if(SS.some(S=>primD(pv, S) <= S.r*.9)) inN++; }
  t('S-T10 当たり体積 ≤旧4球×1.2(難度維持)', inN <= inO*1.2, `新/旧 = ${(inN/inO).toFixed(2)}`);

  // S-T05: 材質3系統 + 外板 emissive 0
  const mats = new Set(solid.map(m=>m.material));
  const glass = P.canopy && P.canopy.material, dark = [...mats].find(m=>m !== P.hull && m !== glass && m.isMeshStandardMaterial);
  t('S-T05 材質(外板/暗色/ガラス)', P.hull.metalness >= .8 && P.hull.emissive.getHex() === 0 && dark &&
    glass && glass.roughness <= .12 && glass.metalness >= .8,
    `hull m${P.hull.metalness} dark=${!!dark} glass r${glass && glass.roughness} m${glass && glass.metalness}`);

  // S-T06: parts 互換
  t('S-T06 parts互換+canopy', P.exhaust.length === 2 && P.tips.length === 2 && P.nozzles && P.nozzleGlow && P.hull && P.plumeMat && P.canopy);

  // S-T08: 軽さ
  const tris = meshes.reduce((a, m)=>a + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count)/3, 0);
  t('S-T08 メッシュ≤16・三角形≤6000', meshes.length <= 16 && tris <= 6000, `meshes=${meshes.length} tris=${Math.round(tris)}`);

  // ---- ゲーム ----
  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.querySelector('.vchip[data-v=chase]').click();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 300));
  const D = V.AsteroidRun.debug();
  // S-T07: 曳光弾の始点 = 砲口
  const mz = D.muzzles ? D.muzzles() : null;
  const guns = sb.parts.muzzles || [];
  const near = mz && guns.length === 2 && mz.every((p, i)=>p.distanceTo(new T.Vector3(...guns[i]).add(D.shipObj.position)) <= .3);
  t('S-T07 曳光弾は砲口から', near, mz ? mz.map(p=>p.toArray().map(x=>x.toFixed(2)).join(',')).join(' / ') : 'なし');
  // S-T09: 見え方
  const pr = D.lookProbe('chase');
  t('S-T09 飽和≤15%・占有率 現行比0.8〜1.5倍', pr.shipBlownPct <= 15 && pr.shipPx >= 1.4*.8 && pr.shipPx <= 1.4*1.5,
    `飽和 ${pr.shipBlownPct}% 占有 ${pr.shipPx}%(現行1.4%)`);
  V.AsteroidRun.stop(); V.closeLayer();

  window.__PS1RESULTS = R;
  console.table(R);
  return R;
})();
