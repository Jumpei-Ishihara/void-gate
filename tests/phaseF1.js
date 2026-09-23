/* Phase F1 (SPEC-09a 当たり判定の正確化: RadialHull + 機体4球) 受け入れテスト
 * 実行: fetch('tests/phaseF1.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, T = V && V.THREE, A = V && V.Assets;
  t('H-01 VG.THREE/Assets公開', !!T && !!A);
  if(!T || !A){ window.__PF1RESULTS = R; console.table(R); return R; }

  const geos = A.rockGeos();
  const hulls = geos.map(g=>A.rockHull ? A.rockHull(g) : null);

  // F1-T01: 全8ジオメトリにhull、maxが頂点の最大半径と±1%
  const vmax = g=>{ const p = g.attributes.position, v = new T.Vector3(); let m = 0;
    for(let i = 0; i < p.count; i++) m = Math.max(m, v.fromBufferAttribute(p, i).length()); return m; };
  const t01 = hulls.map((h, i)=>h && Math.abs(h.max - vmax(geos[i]))/vmax(geos[i]) <= .01);
  t('F1-T01 hull生成/外接半径', t01.length === 8 && t01.every(Boolean),
    hulls.map((h, i)=>h ? `${h.max.toFixed(3)}/${vmax(geos[i]).toFixed(3)}` : 'なし').join(' '));

  // F1-T02: radiusAt と実メッシュ表面(中心からのレイ交差)の差 ≤ .075(r=8換算 ±0.6)
  let worst = 0, worstAt = '';
  if(hulls.every(Boolean)){
    const rc = new T.Raycaster(), o = new T.Vector3(), d = new T.Vector3();
    let s = 12345; const rnd = ()=>((s = (s*1664525 + 1013904223)>>>0)/4294967296);
    geos.forEach((g, gi)=>{
      const mesh = new T.Mesh(g, new T.MeshBasicMaterial({side: T.DoubleSide}));
      mesh.updateMatrixWorld();
      for(let k = 0; k < 500; k++){
        const u = rnd()*2 - 1, a = rnd()*6.2832, q = Math.sqrt(1 - u*u);
        d.set(Math.cos(a)*q, u, Math.sin(a)*q);
        rc.set(o, d); rc.far = 10;
        const hit = rc.intersectObject(mesh, false);
        if(!hit.length) continue;
        const surf = Math.max(...hit.map(h=>h.distance));
        const err = Math.abs(hulls[gi].radiusAt(d) - surf);
        if(err > worst){ worst = err; worstAt = `geo${gi}`; }
      }
    });
  }
  t('F1-T02 表面誤差 ≤.075(r8で±0.6)', hulls.every(Boolean) && worst <= .075, `max=${worst.toFixed(4)} ${worstAt}`);

  // F1-T03: 機体4球が翼端と機首先端を包含(寛容係数適用前)
  const SS = A.SHIP_SPHERES || [];
  const covered = p=>SS.some(S=>Math.hypot(p[0]-S.c[0], p[1]-S.c[1], p[2]-S.c[2]) <= S.r + 1e-6);
  const keyPts = [[-3.75, -.4, 1.2], [3.75, -.4, 1.2], [0, 0, -2.6]];
  t('F1-T03 4球が翼端/機首を包含', SS.length === 4 && keyPts.every(covered),
    SS.map(S=>`${S.name}(${S.c.join(',')};${S.r})`).join(' '));

  // ---- 判定のシナリオ(機体を原点・無回転で固定) ----
  const ship = new T.Object3D(); ship.updateMatrixWorld();
  const sph = A.shipSpheresWorld ? A.shipSpheresWorld(ship) : [];
  const CL = A.clearance;
  const mkRock = (gi, scale)=>{ const m = new T.Mesh(geos[gi]); m.userData.r = scale; return m; };
  // 指定ジオメトリで半径が最大/最小になるローカル方向
  const extremeDir = (gi, wantMax)=>{
    const p = geos[gi].attributes.position, v = new T.Vector3(); let best = null, bv = wantMax ? -1 : 9;
    for(let i = 0; i < p.count; i++){ v.fromBufferAttribute(p, i); const L = v.length();
      if(wantMax ? L > bv : L < bv){ bv = L; best = v.clone().normalize(); } }
    return {dir: best, k: hulls[gi].radiusAt(best)};
  };
  const oldHit = m=>m.position.length() < m.userData.r + 2.2;

  if(CL && sph.length === 4){
    // F1-T04: 翼の貫通の解消(旧: 非接触 → 新: 接触)
    const ex = extremeDir(0, true), s4 = 4;
    const r4 = mkRock(0, s4);
    r4.quaternion.setFromUnitVectors(ex.dir, new T.Vector3(-1, 0, 0));   // 最大半径の面を機体側(-x)へ
    r4.position.set(3.2 + ex.k*s4, -.4, 1.2);                             // 表面が x=3.2(翼端3.75より内側)
    r4.updateMatrixWorld();
    const c4 = CL(r4, sph, 0);
    t('F1-T04 翼の貫通を検出', !oldHit(r4) && c4 < 0, `old=${oldHit(r4)} clearance=${c4.toFixed(3)}`);

    // F1-T05: クレーター側の誤被弾の解消(旧: 被弾 → 新: 非被弾)
    const mn = extremeDir(0, false), s5 = 7;
    const r5 = mkRock(0, s5);
    r5.quaternion.setFromUnitVectors(mn.dir, new T.Vector3(0, 0, 1));    // 最小半径(凹み)を機体側(+z)へ
    r5.position.set(0, 0, -(2.6 + 1.5 + mn.k*s5));                         // 表面が機首先端から1.5前方
    r5.updateMatrixWorld();
    const c5 = CL(r5, sph, 0);
    t('F1-T05 凹み側の誤被弾を解消', oldHit(r5) && c5 > 0, `old=${oldHit(r5)} clearance=${c5.toFixed(3)} k=${mn.k.toFixed(3)}`);

    // F1-T06: トンネリング(速度640・dt.05 → 1フレームで32移動して通過)
    const r6 = mkRock(1, 3);
    r6.position.set(0, 0, 14); r6.updateMatrixWorld();   // 移動後は機体の後方14(移動前は前方-18)
    const c6sweep = CL(r6, sph, 32), c6static = CL(r6, sph, 0);
    t('F1-T06 通過フレームで接触検出', c6sweep < 0 && c6static > 0,
      `sweep=${c6sweep.toFixed(2)} static=${c6static.toFixed(2)}`);

    // F1-T07: ロール60°で翼球が追従(右翼が上・左翼が下)
    const shipR = new T.Object3D(); shipR.rotation.z = Math.PI/3; shipR.updateMatrixWorld();
    const sphR = A.shipSpheresWorld(shipR);
    const wl = sphR.find(S=>S.name === 'wingL'), wr = sphR.find(S=>S.name === 'wingR');
    const r7 = mkRock(2, 1.2);
    r7.position.copy(wr.c).add(new T.Vector3(0, wr.r*.9*.5 + hulls[2].radiusAt(new T.Vector3(0, -1, 0))*1.2*.5, 0));
    r7.updateMatrixWorld();
    t('F1-T07 ロール追従', wr.c.y > 1.5 && wl.c.y < -1.5 && CL(r7, sphR, 0) < 0 && CL(r7, sph, 0) > 0,
      `wingR.y=${wr.c.y.toFixed(2)} wingL.y=${wl.c.y.toFixed(2)}`);

    // F1-T09: clearanceは符号付き距離(深く入るほど負)
    const r9 = mkRock(3, 3), dv = new T.Vector3(0, 0, -1);
    const at = z=>{ r9.position.set(0, 0, z); r9.updateMatrixWorld(); return CL(r9, sph, 0); };
    const a1 = at(-20), a2 = at(-10), a3 = at(-4);
    t('F1-T09 符号付き距離', a1 > a2 && a2 > a3 && a1 > 0 && a3 < 0, `${a1.toFixed(2)} > ${a2.toFixed(2)} > ${a3.toFixed(2)}`);
  }else{
    ['F1-T04','F1-T05','F1-T06','F1-T07','F1-T09'].forEach(id=>t(id, false, 'clearance/shipSpheresWorld 未実装'));
  }

  // F1-T12: サイトFLIGHT章(FB-02b厳密版) — 章の全区間で岩表面と機体4球が接触しない
  const G = V.Guide, Tl = V.Tl;
  if(G && G.stage('flight') && CL){
    G.measure();
    const c = G.info().find(d=>d.id === 'flight'), big = G.stage('flight').bigRock;
    const proxy = new T.Mesh(big.geometry); let minC = Infinity, at = 0;
    for(let k = .05; k <= .96; k += .01){
      Tl._setT(c.t0 + (c.t1 - c.t0)*k); Tl.update(.016);
      big.updateMatrixWorld(true);
      big.matrixWorld.decompose(proxy.position, proxy.quaternion, proxy.scale);
      proxy.userData.r = proxy.scale.x;
      const cl = CL(proxy, A.shipSpheresWorld(G.sortie.ship), 0);
      if(cl < minC){ minC = cl; at = k; }
    }
    t('F1-T12 サイトFLIGHT: 表面が機体に触れない', minC > 0, `最小すき間=${minC.toFixed(2)} @k=${at.toFixed(2)}`);
  }else t('F1-T12 サイトFLIGHT: 表面が機体に触れない', false, 'flight stage なし');

  // ---- ゲーム組込(F1-T08 性能 / F1-T10 コア半径 / F1-T11 実ループの判定) ----
  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 300));
  const D = V.AsteroidRun.debug();
  t('F1-T09b debug().clearance公開', typeof D.clearance === 'function');
  if(D.collide && D.asts){
    const t0 = performance.now();
    for(let f = 0; f < 1000; f++) D.collide(0, true);   // 判定のみ(無敵=被弾処理なし)
    const per = (performance.now() - t0)/1000;
    t('F1-T08 46岩の判定 <0.3ms/frame', D.asts.length === 46 && per < .3, `${per.toFixed(4)}ms asts=${D.asts.length}`);
  }else t('F1-T08 46岩の判定 <0.3ms/frame', false, 'debug().collide 未実装');
  t('F1-T10 コア回収半径不変(<34)', D.coreR2 === 34, 'coreR2='+D.coreR2);

  // F1-T11: 実ループの判定がclearanceを使う(翼貫通配置で被弾する)
  if(D.collide && D.asts){
    const st = D.stRef, keep = D.asts.map(m=>m.position.clone());
    D.asts.forEach((m, i)=>m.position.set(0, 0, -1500 - i*10));
    D.shipObj.position.set(0, 0, 0); D.shipObj.rotation.set(0, 0, 0);
    const m0 = D.asts[0], ex = extremeDir(D.asts[0].geometry === geos[0] ? 0 : geos.indexOf(m0.geometry), true);
    const s0 = m0.userData.r, vis0 = m0.visible;
    m0.visible = true;   // SPEC-09c以降: プールの岩は未使用時に非表示
    m0.quaternion.setFromUnitVectors(ex.dir, new T.Vector3(-1, 0, 0));
    m0.position.set(3.2 + ex.k*s0, -.4, 1.2);
    st.inv = 0; const sh0 = st.shields;
    D.collide(0, false);
    const hitNew = st.shields === sh0 - 1;
    D.asts.forEach((m, i)=>m.position.copy(keep[i]));
    m0.visible = vis0;
    st.shields = sh0; st.inv = 0;
    t('F1-T11 ループ組込(翼貫通で被弾)', hitNew, `shields ${sh0}→${hitNew ? sh0-1 : sh0} r=${s0.toFixed(2)}`);
  }else t('F1-T11 ループ組込(翼貫通で被弾)', false, 'debug().collide 未実装');
  V.AsteroidRun.stop(); V.closeLayer();

  // ---- 回帰(ゲーム phase1〜4) ----
  if(!window.__SKIP_NESTED_REG){
    for(const n of ['1','2','3','4']){
      const src = await fetch(`/void-gate/tests/phase${n}.js?r=${Date.now()}`).then(r=>r.text());
      await eval(src);
      await new Promise(r=>setTimeout(r, 250));
      const rr = window['__P' + n + 'RESULTS'] || [];
      const ng = rr.filter(x=>!x.pass);
      t(`REG phase${n}`, rr.length > 0 && ng.length === 0, ng.map(x=>x.id).join(',') || `${rr.length} ok`);
    }
  }
  window.__PF1RESULTS = R;
  console.table(R);
  return R;
})();
