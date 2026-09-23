/* Phase F6 (SPEC-09f 機体外板・排気プルーム・惑星大気・近傍ダスト・仕上げ) 受け入れテスト
 * 実行: fetch('tests/phaseF6.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, T = V && V.THREE, A = V && V.Assets;
  t('H-01', !!A && !!T);
  if(!A){ window.__PF6RESULTS = R; console.table(R); return R; }

  // F6-T01/02: 外板(法線/粗さ・emissive 0) と 箱投影UV
  const sb = A.buildShip();
  const hull = sb.parts.hull;
  t('F6-T01 外板: 法線/粗さマップ・通常時emissive 0', hull && hull.normalMap && hull.roughnessMap && hull.emissive.getHex() === 0 &&
    Math.abs(hull.metalness - .86) < .01 && Math.abs(hull.roughness - .34) < .01,
    hull && `metal=${hull.metalness} rough=${hull.roughness}`);
  // 面ごとのUV密度(UV面積/実面積の平方根)の最大/最小
  const density = g=>{ const p = g.attributes.position, uv = g.attributes.uv, idx = g.index;
    if(!uv) return null; const n = idx ? idx.count : p.count, get = i=>idx ? idx.getX(i) : i;
    const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(); const ds = [];
    for(let i = 0; i < n; i += 3){ const i0 = get(i), i1 = get(i+1), i2 = get(i+2);
      a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
      const wa = b.clone().sub(a).cross(c.clone().sub(a)).length()/2; if(wa < 1e-4) continue;
      const u0 = uv.getX(i0), v0 = uv.getY(i0), u1 = uv.getX(i1), v1 = uv.getY(i1), u2 = uv.getX(i2), v2 = uv.getY(i2);
      const ua = Math.abs((u1 - u0)*(v2 - v0) - (u2 - u0)*(v1 - v0))/2; ds.push(Math.sqrt(ua/wa)); }
    ds.sort((x, y)=>x - y); const q = f=>ds[Math.floor(f*(ds.length - 1))];
    return q(.95)/Math.max(1e-6, q(.05)); };
  const hullMeshes = []; sb.group.traverse(o=>{ if(o.isMesh && o.material === hull) hullMeshes.push(o); });
  const ratios = hullMeshes.map(m=>density(m.geometry));
  t('F6-T02 外板UV(箱投影)の密度比 ≤1.5', ratios.length >= 3 && ratios.every(r=>r !== null && r <= 1.5), ratios.map(r=>r === null ? 'uvなし' : r.toFixed(2)).join(' '));

  // F6-T03: 排気プルーム(加算ShaderMaterialのメッシュ2本、scale.yが長さ)
  const ex = sb.parts.exhaust;
  t('F6-T03 排気プルーム', ex.length === 2 && ex.every(e=>e.isMesh && e.material.isShaderMaterial && e.material.blending === T.AdditiveBlending),
    ex.map(e=>e.type + '/' + (e.material && e.material.type)).join(' '));

  // ---- ゲーム ----
  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.querySelector('.vchip[data-v=chase]').click();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 300));
  const D = V.AsteroidRun.debug(), st = D.stRef, S = D.composer.passes[0].scene;
  st.inv = 1e15;
  // F6-T03b: 速度で伸びる(既存SHP-02と同じ判定)
  st.speed = 110; D.stepVisual(.1);
  const e1 = V.AsteroidRun.debug().shipParts.exhaustScale; st.speed = 640; D.stepVisual(.1);
  const e2 = V.AsteroidRun.debug().shipParts.exhaustScale;
  t('F6-T03b プルームが速度で伸びる', e2 > e1*1.5, `${e1.toFixed(2)} → ${e2.toFixed(2)}`);
  st.speed = 110;

  // F6-T05: 排気が輪郭を覆わない(追跡視点で機体シルエット内の飽和画素 ≤15%)
  const pr = D.lookProbe('chase');
  t('F6-T05 機体シルエットの飽和 ≤15%', pr.shipPx > 0 && pr.shipBlownPct <= 15, `飽和 ${pr.shipBlownPct}% (機体 ${pr.shipPx}%)`);

  // F6-T06: 被弾で外板が橙に点灯 → 0.3秒で消灯
  const hullG = D.shipParts2 && D.shipParts2.hull;
  st.inv = 0; D.testHit(); st.inv = 1e15;
  const lit = hullG && hullG.emissive.getHex() !== 0 && hullG.emissiveIntensity > 0;
  for(let i = 0; i < 22; i++) D.tick(16);
  const off = hullG && hullG.emissive.getHex() === 0;
  t('F6-T06 被弾で外板が点灯→消灯', lit && off, `lit=${lit} off=${off}`);

  // F6-T07: 遠景惑星(emissive 0 + 大気シェル fog:false)
  const bg = D.bgFx;
  t('F6-T07 遠景惑星の昼夜+大気', bg && bg.planet.material.emissive.getHex() === 0 && bg.atmo && bg.atmo.material.fog === false,
    bg ? `em=${bg.planet.material.emissive.getHexString()} atmo=${!!bg.atmo}` : 'なし');

  // F6-T08: 近傍ダスト(数・速度で伸びる)
  const nd = D.nearDust;
  if(nd){
    const len = ()=>{ const a = nd.geometry.attributes.position.array; return Math.abs(a[5] - a[2]); };
    st.speed = 110; D.tick(16); const s1 = len();
    D.director.t = 400; D.tick(16); st.speed = 640; D.tick(16); const s2 = len();   // 速度上限640のセクターへ移ってから
    st.speed = 110;
    t('F6-T08 近傍ダスト(数/速度で伸びる)', nd.userData.count === (D.isTouch ? 60 : 120) && s2 > s1*2, `n=${nd.userData.count} len ${s1.toFixed(2)}→${s2.toFixed(2)}`);
  }else t('F6-T08 近傍ダスト(数/速度で伸びる)', false, 'なし');

  // F6-T09: 仕上げ(ビネット/粒状/色収差)と縮退
  const gu = D.grade && D.grade.uniforms;
  const has = gu && gu.vig && gu.grain && gu.ca;
  const v0 = has && [gu.vig.value, gu.grain.value, gu.ca.value];
  V.Quality.reset(); V.Quality.degrade();
  const l1 = has && [gu.vig.value, gu.grain.value, gu.ca.value];
  V.Quality.reset();
  t('F6-T09 仕上げ(L0: vig/grain/ca, L1: grain=ca=0)', has && (D.isTouch || (v0[1] > 0 && v0[2] > 0)) && l1[1] === 0 && l1[2] === 0 && l1[0] > 0,
    has ? `L0=${v0.join('/')} L1=${l1.join('/')}` : 'なし');

  // F6-T10: CON-05
  const rp = D.reticleProbe();
  t('F6-T10 CON-05 レティクル画素不変', rp && rp.rgb.join() === '0,126,134' && rp.opacity === .12, rp && rp.rgb.join());

  // F6-T11: 輝度(F2基準)
  const B = {chase:{mean:.059, blownPct:0, rockMean:.2113, rockCrushedPct:0}, cockpit:{mean:.0827, blownPct:0, rockMean:.214, rockCrushedPct:0}};
  const within = (m, b)=>m.rockMean >= b.rockMean*.9 && m.rockCrushedPct <= b.rockCrushedPct + 8 && m.blownPct <= b.blownPct + .1 && m.mean >= b.mean*.5;
  for(const v of ['chase', 'cockpit']){ const m = D.lookProbe(v);
    t(`F6-T11 輝度 ${v}`, within(m, B[v]), `岩 ${m.rockMean} 岩黒 ${m.rockCrushedPct}% 白飛び ${m.blownPct}% 平均 ${m.mean}`); }

  // F6-T12: draw call
  const RD = D.composer.renderer;
  RD.info.autoReset = false; RD.info.reset(); D.composer.render();
  const calls = RD.info.render.calls; RD.info.autoReset = true;
  t('F6-T12 draw calls', calls <= (D.isTouch ? 140 : 155), 'calls=' + calls);
  V.AsteroidRun.stop(); V.closeLayer();

  // F6-T04: サイトのプルーム(gT純関数 → 同じ時刻なら同じ見た目)
  const G = V.Guide, Tl = V.Tl;
  const pm = G.sortie.parts.exhaust[0].material;
  Tl._setT(.3); Tl.update(.016); const ta = pm.uniforms && pm.uniforms.time.value;
  Tl._setT(.5); Tl.update(.016); Tl._setT(.3); Tl.update(.016); const tb = pm.uniforms && pm.uniforms.time.value;
  t('F6-T04 サイトのプルーム(逆再生で同じ見た目)', pm.isShaderMaterial && ta === tb, `time ${ta} / ${tb}`);
  // サイトの仕上げ(PCのみ) + 輝度
  if(!V.isTouch){
    const pp = V.pageFx.composer.passes;
    const gi = pp.findIndex(p=>p.isGradePass);
    t('F6-T11b サイト(PC)に仕上げパス', gi > 0 && gi === pp.length - 1, pp.map(p=>p.isGradePass ? 'Grade' : p.constructor.name).join('>'));
  }
  const SB = {sortie:{k:.5, mean:.0378, blownPct:.003, rockMean:.1418, rockCrushedPct:17.42}, flight:{k:.6, mean:.0718, blownPct:.304, rockMean:.0506, rockCrushedPct:31.13},
              weapons:{k:.65, mean:.055, blownPct:.004, rockMean:.1227, rockCrushedPct:16.56}, survival:{k:.6, mean:.0928, blownPct:.008, rockMean:.0942, rockCrushedPct:10.41}};
  for(const [id, b] of Object.entries(SB)){ const m = V.pageFx.lookProbe(id, b.k);
    t(`F6-T11c サイト輝度 ${id}`, within(m, b), `岩 ${m.rockMean}(${b.rockMean}) 岩黒 ${m.rockCrushedPct}% 白飛び ${m.blownPct}% 平均 ${m.mean}`); }

  window.__PF6RESULTS = R;
  console.table(R);
  return R;
})();
