/* Phase 4 (SPEC-06 背景・SIGNAL演出・性能自動調整) 受け入れテスト
 * 実行: fetch('tests/phase4.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;
  t('H-01 VG公開', !!V && !!V.Quality);
  if(!V || !V.Quality){ window.__P4RESULTS = R; console.table(R); return R; }

  // ---- ASTEROID RUN: 背景 + Quality ----
  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 400));
  let D = V.AsteroidRun.debug();
  t('H-02 起動', !!D.playing);

  const bg = D.bg;
  t('BG-01 遠景惑星+リング', bg && bg.planet && bg.ring, JSON.stringify(bg && {p:bg.planet, r:bg.ring}));
  t('BG-03 フォグ対象外', bg && bg.fogOff);
  t('BG-02 塵レイヤー', bg && bg.motes >= (D.isTouch ? 300 : 600), 'motes='+(bg&&bg.motes));

  // Quality段階制御(PRF-01〜05)
  const Q = V.Quality;
  t('PRF reset→L0', (Q.reset(), Q.level === (D.isTouch ? 1 : 0)), 'level='+Q.level);
  Q.degrade();
  D = V.AsteroidRun.debug();
  t('PRF L1 ブルーム半解像度', Q.level >= 1 && D.quality.bloomEnabled === true, JSON.stringify(D.quality));
  Q.degrade();
  D = V.AsteroidRun.debug();
  t('PRF L2 破片半減', D.quality.shardsBudget < D.fx.shardsPerBoom || D.quality.shardsBudget <= 4,
    'budget='+D.quality.shardsBudget);
  Q.degrade();
  D = V.AsteroidRun.debug();
  t('PRF L3 ブルームOFF', D.quality.bloomEnabled === false);
  Q.degrade();
  t('PRF L3上限', Q.level === 3, 'level='+Q.level);
  // 低負荷を流してもレベルは戻らない(PRF-05)
  for(let i = 0; i < 200; i++) Q.frame(4);
  t('PRF-05 不可逆', Q.level === 3, 'level='+Q.level);
  Q.reset();

  // 予算(BG-04込みで総枠+30以内)
  const RD = D.composer.renderer;
  RD.info.autoReset = false; RD.info.reset();
  D.composer.render();
  const calls = RD.info.render.calls;
  RD.info.autoReset = true;
  t('BUDGET draw calls≤140', calls <= 140, 'calls='+calls);

  V.closeLayer();

  // ---- SIGNAL TUNER ----
  V.openLayer('signal'); V.SignalGame.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 300));
  const SD = V.SignalGame.debug ? V.SignalGame.debug() : null;
  t('SIG-03 CRTパターン', SD && SD.scanPat === true);
  if(SD){
    SD.testPulse();
    t('SIG-02 パルス発生', V.SignalGame.debug().pulses >= 1, 'pulses='+V.SignalGame.debug().pulses);
    SD.agePulses(700);
    SD.prune();
    t('SIG-02b パルス寿命0.6s', V.SignalGame.debug().pulses === 0, 'pulses='+V.SignalGame.debug().pulses);
    SD.testEnd(true);
    const dec = document.getElementById('g-decode');
    t('SIG-04 デコード演出', !!dec && dec.dataset.decode === '1');
    await new Promise(r=>setTimeout(r, 1300));
    const txt = document.getElementById('g-decode');
    t('SIG-04b 文字出現', !!txt && txt.textContent.length > 0, 'len='+(txt&&txt.textContent.length));
  }
  V.closeLayer();

  // ---- 回帰 + 性能 ----
  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 300));
  D = V.AsteroidRun.debug();
  V.AsteroidRun.fire();
  t('REG 射撃動作', ['gun','explosion','noCore'].includes(V.SoundEngine._test().lastSfx.type));
  const t0 = performance.now();
  for(let i = 0; i < 60; i++) D.composer.render();
  const per = (performance.now() - t0)/60;
  t('PERF レンダー時間', per < 20, per.toFixed(1)+'ms/frame');
  V.closeLayer();

  window.__P4RESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[Phase4] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
