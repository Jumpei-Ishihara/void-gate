/* Phase F7 (SPEC-09g 称号・デイリーシード・履歴・共有・文書整合) 受け入れテスト
 * 実行: fetch('tests/phaseF7.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, M = V && V.Meta;
  t('H-01 VG.Meta', !!M && typeof M.rankOf === 'function' && typeof M.dailySeed === 'function');
  if(!M){ window.__PF7RESULTS = R; console.table(R); return R; }
  const LSK = ['vg-ast-best', 'vg-ast-rank', 'vg-ast-hist'];
  const saved = Object.fromEntries(LSK.map(k=>[k, localStorage.getItem(k)]));

  // F7-T01: 称号
  const rk = [1, 3, 4, 6].map(M.rankOf);
  t('F7-T01 称号 1/3/4/6 → CADET/PILOT/ACE/VOID RUNNER', rk.join() === 'CADET,PILOT,ACE,VOID RUNNER', rk.join());

  // F7-T03a: デイリーシード
  const d1 = M.dailySeed(new Date(2026, 8, 23)), d2 = M.dailySeed(new Date(2026, 8, 23, 23, 59)), d3 = M.dailySeed(new Date(2026, 8, 24));
  t('F7-T03a 同じ日付=同じシード/翌日=別', d1.seed === d2.seed && d1.seed !== d3.seed && d1.label === '2026-09-23', `${d1.label}:${d1.seed} ${d3.label}:${d3.seed}`);

  // F7-T04: 日付ごとのベスト + 7日より古いキーの削除
  const key = dd=>'vg-ast-daily-' + M.dailySeed(dd).label.replace(/-/g, '');
  const now = new Date(2026, 8, 23), old = new Date(2026, 8, 15), recent = new Date(2026, 8, 20);
  localStorage.setItem(key(old), '100'); localStorage.setItem(key(recent), '200');
  M.cleanupDaily(now);
  t('F7-T04 古い日付キー(8日前)を削除/3日前は残す', localStorage.getItem(key(old)) === null && localStorage.getItem(key(recent)) === '200');
  localStorage.removeItem(key(recent));

  // F7-T05: 履歴は5件・降順
  localStorage.removeItem('vg-ast-hist');
  [500, 3000, 1200, 800, 9000, 50, 4000].forEach((s, i)=>M.saveResult({score: s, sector: 1 + (i % 5), course: 'random'}));
  const hist = JSON.parse(localStorage.getItem('vg-ast-hist') || '[]');
  t('F7-T05 履歴 ≤5件・スコア降順', hist.length === 5 && hist.every((h, i)=>i === 0 || hist[i-1].score >= h.score) && hist[0].score === 9000,
    hist.map(h=>h.score).join(','));

  // F7-T07: 共有文面
  const txt = M.shareText({score: 12340, sector: 4, course: 'daily', label: '2026-09-23'});
  t('F7-T07 共有文面(スコア/セクター/称号/URL/DAILY)', /12,340/.test(txt) && /SECTOR 04/.test(txt) && /ACE/.test(txt) &&
    /DAILY 2026-09-23/.test(txt) && /https:\/\/jumpei-ishihara\.github\.io\/void-gate\//.test(txt), txt);

  // ---- ゲーム: DAILY で開始 → 大破 → 結果画面 ----
  const playTo = async (course, sector)=>{
    V.openLayer('asteroid'); V.AsteroidRun.menu();
    const chip = document.querySelector(`.cchip[data-c="${course}"]`); if(chip) chip.click();
    document.getElementById('g-start').click();
    await new Promise(r=>setTimeout(r, 300));
    const D = V.AsteroidRun.debug();
    return D;
  };
  let D = await playTo('daily');
  const seedA = D.director && D.director.seed;
  V.AsteroidRun.stop(); V.closeLayer();
  D = await playTo('daily');
  const seedB = D.director && D.director.seed;
  t('F7-T03b DAILYは本日のシードで同一コース', seedA === M.dailySeed().seed && seedB === seedA, `${seedA} / ${seedB}`);
  // 到達セクター4(ACE)で大破
  localStorage.setItem('vg-ast-rank', 'CADET');
  D.director.t = 125; D.tick(16); D.stRef.dist = 100;
  D.stRef.shields = 0; D.stRef.inv = 0; D.testHit();
  const ov = document.getElementById('game-overlay');
  t('F7-T02a 結果画面に称号・最高称号の保存', /ACE/.test(ov.textContent) && localStorage.getItem('vg-ast-rank') === 'ACE', `rank=${localStorage.getItem('vg-ast-rank')}`);
  t('F7-T04b DAILYのベストを日付キーに保存', localStorage.getItem(key(new Date())) !== null, key(new Date()));
  t('F7-T05b 結果画面に履歴', /HISTORY|履歴/.test(ov.textContent) && ov.querySelectorAll('.ghist li').length >= 1);

  // F7-T06: 共有(Web Share あり → 呼ぶ / なし → クリップボード + COPIED)
  let shared = null, copied = null;
  const origShare = navigator.share, origClip = navigator.clipboard;
  Object.defineProperty(navigator, 'share', {value: async d=>{ shared = d; }, configurable: true});
  document.getElementById('g-share').click();
  await new Promise(r=>setTimeout(r, 50));
  Object.defineProperty(navigator, 'share', {value: undefined, configurable: true});
  Object.defineProperty(navigator, 'clipboard', {value: {writeText: async s=>{ copied = s; }}, configurable: true});
  document.getElementById('g-share').click();
  await new Promise(r=>setTimeout(r, 50));
  const copiedShown = /COPIED/.test(document.getElementById('g-share').textContent);
  delete navigator.share; delete navigator.clipboard;
  t('F7-T06 SHARE(Web Share/クリップボード)', shared && /SCORE/.test(shared.text) && copied && /SCORE/.test(copied) && copiedShown,
    `share=${!!shared} clip=${!!copied} copied=${copiedShown}`);

  // F7-T09: 結果画面は内部スクロールで全ボタンに届く
  const gs = ov.querySelector('.gscreen');
  gs.scrollTop = 1e6;
  const btns = [...ov.querySelectorAll('.gbtns .btn')];
  const inView = btns.length >= 3 && btns.every(b=>{ const r = b.getBoundingClientRect(), g = gs.getBoundingClientRect(); return r.bottom <= g.bottom + 1 && r.top >= g.top - 1; });
  t('F7-T09 結果画面のボタンに到達(内部スクロール)', getComputedStyle(gs).overflowY === 'auto' && inView, `buttons=${btns.length}`);
  V.AsteroidRun.stop(); V.closeLayer();

  // F7-T02b: LAUNCH DECK に称号
  V.renderBest && V.renderBest();
  const bestTxt = document.getElementById('best-ast').textContent;
  t('F7-T02b LAUNCH DECKに称号', /·\s*ACE/.test(bestTxt), bestTxt);

  // F7-T08: localStorage が例外でもゲームが開始・終了できる
  const desc = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {get(){ throw new Error('denied'); }, configurable: true});
  let okLS = true;
  try{
    V.openLayer('asteroid'); V.AsteroidRun.menu(); document.getElementById('g-start').click();
    await new Promise(r=>setTimeout(r, 200));
    const D2 = V.AsteroidRun.debug(); D2.stRef.shields = 0; D2.stRef.inv = 0; D2.testHit();
    okLS = /SHIP LOST/.test(document.getElementById('game-overlay').textContent);
  }catch(e){ okLS = false; }
  if(desc) Object.defineProperty(window, 'localStorage', desc); else delete window.localStorage;
  V.AsteroidRun.stop(); V.closeLayer();
  t('F7-T08 localStorage例外でも開始・終了できる', okLS);

  // F7-T10: 旧仕様の文言が残っていない
  const html = await fetch('/void-gate/index.html?f7=' + Date.now()).then(r=>r.text());
  const readme = await fetch('/void-gate/README.md?f7=' + Date.now()).then(r=>r.text());
  const design = await fetch('/void-gate/DESIGN.md?f7=' + Date.now()).then(r=>r.text());
  const olds = ['速度は時間とともに上昇', '航行距離×10＋残コア×500', 'スコア＝航行距離×10＋残コア'];
  const found = olds.filter(o=>html.includes(o) || readme.includes(o) || design.includes(o));
  t('F7-T10 旧仕様の文言なし', found.length === 0, found.join(' / '));
  // F7-T12(SPEC-16): 資料と実装の整合 — FIREボタンの位置(実装は左下)と、撤去した機能の記述が現行資料に残っていない
  const fb = document.getElementById('fire-btn'), fcs = fb ? getComputedStyle(fb) : null;
  const fireLeft = fcs && parseFloat(fcs.left) < innerWidth/2;
  const wrongPos = [html, readme, design].some(x=>x.includes('右下のFIREボタン') || x.includes('右下サムゾーン'));
  const retired = ['SIGNAL TUNER', '両ゲーム', 'TUNE IN'].filter(o=>readme.includes(o) || design.includes(o));
  t('F7-T12 資料と実装の整合(FIREボタンは左下・撤去機能の記述なし)', fireLeft && !wrongPos && retired.length === 0,
    `左配置=${fireLeft} 右下表記=${wrongPos} 撤去機能=[${retired}]`);
  // F7-T11: JSON-LD
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('');
  t('F7-T11 JSON-LD(VideoGame)にセクター制とスコア体系', /セクター/.test(ld) && /ニアミス/.test(ld) && (()=>{ try{ JSON.parse(ld); return true; }catch(e){ return false; } })());

  // 後片付け(テストで書いた記録を元に戻す)
  LSK.forEach(k=>{ if(saved[k] === null) localStorage.removeItem(k); else localStorage.setItem(k, saved[k]); });
  localStorage.removeItem(key(new Date()));
  V.renderBest && V.renderBest();

  window.__PF7RESULTS = R;
  console.table(R);
  return R;
})();
