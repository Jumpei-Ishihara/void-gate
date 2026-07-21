/* Phase 1 (SPEC-01 Audio / SPEC-02 Bloom) 受け入れテスト
 * 実行方法: ゲームページ上で fetch('tests/phase1.js').then(r=>r.text()).then(eval)
 * 前提: index.html が window.VG = {SoundEngine, AsteroidRun, SignalGame, openLayer, closeLayer} を公開していること
 * 結果: window.__P1RESULTS に [{id, pass, detail}] を格納し、コンソールにサマリを出す
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;

  // ---- 存在チェック(ハーネス) ----
  t('H-01 VG公開', !!V, V ? 'ok' : 'window.VG がない');
  if(!V){ window.__P1RESULTS = R; console.table(R); return R; }
  const SE = V.SoundEngine;

  // ---- SPEC-01 SoundEngine ----
  t('AUD-01 API表面', SE && ['ensure','gun','explosion','impact','coreGet','ui',
    'engineStart','engineSpeed','engineStop','setMute','toggleMute','stopAll']
    .every(k => typeof SE[k] === 'function'));   // beatOscはSPEC-08aで撤去

  let ctxOk = false, ctxState = 'none';
  try{ SE.ensure(); ctxOk = !!SE._test().ctx; ctxState = SE._test().ctx?.state; }catch(e){ ctxState = 'throw:'+e.message; }
  t('AUD-02 ctx生成', ctxOk, 'state='+ctxState);   // 自動化環境ではsuspended容認

  // 連射: 20連打で例外なし・ボイス上限8
  let rapidOk = true, maxV = 0;
  try{ for(let i=0;i<20;i++){ SE.gun(); maxV = Math.max(maxV, SE._test().voices); } }
  catch(e){ rapidOk = false; }
  t('AUD-03/12 連射+上限', rapidOk && maxV <= 8, 'maxVoices='+maxV);

  // 爆発: 半径で低域フィルタが変わる
  SE.explosion(0.5); const f1 = SE._test().lastSfx;
  SE.explosion(3.0); const f2 = SE._test().lastSfx;
  t('AUD-04 半径連動', f1 && f2 && f1.type==='explosion' && f2.type==='explosion' && f2.lpf < f1.lpf,
    `lpf small=${f1&&f1.lpf} big=${f2&&f2.lpf}`);

  // 被弾: critical で警告音付き
  SE.impact(false); const i1 = SE._test().lastSfx;
  SE.impact(true);  const i2 = SE._test().lastSfx;
  t('AUD-05 CRITICAL警告', i1.type==='impact' && !i1.warn && i2.warn === true);

  SE.coreGet(); t('AUD-06 コア取得', SE._test().lastSfx.type === 'coreGet');

  // エンジン: 速度でピッチ変化
  SE.engineStart(); SE.engineSpeed(110); const e1 = SE._test().engineFreq;
  SE.engineSpeed(480); const e2 = SE._test().engineFreq;
  t('AUD-07 速度連動', e1 > 0 && e2 > e1, `f110=${e1} f480=${e2}`);
  SE.engineStop();

  // ミュート: 反映+永続化
  const m0 = SE.muted; SE.setMute(true);
  t('AUD-09 mute保存', SE.muted === true && localStorage.getItem('vg-mute') === '1'
    && SE._test().masterGain === 0);
  SE.setMute(m0);

  // stopAll
  SE.gun(); SE.stopAll();
  t('AUD-11 stopAll', SE._test().voices === 0 && !SE._test().engineOn);

  // ---- ゲーム統合 ----
  V.openLayer('asteroid');
  V.AsteroidRun.menu();
  // LAUNCH相当
  document.querySelector('#g-start') && (V.SoundEngine._test().lastSfx = null);
  V.AsteroidRun.debug || t('H-02 AsteroidRun.debug公開', false, 'debug() がない');
  let D = null;
  try{ D = V.AsteroidRun.debug(); }catch(e){}
  // start はメニューUI経由(実挙動): g-start をクリック
  const gs = document.getElementById('g-start'); if(gs) gs.click();
  await new Promise(r=>setTimeout(r, 400));
  D = V.AsteroidRun.debug();
  t('H-03 ゲーム起動', !!(D && D.playing), 'playing='+(D&&D.playing));

  V.AsteroidRun.fire();
  const fx = SE._test().lastSfx;
  // 命中時は gun→explosion の順で発音するため、最後の記録はどちらでも正
  t('AUD-03 fire統合', fx && ['gun','explosion','noCore'].includes(fx.type), 'last='+(fx&&fx.type));

  // ---- SPEC-02 Bloom ----
  const names = (D.composer.passes||[]).map(p=>p.constructor.name);
  const iR = names.indexOf('RenderPass'), iB = names.indexOf('UnrealBloomPass'), iA = names.indexOf('AfterimagePass');
  t('BLM-01/02 パス順序', iR===0 && iB===1 && iA===2, names.join('→'));
  t('BLM-03 threshold', D.bloom && D.bloom.threshold >= .4 && D.bloom.threshold <= .8,
    'th='+(D.bloom&&D.bloom.threshold));
  t('BLM-04 SP解像度係数', typeof D.bloomRes === 'number' && (D.isTouch ? D.bloomRes === .5 : D.bloomRes === 1),
    `isTouch=${D.isTouch} res=${D.bloomRes}`);

  // ---- 性能計測 ----
  // rAF計測(可視タブ時)。非表示タブではrAFが発火しないため5秒で打ち切り、
  // composer.render()の直接計測にフォールバックする
  const frames = [];
  await new Promise(res=>{
    const deadline = performance.now() + 5000;
    let last = performance.now(), n = 0;
    (function s(){ const now = performance.now(); frames.push(now-last); last = now;
      if(++n < 180 && now < deadline) requestAnimationFrame(s); else res(); })();
    setTimeout(res, 5200);   // rAF完全停止時の保険
  });
  if(frames.length >= 60){
    frames.sort((a,b)=>a-b);
    const avg = frames.reduce((a,b)=>a+b,0)/frames.length, p95 = frames[Math.floor(frames.length*.95)];
    t('PERF フレーム時間', avg < 20 && p95 < 34, `rAF avg=${avg.toFixed(1)}ms p95=${p95.toFixed(1)}ms`);
  }else{
    const t0 = performance.now();
    for(let i = 0; i < 60; i++) D.composer.render();
    const per = (performance.now() - t0)/60;
    t('PERF フレーム時間', per < 20, `render直計測 avg=${per.toFixed(1)}ms (非表示タブfallback)`);
  }

  // ---- 終了処理 ----
  V.closeLayer();
  t('AUD-11 closeLayer後', SE._test().voices === 0 && !SE._test().engineOn);

  window.__P1RESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[Phase1] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
