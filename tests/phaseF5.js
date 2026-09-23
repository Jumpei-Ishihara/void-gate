/* Phase F5 (SPEC-09e スコア体系: ニアミス・コンボ・撃破点 / 手応え) 受け入れテスト
 * 実行: fetch('tests/phaseF5.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, T = V && V.THREE, A = V && V.Assets, SE = V && V.SoundEngine;
  t('H-01', !!V && !!T);
  if(!V){ window.__PF5RESULTS = R; console.table(R); return R; }

  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 300));
  const D = V.AsteroidRun.debug(), st = D.stRef;
  const ok = typeof D.collideSd === 'function' && typeof D.addScore === 'function' && typeof D.score === 'function';
  t('H-02 debug API(collideSd/addScore/score)', ok);
  if(!ok){ V.AsteroidRun.stop(); V.closeLayer(); window.__PF5RESULTS = R; console.table(R); return R; }

  // 機体を原点に固定し、岩0だけを使う
  const ship = D.shipObj; ship.position.set(0, 0, 0); ship.rotation.set(0, 0, 0); ship.updateMatrixWorld();
  const sph = A.shipSpheresWorld(ship);
  const m0 = D.asts[0];
  const isolate = ()=>{ D.asts.forEach((m, i)=>{ if(i){ m.position.set(0, 0, -5000 - i*50); } });
    m0.visible = true; m0.quaternion.identity(); m0.userData.nm = false; m0.userData.r = 3; m0.scale.setScalar(3); };
  // 通過(z: -8 → +2, sd=10)で表面から目標のすき間になる x を二分探索
  const xFor = (target, sd = 10)=>{ let lo = 0, hi = 60;
    for(let k = 0; k < 40; k++){ const mid = (lo + hi)/2; m0.position.set(mid, 0, 2); m0.updateMatrixWorld();
      if(A.clearance(m0, sph, sd) < target) lo = mid; else hi = mid; }
    return (lo + hi)/2; };
  const reset = ()=>{ st.score = 0; st.combo = 0; st.mult = 1; st.comboT = 0; st.inv = 0;
    for(const k in st.tally){ st.tally[k].n = 0; if('pts' in st.tally[k]) st.tally[k].pts = 0; } };

  // F5-T01: 表面から1.5で通過 → 1回だけ +150
  isolate(); reset();
  let x = xFor(1.5); m0.position.set(x, 0, 2);
  D.collideSd(performance.now(), 10);
  const n1 = st.tally.near.n, s1 = st.score;
  D.collideSd(performance.now(), 10);
  t('F5-T01 ニアミス(1.5)で+150・同じ岩は1回', n1 === 1 && s1 === 150 && st.tally.near.n === 1,
    `n=${n1}→${st.tally.near.n} score=${s1} x=${x.toFixed(2)}`);
  t('F5-T12a 風切り音', SE.muted || SE._test().lastSfx && SE._test().lastSfx.type === 'whoosh', SE._test().lastSfx && SE._test().lastSfx.type);

  // F5-T02: 4.0 離れ → なし / 接触 → 被弾でニアミスなし
  isolate(); reset();
  x = xFor(4.0); m0.position.set(x, 0, 2); D.collideSd(performance.now(), 10);
  const far = st.tally.near.n;
  isolate(); reset();
  const sh0 = st.shields; x = xFor(-.5); m0.position.set(x, 0, 2); D.collideSd(performance.now(), 10);
  const hitNoNear = st.shields === sh0 - 1 && st.tally.near.n === 0;
  st.shields = sh0; st.inv = 0;
  t('F5-T02 4.0はなし/接触は被弾のみ', far === 0 && hitNoNear, `far=${far} hit=${hitNoNear}`);

  // F5-T03: 無敵中は成立しない
  isolate(); reset();
  x = xFor(1.5); m0.position.set(x, 0, 2); D.collideSd(performance.now(), 10, true);
  t('F5-T03 無敵中はニアミスなし', st.tally.near.n === 0);

  // F5-T04: 倍率段階
  reset();
  const at = {};
  for(let i = 1; i <= 36; i++){ D.addScore('near', 0); if([4, 5, 10, 20, 35].includes(i)) at[i] = st.mult; }
  t('F5-T04 倍率 5→1.5 / 10→2 / 20→3 / 35→4', at[4] === 1 && at[5] === 1.5 && at[10] === 2 && at[20] === 3 && at[35] === 4, JSON.stringify(at));
  t('F5-T12b 倍率上昇音', SE.muted || ['combo', 'whoosh'].includes(SE._test().lastSfx && SE._test().lastSfx.type));

  // F5-T05: 4秒で途切れる / 被弾で0
  reset(); D.addScore('near', 0); D.addScore('near', 0);
  D.stepCombo(3.9); const alive = st.combo === 2;
  D.stepCombo(.2); const dead = st.combo === 0 && st.mult === 1;
  reset(); for(let i = 0; i < 6; i++) D.addScore('near', 0);
  const shB = st.shields; D.testHit(); const hitReset = st.combo === 0 && st.mult === 1;
  st.shields = shB; st.inv = 0;
  t('F5-T05 4秒で途切れる/被弾で0', alive && dead && hitReset, `alive=${alive} dead=${dead} hit=${hitReset}`);

  // F5-T06: 撃破点 = (100+40r)×倍率 / コア回収はコンボ+1・点0
  reset(); for(let i = 0; i < 9; i++) D.addScore('near', 0);   // 次の加算でコンボ10 → ×2
  isolate(); m0.userData.r = 4; m0.position.set(0, 0, -60);
  const before = st.score; D.destroyRock(m0);
  const killPts = st.score - before;
  reset(); const cb = st.combo, sb = st.score; D.testPickup();
  t('F5-T06 撃破点/コア回収', killPts === (100 + 40*4)*2 && st.combo === cb + 1 && st.score === sb,
    `kill=${killPts} 期待=${(100 + 160)*2} coreCombo=${st.combo}`);

  // F5-T07: score() の式
  st.dist = 123.4; st.cores = 3; st.score = 777;
  t('F5-T07 score() = 距離×10+積み上げ+残コア×500', D.score() === Math.floor(123.4*10) + 777 + 1500, D.score());

  // F5-T08: HUD
  D.hud();
  const hudTxt = document.getElementById('game-hud').textContent;
  const src = await fetch('/void-gate/index.html?f5=' + Date.now()).then(r=>r.text());
  const spBlk = (()=>{ const i = src.indexOf('    if(IS_TOUCH){\n      // SP: 短縮ラベル'); const j = src.indexOf('return;', i); return i > 0 ? src.slice(i, j) : ''; })();
  t('F5-T08 HUD(PC: SCORE/倍率, SP: 3行以内)', /SCORE/.test(hudTxt) && (spBlk.match(/ghud-row/g) || []).length <= 3 && /SC/.test(spBlk),
    `pc="${hudTxt.replace(/\s+/g, ' ').slice(0, 70)}" spRows=${(spBlk.match(/ghud-row/g) || []).length}`);

  // F5-T10: ヒットストップ(シミュレーション時間)
  isolate(); reset();
  const it = D.director.items.find(i=>i.kind === 'rock' && i.mesh !== m0);   // testHit が消す岩0以外を追う
  const z0 = it ? it.z : 0;
  D.testHit(); st.inv = 0;
  D.tick(16);
  const z1 = it ? it.z : 0;
  for(let i = 0; i < 8; i++) D.tick(16);
  const z2 = it ? it.z : 0;
  t('F5-T10 ヒットストップ中は進まない/解除後は進む', it && z1 === z0 && z2 > z1, `z ${z0.toFixed(2)} → ${z1.toFixed(2)} → ${z2.toFixed(2)}`);

  // F5-T11: FOVキック
  isolate(); reset(); st.hitStop = 0; st.fovKick = 0;   // 前のニアミスの残りを消してから基準を取る
  D.tick(16); const fovBase = D.fov();
  x = xFor(1.5); m0.position.set(x, 0, 2); D.collideSd(performance.now(), 10);
  D.tick(16); const fovK = D.fov();
  for(let i = 0; i < 30; i++) D.tick(16);
  const fovAfter = D.fov();
  t('F5-T11 FOVキック(+4→戻る)', fovK - fovBase > 3 && fovAfter - fovBase < .8, `base=${fovBase.toFixed(1)} kick=${fovK.toFixed(1)} after=${fovAfter.toFixed(1)}`);

  // F5-T12c: 音の強さ
  const k = SE._test().intensity;
  t('F5-T12c 音の強さ 0〜1', typeof k === 'number' && k >= 0 && k <= 1, k);

  // F5-T13: 振動(設定OFFなら呼ばない)
  let calls = 0; const orig = Object.getOwnPropertyDescriptor(Navigator.prototype, 'vibrate');
  Object.defineProperty(navigator, 'vibrate', {value: ()=>{ calls++; return true; }, configurable: true});
  localStorage.setItem('vg-vibe', '0'); D.buzz(70); const off = calls;
  localStorage.setItem('vg-vibe', '1'); D.buzz(70); const on = calls;
  delete navigator.vibrate; if(orig) Object.defineProperty(Navigator.prototype, 'vibrate', orig);
  const menuHas = (V.AsteroidRun.menu(), !!document.getElementById('g-vibe'));
  document.getElementById('game-overlay').innerHTML = '';
  t('F5-T13 振動(OFFで呼ばない/ONで呼ぶ・チェックはタッチのみ)', off === 0 && on === 1 && menuHas === V.isTouch, `off=${off} on=${on} menu=${menuHas}`);

  // F5-T14: CON-05
  const rp = D.reticleProbe();
  t('F5-T14 CON-05 レティクル画素不変', rp && rp.rgb.join() === '0,126,134' && rp.opacity === .12, rp && rp.rgb.join());

  // F5-T09: 結果画面の内訳(最後に大破させる)
  reset(); st.dist = 50; st.score = 0; D.addScore('near', 150); D.addScore('kill', 180); st.cores = 1;
  const expect = D.score();
  st.shields = 0; st.inv = 0; D.testHit();
  const ov = document.getElementById('game-overlay').textContent;
  const items = ['距離', 'ニアミス', '撃破', '残コア', '最大コンボ', 'セクター'];
  t('F5-T09 結果画面の内訳6項目+合計', items.every(s=>ov.includes(s)) && ov.includes(expect.toLocaleString()),
    `expect=${expect} 欠落=${items.filter(s=>!ov.includes(s)).join(',')}`);

  V.AsteroidRun.stop(); V.closeLayer();
  window.__PF5RESULTS = R;
  console.table(R);
  return R;
})();
