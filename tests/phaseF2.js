/* Phase F2 (SPEC-09b 照明・トーンマッピング・環境反射 / CON-05) 受け入れテスト
 * 実行: fetch('tests/phaseF2.js').then(r=>r.text()).then(eval)
 *
 * 基準値(BASE): F2着手前のコード(git HEAD=F1完了時点)に同じ輝度プローブを載せた _base.html で実測(2026-09-23)。
 * 判定は「物体(岩)が暗く沈まないこと」を主にする。画面全体の平均・黒つぶれ率は、旧来の広いブルームの霞
 * (過去FB「青い光の影響で見えにくい」の原因)を含むため、霞を取り除くと必ず下がる → 指標から外し、下限のみ残す。
 *   岩の平均輝度 ≥ 基準×0.9 / 岩の黒つぶれ率 ≤ 基準+8pt(恒星の反対側=硬い明暗境界の影面を許容)
 *   / 白飛び率 ≤ 基準+0.1pt(0.1%≒数百画素の鏡面の輝きまで) / 画面平均 ≥ 基準×0.5(全体が沈まない)
 *   岩の輝度の上限は設けない(白っぽさは白飛び率で検出する)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, T = V && V.THREE;
  t('H-01 VG', !!V && !!T);
  if(!V || !T){ window.__PF2RESULTS = R; console.table(R); return R; }

  const BASE = {
    game: {chase:  {mean:.059,  blownPct:0,    rockMean:.2113, rockCrushedPct:0},
           cockpit:{mean:.0827, blownPct:0,    rockMean:.214,  rockCrushedPct:0}},
    site: {sortie:  {k:.5,  mean:.0378, blownPct:.003, rockMean:.1418, rockCrushedPct:17.42},
           flight:  {k:.6,  mean:.0718, blownPct:.304, rockMean:.0506, rockCrushedPct:31.13},
           weapons: {k:.65, mean:.055,  blownPct:.004, rockMean:.1227, rockCrushedPct:16.56},
           survival:{k:.6,  mean:.0928, blownPct:.008, rockMean:.0942, rockCrushedPct:10.41}},
    reticleRGB: [0, 126, 134]   // 十字中心(縦横2本の加算が重なる画素)。F2前の実測
  };
  const within = (m, b)=>m.rockMean >= b.rockMean*.9 &&
    m.rockCrushedPct <= b.rockCrushedPct + 8 && m.blownPct <= b.blownPct + .1 && m.mean >= b.mean*.5;
  const fmt = (m, b)=>m ? `岩 ${m.rockMean}(基準${b.rockMean}) 岩黒 ${m.rockCrushedPct}%(${b.rockCrushedPct}) 白飛び ${m.blownPct}%(${b.blownPct}) 平均 ${m.mean}(${b.mean})` : 'なし';
  const lightsOf = sc=>{ const L = []; sc.traverse(o=>{ if(o.isLight) L.push(o); }); return L; };

  // ---- サイト ----
  const Look = V.Look;
  t('F2-T01a VG.Look', !!Look && !!Look.LOOK && typeof Look.spaceEnv === 'function' && typeof Look.rig === 'function' && !!Look.GradeShader);
  const pscene = V.pageFx.scene, prend = V.pageFx.renderer;
  t('F2-T01b サイト environment(PMREM)', !!(pscene && pscene.environment && pscene.environment.isTexture),
    pscene && pscene.environment ? pscene.environment.mapping : 'なし');
  const pl = pscene ? lightsOf(pscene) : [];
  t('F2-T02a サイト照明: Ambientなし/Hemi1/Directional≥2', pl.filter(l=>l.isAmbientLight).length === 0 &&
    pl.filter(l=>l.isHemisphereLight).length === 1 && pl.filter(l=>l.isDirectionalLight).length >= 2,
    pl.map(l=>l.type).join(','));
  t('F2-T04a サイト toneMapping=ACES', prend && prend.toneMapping === T.ACESFilmicToneMapping, prend && prend.toneMapping);
  for(const [id, b] of Object.entries(BASE.site)){
    const m = V.pageFx.lookProbe(id, b.k);
    t(`F2-T09 サイト輝度 ${id}`, m && within(m, b), fmt(m, b));
  }

  // ---- ゲーム ----
  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 400));
  const D = V.AsteroidRun.debug(), passes = D.composer.passes, S = passes[0].scene, GR = D.composer.renderer;
  t('F2-T01c ゲーム environment(PMREM)', !!(S.environment && S.environment.isTexture));
  const gl = lightsOf(S);
  t('F2-T02b ゲーム照明: Ambientなし/Hemi1/Directional≥2', gl.filter(l=>l.isAmbientLight).length === 0 &&
    gl.filter(l=>l.isHemisphereLight).length === 1 && gl.filter(l=>l.isDirectionalLight).length >= 2,
    gl.map(l=>l.type).join(','));

  // F2-T03: パス順 Render(main) → Bloom → Grade → Render(hud) → Afterimage
  const kind = p=>p.isGradePass ? 'Grade' : (p.constructor.name === 'RenderPass' ? (p.scene === S ? 'Render' : 'Hud') : p.constructor.name);
  const order = passes.map(kind);
  t('F2-T03 パス順', order.join('>') === 'Render>UnrealBloomPass>Grade>Hud>AfterimagePass', order.join('>'));
  t('F2-T04b ゲーム R.toneMapping=None(二重適用なし)', GR.toneMapping === T.NoToneMapping, GR.toneMapping);

  // CON-05
  const rp = D.reticleProbe();
  t('F2-T05 CON-05 レティクル材質不変', rp && rp.color === 0x00f0ff && rp.opacity === .12 && rp.additive,
    rp && `color=${rp.color.toString(16)} op=${rp.opacity} add=${rp.additive}`);
  const dRGB = rp ? Math.max(...rp.rgb.map((v, i)=>Math.abs(v - BASE.reticleRGB[i]))) : 99;
  t('F2-T06 CON-05 黒背景上の画素が現行と一致(±3)', dRGB <= 3, rp && `rgb=${rp.rgb} 基準=${BASE.reticleRGB}`);
  let inHud = false;
  if(D.reticle){ let p = D.reticle; while(p.parent) p = p.parent; inHud = p !== S && passes.some(q=>kind(q) === 'Hud' && q.scene === p); }
  t('F2-T07 レティクルはGradeの後(hudシーン)', inHud);

  // F2-T08: 明るさ(追跡/操縦席)
  for(const v of ['chase', 'cockpit']){
    const m = D.lookProbe(v), b = BASE.game[v];
    t(`F2-T08 ゲーム輝度 ${v}`, m && within(m, b), fmt(m, b));
  }

  // F2-T10: bloom HDR基準 + 発光体がHDR値
  const bl = D.bloom;
  t('F2-T10a bloom 閾値1.0/強度.45', bl && Math.abs(bl.threshold - 1) < .01 && Math.abs(bl.strength - .45) < .01,
    bl && `th=${bl.threshold} st=${bl.strength}`);
  const core = D.cores && D.cores[0], cc = core && core.material.color;
  t('F2-T10b コアの色がHDR(>1)', cc && Math.max(cc.r, cc.g, cc.b) > 1, cc && [cc.r, cc.g, cc.b].map(x=>x.toFixed(2)).join(','));

  // F2-T11: 機体外板の emissive = 0
  let hullEm = null;
  D.shipObj.traverse(o=>{ if(o.isMesh && o.material.isMeshStandardMaterial) hullEm = o.material.emissive.getHex(); });
  t('F2-T11 外板emissive=0', hullEm === 0, 'emissive=' + (hullEm === null ? 'なし' : hullEm.toString(16)));

  // F2-T12: draw call 予算
  GR.info.autoReset = false; GR.info.reset(); D.composer.render();
  const calls = GR.info.render.calls; GR.info.autoReset = true;
  const cap = V.isTouch ? 140 : 155;   // SPEC-09d改訂: PC L0 は影パス分を加算
  t('F2-T12 draw calls≤' + cap, calls <= cap, 'calls=' + calls);

  // 岩の識別子(phase3 LIGHT 改訂の前提)
  t('F2-T13 岩に userData.isRock', D.asts.every(m=>m.userData.isRock === true));
  V.AsteroidRun.stop(); V.closeLayer();

  window.__PF2RESULTS = R;
  console.table(R);
  return R;
})();
