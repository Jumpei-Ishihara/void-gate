/* Phase K1 (SPEC-13a 操縦席の物理部品) 受け入れテスト
 * 実行: fetch('tests/phaseK1.js').then(r=>r.text()).then(eval)
 * 非表示タブでも動くよう、時間は debug().tick() で進める
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;
  t('H-01 VG公開', !!V);
  if(!V){ window.__PK1RESULTS = R; console.table(R); return R; }

  V.openLayer('asteroid'); V.AsteroidRun.menu();
  const vc = document.querySelector('.vchip[data-v="cockpit"]'); if(vc) vc.click();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 400));
  const D = V.AsteroidRun.debug(), ck = D.ck;
  t('H-02 起動(操縦席視点)', D.playing && !!ck, 'ck=' + !!ck);
  if(!ck){ V.AsteroidRun.stop(); V.closeLayer(); window.__PK1RESULTS = R; console.table(R); return R; }
  D.stRef.inv = 1e15;   // 被弾で止まらないように

  // K1-T01: 部品の存在と旧部品の不在
  const P = ck.parts, need = ['dash', 'bow', 'glass', 'stickPivot', 'trigger', 'meter', 'radar'];
  const missing = need.filter(k=>!P[k]);
  t('K1-T01 物理部品7点・旧部品なし', missing.length === 0 && ck.legacy.lever === false && ck.legacy.panels === 0,
    `missing=[${missing}] lever=${ck.legacy.lever} panels=${ck.legacy.panels}`);

  // K1-T02: 視界(中央域に不透明部品なし) FOV72/84・操縦桿を最大に傾けた状態も
  const m72 = ck.mask(72), m84 = ck.mask(84);
  const sp = P.stickPivot, keepR = [sp.rotation.x, sp.rotation.z];
  sp.rotation.set(-.45, 0, .5); const mTilt = ck.mask(72);
  sp.rotation.set(.45, 0, -.5); const mTilt2 = ck.mask(72);
  sp.rotation.set(keepR[0], 0, keepR[1]);
  t('K1-T02 中央域の不透明部品 0画素', m72.centerPx === 0 && m84.centerPx === 0 && mTilt.centerPx === 0 && mTilt2.centerPx === 0,
    `72°=${m72.centerPx} 84°=${m84.centerPx} 傾き=${mTilt.centerPx}/${mTilt2.centerPx}`);

  // K1-T03: 不透明部品の占有率
  t('K1-T03 占有率 ≤21.6%', m72.coverPct <= 21.6, `cover=${m72.coverPct}%`);

  // K1-T04: 操縦桿は画面下中央
  t('K1-T04 操縦桿の見かけ中心 |x|≤.08', Math.abs(m72.stickNdcX) <= .08, `x=${m72.stickNdcX}`);

  // K1-T05: 入力に比例して傾く(右→z負 / 下→x正。現行と同じ対応)
  const W = innerWidth, H = innerHeight;
  V.AsteroidRun.input(W, H/2); for(let i = 0; i < 60; i++) D.tick(16);
  const sR = ck.stick();
  V.AsteroidRun.input(W/2, H); for(let i = 0; i < 60; i++) D.tick(16);
  const sD = ck.stick();
  V.AsteroidRun.input(W/2, H/2); for(let i = 0; i < 60; i++) D.tick(16);
  t('K1-T05 入力に比例して傾く', sR.z < 0 && Math.abs(Math.abs(sR.z) - .5) <= .05 && sD.x > 0 && Math.abs(sD.x - .45) <= .05,
    `右: z=${sR.z.toFixed(3)} / 下: x=${sD.x.toFixed(3)}`);

  // K1-T06: 発射でトリガーが引かれ、戻る
  D.stRef.cores = 5;
  await new Promise(r=>setTimeout(r, 200));   // 連射間隔(160ms)を空ける
  const base = ck.stick().trig;
  V.AsteroidRun.fire(); D.tick(16); D.tick(16);
  const pulled = ck.stick().trig;
  for(let i = 0; i < 8; i++) D.tick(16);
  const back = ck.stick().trig;
  t('K1-T06 発射でトリガーが動き戻る', pulled > base + .2 && Math.abs(back - base) < 1e-6,
    `基準=${base.toFixed(2)} 発射=${pulled.toFixed(2)} 120ms後=${back.toFixed(2)}`);

  // K1-T07: メーター表示
  const mv = [];
  for(const s of [110, 300, 480]){ D.stRef.speed = s; ck.drawMeter(true); mv.push(ck.meter()); }
  const ok7 = mv[0].text === '440' && mv[1].text === '1200' && mv[2].text === 'MAX' && mv[2].max &&
    Math.abs(mv[0].frac - 110/480) < 1e-3 && Math.abs(mv[1].frac - 300/480) < 1e-3 && mv[2].frac === 1 &&
    mv[0].thr === 23 && mv[1].thr === 63 && mv[2].thr === 100;
  t('K1-T07 メーター(値/MAX/弧/THR)', ok7, mv.map(m=>`${m.text}/${m.frac.toFixed(3)}/${m.thr}`).join(' '));

  // K1-T08: CON-05
  const rp = D.reticleProbe();
  const dRGB = rp ? Math.max(...rp.rgb.map((v, i)=>Math.abs(v - [0, 126, 134][i]))) : 99;
  t('K1-T08 CON-05 レティクル不変', rp && rp.color === 0x00f0ff && rp.opacity === .12 && rp.additive && dRGB <= 3,
    rp && `color=${rp.color.toString(16)} op=${rp.opacity} rgb=${rp.rgb}`);

  // K1-T09: 材質と輝度
  const mats = ck.materials, metalOk = ['dash', 'frame', 'metal'].every(k=>mats[k] && mats[k].metalness >= .7 && mats[k].envMapIntensity > 0);
  const B = {mean:.0827, rockMean:.214};
  const lp = D.lookProbe('cockpit');
  t('K1-T09 材質(環境反射・金属度)と輝度', metalOk && lp.blownPct <= .1 && lp.rockMean >= B.rockMean*.9 && lp.mean >= B.mean*.5,
    `metal=${metalOk} 白飛び=${lp.blownPct}% 岩=${lp.rockMean} 平均=${lp.mean}`);

  // K1-T10: 予算
  const RD = D.composer.renderer;
  RD.info.autoReset = false; RD.info.reset(); D.composer.render();
  const calls = RD.info.render.calls; RD.info.autoReset = true;
  const cap = D.isTouch ? 140 : 155;
  D.stRef.speed = D.director.sector.cap;   // 速度一定(表示値が変わらない)
  D.tick(16); D.tick(16);
  const r0 = ck.redraws.meter;
  for(let i = 0; i < 60; i++){ D.stRef.speed = D.director.sector.cap; D.tick(16); }
  const dr = ck.redraws.meter - r0;
  t('K1-T10 予算(draw call・メッシュ・三角形・再描画)', calls <= cap && ck.hwMeshes() <= 24 && ck.tris() <= 12000 && dr <= 1,
    `calls=${calls}/${cap} hw=${ck.hwMeshes()} tris=${ck.tris()} meter再描画=${dr}`);

  V.AsteroidRun.stop(); V.closeLayer();
  window.__PK1RESULTS = R; console.table(R);
  return R;
})();
