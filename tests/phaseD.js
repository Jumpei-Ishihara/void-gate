/* Phase D (SPEC-07d SP/アクセシビリティ/性能) 受け入れテスト */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, G = V && V.Guide, Tl = V && V.Tl;
  t('H-01 VG', !!G && typeof G._forceReduced === 'function');
  if(!G){ window.__PDRESULTS = R; console.table(R); return R; }

  // ---- D-02: SP軽量化の構造(実行環境に応じた分岐が入っていること) ----
  const rocks = G.stage('flight').rocks;
  t('D-02 岩数のデバイス分岐', rocks.length === (V.isTouch ? 8 : 12), 'rocks='+rocks.length);
  t('D-02b ページブルーム分岐', V.isTouch ? !V.pageFx.bloom : !!V.pageFx.bloom);

  // ---- D-03: reduced-motion縮退(テストフックで強制) ----
  const info = G.info(), f = info.find(c=>c.id === 'flight');
  G._forceReduced(true);
  Tl._setT(f.t0 + (f.t1-f.t0)*.1); Tl.update(.016);   // 章序盤でも
  const allLit = document.querySelectorAll('#ch-flight .ch-line.lit').length === 3;
  const visible = G.stage('flight').group.visible;
  const shipScaleA = G.stage('flight').ship.scale.x;
  Tl._setT(f.t0 + (f.t1-f.t0)*.9); Tl.update(.016);   // 章終盤でも同じ完成形
  const shipScaleB = G.stage('flight').ship.scale.x;
  G._forceReduced(false);
  t('D-03 縮退時: 全行即時点灯+静的表示', allLit && visible && Math.abs(shipScaleA - shipScaleB) < .001,
    `lit3=${allLit} scale ${shipScaleA.toFixed(2)}=${shipScaleB.toFixed(2)}`);
  G._forceReduced(null);
  Tl._setT(0); Tl.update(.016);

  // ---- D-04: aria ----
  t('D-04 装飾canvasのaria-hidden',
    document.getElementById('space').getAttribute('aria-hidden') === 'true'
    && document.getElementById('game-canvas').getAttribute('aria-hidden') === 'true'
    && document.getElementById('wave-canvas').getAttribute('aria-hidden') === 'true');
  const focusables = document.querySelectorAll('#ch-launch a, #ch-launch button, #contact input, #contact textarea, #contact button');
  t('D-04b CTA/フォームがTab到達可能', focusables.length >= 5, 'focusables='+focusables.length);

  // ---- D-05: 性能(スクロール中のページ合成) ----
  const samples = [];
  for(const k of [.1, .3, .5, .7, .9]){
    Tl._setT(k); Tl.update(.016);
    const t0 = performance.now();
    for(let i = 0; i < 30; i++){ Tl.update(.016); V.pageFx.composer.render(); }
    samples.push((performance.now() - t0)/30);
  }
  const worst = Math.max(...samples);
  t('D-05 全域フレーム予算', worst < 12, 'worst='+worst.toFixed(1)+'ms @5点');

  window.__PDRESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[PhaseD] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
