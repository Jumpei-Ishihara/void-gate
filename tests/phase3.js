/* Phase 3 (SPEC-05 機体・コア・コックピット造形) 受け入れテスト
 * 実行: fetch('tests/phase3.js').then(r=>r.text()).then(eval)
 * 時間進行は debug().stepVisual(dt) の手動ステップ(非表示タブ対応)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;
  t('H-01 VG公開', !!V);
  if(!V){ window.__P3RESULTS = R; console.table(R); return R; }

  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 400));
  let D = V.AsteroidRun.debug();
  t('H-02 起動', !!D.playing);

  // ---- 機体(SHP) ----
  const sp = D.shipParts;
  t('SHP-01 翼/尾翼/ノズル', sp && sp.hullExtra && sp.nozzleGlow, JSON.stringify(sp && {hullExtra:sp.hullExtra, nozzleGlow:sp.nozzleGlow}));
  t('SHP-03 翼端灯2色', sp && sp.tips === 2 && sp.tipColorsDistinct, 'tips='+(sp&&sp.tips));
  // SHP-02 排気の速度連動
  D.stRef.speed = 110; D.stepVisual(.1);
  const e1 = D.shipParts.exhaustScale;
  D.stRef.speed = 480; D.stepVisual(.1);
  const e2 = V.AsteroidRun.debug().shipParts.exhaustScale;
  t('SHP-02 排気速度連動', e1 > 0 && e2 > e1*1.5, `scale110=${e1&&e1.toFixed(2)} scale480=${e2&&e2.toFixed(2)}`);

  // ---- コア(COR) ----
  const c0 = D.coreParts;
  t('COR-01 二重リング構造', c0 && c0.rings === 2 && c0.children >= 3, JSON.stringify(c0));
  const r1a = c0.ring1RotY, r2a = c0.ring2RotX;
  D.stepVisual(.5);
  const c1 = V.AsteroidRun.debug().coreParts;
  t('COR-01b リング異速回転', Math.abs(c1.ring1RotY - r1a) > .1 && Math.abs(c1.ring2RotX - r2a) > .1
    && Math.abs((c1.ring1RotY - r1a) - (c1.ring2RotX - r2a)) > .05,
    `d1=${(c1.ring1RotY-r1a).toFixed(2)} d2=${(c1.ring2RotX-r2a).toFixed(2)}`);
  // COR-03 回収演出
  const coresBefore = D.stRef.cores;
  D.testPickup();
  const D2 = V.AsteroidRun.debug();
  t('COR-03 回収(音+スパーク)', D2.stRef.cores === coresBefore + 1
    && V.SoundEngine._test().lastSfx.type === 'coreGet'
    && D2.fx.stats().active.sparks > 0,
    `cores=${D2.stRef.cores} sfx=${V.SoundEngine._test().lastSfx.type}`);
  D2.fx.step(1);

  // ---- コックピット(CPT) ----
  const cp = D2.cockpitParts;
  t('CPT-01 グリーブル12+', cp && cp.greebles >= 12, 'greebles='+(cp&&cp.greebles));
  t('CPT-02 ベゼル', cp && cp.bezels >= 3, 'bezels='+(cp&&cp.bezels));
  t('CPT-03 ランプ非同期', cp && cp.lamps >= 3 && cp.lampPhasesDistinct, 'lamps='+(cp&&cp.lamps));
  // CPT-04 非常灯
  D2.stRef.shields = 0; D2.stepVisual(.3);
  const alertOn = V.AsteroidRun.debug().cockpitParts.alertOn;
  D2.stRef.shields = 3; D2.stepVisual(.3);
  const alertOff = !V.AsteroidRun.debug().cockpitParts.alertOn;
  t('CPT-04 CRITICAL非常灯', alertOn && alertOff, `on=${alertOn} off=${alertOff}`);

  // ---- ヘッドライト(FB): 近距離の障害物だけが明るくなる ----
  const hl = D2.headlight;
  t('LIGHT-01 ヘッドライト', !!hl && hl.isSpotLight === true && hl.distance > 0,
    hl ? `dist=${hl.distance} int=${hl.intensity}` : 'なし');
  if(hl){
    // 光源はコックピット計器(≒ship.z-0.15)より前方=至近距離の白飛び防止
    t('LIGHT-01b 光源が計器より前方', hl.position.z < -3, 'hl.z='+hl.position.z.toFixed(1));

    const rp = D2.composer.passes[0], scn = rp.scene, cam = rp.camera, RD2 = D2.composer.renderer;
    const rocks = scn.children.filter(o=>o.isMesh && o.material && o.material.bumpMap);
    const gl = RD2.getContext();
    const sample = ()=>{ RD2.render(scn, cam);
      const w = RD2.domElement.width, h = RD2.domElement.height, bw = 160, bh = 120;
      const buf = new Uint8Array(bw*bh*4);
      gl.readPixels((w-bw)>>1, (h-bh)>>1, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      let sum = 0; for(let i = 0; i < buf.length; i += 4) sum += buf[i]+buf[i+1]+buf[i+2];
      return sum/(bw*bh*3); };
    const keep = rocks.map(m=>m.position.clone());
    const gainAt = z=>{
      rocks.forEach((m, i)=>m.position.set(0, 0, -1500 - i*10));
      rocks[0].position.set(0, 0, z); rocks[0].scale.setScalar(z < -150 ? 24 : 5);
      const on = sample(); const k = hl.intensity; hl.intensity = 0;
      const off = sample(); hl.intensity = k;
      return on - off; };
    const gNear = gainAt(-30), gFar = gainAt(-300);
    rocks.forEach((m, i)=>{ m.position.copy(keep[i]); m.scale.setScalar(m.userData.r); });
    t('LIGHT-02 近距離が明るくなる', gNear > 8, `gain(近)=${gNear.toFixed(1)}`);
    t('LIGHT-03 遠距離は変化なし', Math.abs(gFar) < 2 && gNear > gFar*3 + 5,
      `gain(遠)=${gFar.toFixed(1)}`);
  }

  // ---- 予算(CPT-06 / SPEC-00 §2) ----
  const RD = D2.composer.renderer;
  RD.info.autoReset = false; RD.info.reset();
  D2.composer.render();
  const calls = RD.info.render.calls;
  RD.info.autoReset = true;
  t('BUDGET draw calls≤140', calls <= 140, 'calls='+calls+' (基準110+30)');

  const t0 = performance.now();
  for(let i = 0; i < 60; i++) D2.composer.render();
  const per = (performance.now() - t0)/60;
  t('PERF レンダー時間', per < 20, per.toFixed(1)+'ms/frame');

  V.closeLayer();
  window.__P3RESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[Phase3] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
