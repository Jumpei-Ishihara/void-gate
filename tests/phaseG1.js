/* Phase G1 (SPEC-14 パイロットの手) 受け入れテスト
 * 実行: fetch('tests/phaseG1.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;
  t('H-01 VG公開', !!V);
  if(!V){ window.__PG1RESULTS = R; console.table(R); return R; }

  V.openLayer('asteroid'); V.AsteroidRun.menu();
  const vc = document.querySelector('.vchip[data-v="cockpit"]'); if(vc) vc.click();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 300));
  const D = V.AsteroidRun.debug(), ck = D.ck, st = D.stRef, T = V.THREE;
  t('H-02 起動(操縦席視点)', D.playing && ck && ck.hand, 'hand=' + !!(ck && ck.hand));
  if(!ck || !ck.hand){ V.AsteroidRun.stop(); V.closeLayer(); window.__PG1RESULTS = R; console.table(R); return R; }
  st.inv = 1e15; st.bootT = 9;
  const Hd = ck.hand, P = Hd.parts, sp = ck.parts.stickPivot;

  // G-T01: 部位の存在・操縦桿の子孫
  const need = ['glove', 'index', 'armor', 'cuffGlow', 'sleeve'], miss = need.filter(k=>!P[k]);
  const under = o=>{ for(let p = o; p; p = p.parent) if(p === sp) return true; return false; };
  t('G-T01 右手のグローブ(5部位)が操縦桿の子', miss.length === 0 && need.every(k=>under(P[k])), `missing=[${miss}]`);

  // G-T02: 操縦桿と一緒に傾く
  const wp = ()=>{ P.glove.updateWorldMatrix(true, false); return new T.Box3().setFromObject(P.glove).getCenter(new T.Vector3()); };   // メッシュの原点は支点上にあるため形状の中心で測る
  const keep = [sp.rotation.x, sp.rotation.z];
  sp.rotation.set(0, 0, 0); const p0 = wp();
  sp.rotation.set(0, 0, -.5); const p1 = wp();
  sp.rotation.set(keep[0], 0, keep[1]);
  t('G-T02 操縦桿と一緒に傾く', p0.distanceTo(p1) > .05, `移動量=${p0.distanceTo(p1).toFixed(3)}`);

  // G-T03: 握り(指の関節点がグリップ表面の近く・芯への食い込みなし)
  const fit = Hd.fit();
  t('G-T03 指がグリップを握る', fit.contactPct >= 80 && fit.penetratePct <= 3, `接触=${fit.contactPct}% 食い込み=${fit.penetratePct}%`);

  // G-T04: 発射で人差し指がトリガーを引き、戻る
  st.cores = 5; await new Promise(r=>setTimeout(r, 200));
  const c0 = Hd.indexCurl();
  V.AsteroidRun.fire(); D.tick(16); D.tick(16);
  const c1 = Hd.indexCurl();
  for(let i = 0; i < 8; i++) D.tick(16);
  const c2 = Hd.indexCurl();
  t('G-T04 人差し指がトリガーを引く', c1 - c0 >= .2 && Math.abs(c2 - c0) < 1e-6, `基準=${c0.toFixed(2)} 発射=${c1.toFixed(2)} 戻り=${c2.toFixed(2)}`);

  // G-T05: 視界(中央域0画素・占有率)
  const m72 = ck.mask(72), m84 = ck.mask(84);
  sp.rotation.set(-.45, 0, .5); const mA = ck.mask(72);
  sp.rotation.set(.45, 0, -.5); const mB = ck.mask(72);
  sp.rotation.set(keep[0], 0, keep[1]);
  t('G-T05 中央域0画素・占有率≤21.6%', [m72, m84, mA, mB].every(m=>m.centerPx === 0) && m72.coverPct <= 21.6,
    `中央域=${[m72, m84, mA, mB].map(m=>m.centerPx)} 占有率=${m72.coverPct}%`);

  // G-T06: 材質と状態色
  const M = Hd.materials;
  const matOk = M.glove.roughness >= .5 && M.glove.metalness <= .3 && M.armor.metalness >= .6 &&
    [M.glove, M.armor, M.sleeve].every(m=>m.isMeshStandardMaterial && m.envMapIntensity > 0);
  st.shields = 0; D.tick(16); D.tick(16);
  const red = P.cuffGlow.material === ck.glowMat && ck.glowState() === 2;
  st.shields = 3; D.tick(16);
  t('G-T06 材質・袖口の発光線が状態色', matOk && red, `材質=${matOk} 発光線(赤)=${red}`);

  // G-T07: 性能
  let n = 0, tris = 0;
  Hd.group.traverse(o=>{ if(o.isMesh){ n++; const g = o.geometry; tris += (g.index ? g.index.count : g.attributes.position.count)/3; } });
  const RD = D.composer.renderer;
  RD.info.autoReset = false; RD.info.reset(); D.composer.render();
  const calls = RD.info.render.calls; RD.info.autoReset = true;
  const cap = D.isTouch ? 140 : 155;
  t('G-T07 手のメッシュ≤5・三角形≤5000・draw call', n <= 5 && tris <= 5000 && calls <= cap, `meshes=${n} tris=${Math.round(tris)} calls=${calls}/${cap}`);

  // G-T08: CON-05・輝度
  const rp = D.reticleProbe();
  const dRGB = rp ? Math.max(...rp.rgb.map((v, i)=>Math.abs(v - [0, 126, 134][i]))) : 99;
  const lp = D.lookProbe('cockpit');
  t('G-T08 CON-05・輝度', rp && rp.color === 0x00f0ff && rp.opacity === .12 && dRGB <= 3 && lp.blownPct <= .1 && lp.rockMean >= .214*.9 && lp.mean >= .0827*.5,
    `rgb=${rp && rp.rgb} 白飛び=${lp.blownPct}% 岩=${lp.rockMean} 平均=${lp.mean}`);

  V.AsteroidRun.stop(); V.closeLayer();
  window.__PG1RESULTS = R; console.table(R);
  return R;
})();
