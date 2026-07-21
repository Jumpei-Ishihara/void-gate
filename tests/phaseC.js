/* Phase C (SPEC-07c 導入/出口章・HUD/コピー統一) 受け入れテスト */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;
  t('H-01 VG', !!V && !!V.Guide);
  if(!V){ window.__PCRESULTS = R; console.table(R); return R; }

  // ---- 構成(C-01/07): 章の順序と旧セクション廃止 ----
  const order = ['hero','ch-sortie','ch-flight','ch-weapons','ch-survival','gallery','ch-launch','contact'];
  const tops = order.map(id=>{ const el = document.getElementById(id); return el ? el.offsetTop : -1; });
  t('C-01 全章存在', tops.every(v=>v >= 0), JSON.stringify(tops));
  t('C-01b 章順序', tops.every((v,i)=>i === 0 || v >= tops[i-1]), tops.join('<'));
  t('C-07 旧セクション廃止', !document.getElementById('mission') && !document.getElementById('tech'));
  t('C-01c GATEボタン残置', !!document.getElementById('btn-explore'));   // CONTACT CTAはSPEC-08aで撤去

  // ---- SORTIE章(SPEC-08cでBRIEFINGから改称・射出化) ----
  const info = V.Guide.info();
  t('C-02 sortie登録', info.length === 4 && info[0].id === 'sortie', info.map(d=>d.id).join(','));

  // ---- NAVIGATION(C-03) ----
  const gal = document.getElementById('gallery').textContent;
  t('C-03 CLEARANCE化', gal.includes('CLEARANCE')
    && document.querySelectorAll('#gallery .planet-chip').length === 3);

  // ---- LAUNCH DECK(C-04) ----
  localStorage.setItem('vg-ast-best', '12345');
  V.closeLayer();   // renderBest再実行経路
  t('C-04 ベスト表示', document.getElementById('best-ast').textContent === '12,345',
    document.getElementById('best-ast').textContent);
  const qr = document.getElementById('quickref');
  t('C-04b 早見表1枚', qr.querySelectorAll('.card').length === 1 && qr.querySelectorAll('table').length === 1);
  t('C-04c 早見表の出し分け', V.isTouch ? qr.textContent.includes('ドラッグ') : qr.textContent.includes('左クリック'));
  // CTA起動
  document.getElementById('deck-explore').click();
  const opened = document.getElementById('game-layer').classList.contains('on')
    && document.querySelector('.gtitle') && document.querySelector('.gtitle').textContent === 'ASTEROID RUN';
  V.closeLayer();
  t('C-04d 発進口CTA', opened);

  // ---- HUD章表記(C-05) ----
  document.documentElement.style.scrollBehavior = 'auto';
  const max = document.documentElement.scrollHeight - innerHeight;
  const secAt = id=>{
    const el = document.getElementById(id);
    window.scrollTo(0, Math.max(0, el.offsetTop + 10));
    dispatchEvent(new Event('scroll'));
    return document.getElementById('hud-status').textContent;
  };
  const l1 = secAt('ch-flight'), l2 = secAt('ch-launch');
  window.scrollTo(0, 0); dispatchEvent(new Event('scroll'));
  const l0 = document.getElementById('hud-status').textContent;
  t('C-05 章表記連動', l1.includes('02') && l2.includes('LAUNCH DECK') && l0.includes('GATE'),
    `${l0} | ${l1} | ${l2}`);

  // ---- nav(C-06) ----
  const navHrefs = [...document.querySelectorAll('header nav a')].map(a=>a.getAttribute('href'));
  t('C-06 ナビ差替え', navHrefs.includes('#ch-flight') && navHrefs.includes('#ch-launch')
    && !navHrefs.includes('#mission'), navHrefs.join(' '));

  // ---- 通信ターミナル(SPEC-08a REM-04) ----
  const ct = document.getElementById('contact');
  t('REM-04 通信ターミナル', ct.textContent.includes('通信ターミナル') && !!document.getElementById('send')
    && ct.offsetTop >= document.getElementById('ch-launch').offsetTop);

  // ---- 回帰: phaseA + phaseB(上位スイートが既に流している場合はスキップ) ----
  const preset = !!window.__SKIP_NESTED_REG;
  if(preset){
    t('REG phaseA/B', true, 'skipped (上位スイートで実施)');
  }else{
    // Aはフル回帰(phase1〜4込み)、Bは入れ子回帰を抑止して重複を避ける
    for(const n of ['A','B']){
      if(n === 'B') window.__SKIP_NESTED_REG = true;
      const src = await fetch(`/void-gate/tests/phase${n}.js?c=1`).then(r=>r.text());
      await eval(src);
      await new Promise(r=>setTimeout(r, 300));
    }
    delete window.__SKIP_NESTED_REG;
    t('REG phaseA', window.__PARESULTS && window.__PARESULTS.every(x=>x.pass),
      window.__PARESULTS ? window.__PARESULTS.filter(x=>!x.pass).map(x=>x.id).join(',') : 'none');
    t('REG phaseB', window.__PBRESULTS && window.__PBRESULTS.every(x=>x.pass),
      window.__PBRESULTS ? window.__PBRESULTS.filter(x=>!x.pass).map(x=>x.id).join(',') : 'none');
  }
  window.__PCRESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[PhaseC] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
