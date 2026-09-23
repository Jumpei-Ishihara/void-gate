/* Phase F3 (SPEC-09c パターンスポナー・公平性検証・セクター制) 受け入れテスト
 * 実行: fetch('tests/phaseF3.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, SP = V && V.Spawner;
  t('H-01 VG.Spawner', !!SP && typeof SP.create === 'function' && typeof SP.validate === 'function' && typeof SP.director === 'function');
  if(!SP){ window.__PF3RESULTS = R; console.table(R); return R; }
  const {FX, FY} = SP.CONST;

  // F3-T01: 同じシード → 同じパターン列
  const seq = seed=>{ const s = SP.create(seed); const out = [];
    for(let i = 0; i < 50; i++) out.push(s.next({sector: SP.sectorAt(i*9), speed: 110 + i*10}));
    return JSON.stringify(out); };
  t('F3-T01 シード再現性(50パターン)', seq(123) === seq(123) && seq(123) !== seq(124));

  // F3-T02: 配置に Math.random を使わない(ソース検査)
  const src = await fetch('/void-gate/index.html?f3=' + Date.now()).then(r=>r.text());
  const blk = (a, b)=>{ const i = src.indexOf(a), j = src.indexOf(b, i); return i >= 0 && j > i ? src.slice(i, j) : ''; };
  const spBlock = blk('/* ---------- SPEC-09c:', '/* ---------- GAME 1:');
  const placeBlock = blk('  function placeItems(', '\n  }\n');
  t('F3-T02 配置コードに Math.random なし', spBlock.length > 500 && placeBlock.length > 50 &&
    !/Math\.random/.test(spBlock) && !/Math\.random\(\)[^;]*position/.test(placeBlock),
    `spawner=${spBlock.length}字 place=${placeBlock.length}字`);

  // F3-T03: 8パターンとスキーマ
  const names = SP.PATTERNS || [];
  const schemaOk = names.every(n=>{
    const p = SP.make(n, SP.rng(7), {sector: SP.sectorAt(170), speed: 300});
    return p && p.name === n && p.length > 0 && p.items.length > 0 &&
      p.items.every(i=>['rock', 'core'].includes(i.kind) && [i.x, i.y, i.dz, i.r].every(Number.isFinite) && i.dz >= 0);
  });
  t('F3-T03 8パターン+スキーマ', names.length === 8 && schemaOk, names.join(','));

  // F3-T04: 公平性 — 生成(再試行+代替込み)は常に validate 合格
  let total = 0, ng = 0, fb = 0, spent = 0;
  const speeds = [110, 300, 460, 640];
  for(let seed = 1; seed <= 1000; seed++){
    const rng = SP.rng(seed);
    for(const n of names) for(const v of speeds){
      const t0 = performance.now();
      const p = SP.generate(n, rng, {sector: SP.sectorAt(170), speed: v});
      const ok = SP.validate(p, v);
      spent += performance.now() - t0;
      total++; if(!ok) ng++; if(p.fallback) fb++;
    }
  }
  t('F3-T04 公平性 1000シード×8×4速度', ng === 0, `NG=${ng}/${total} 代替=${fb}(${(fb/total*100).toFixed(1)}%)`);
  t('F3-T13 生成+検証 <1ms/パターン', spent/total < 1, `${(spent/total).toFixed(3)}ms`);

  // F3-T05: 検証器そのものの正しさ
  const wall = (dz, hole)=>{ const it = [];
    for(let x = -FX - 6; x <= FX + 6; x += 6) for(let y = -FY - 6; y <= FY + 6; y += 6){
      if(hole && Math.hypot(x - hole[0], y - hole[1]) < 16) continue;
      it.push({kind:'rock', x, y, dz, r:3}); }
    return it; };
  const full = {name:'T', length:10, items: wall(0)};
  const holed = {name:'T', length:10, items: wall(0, [10, 0])};
  const twoFast = {name:'T', length:40, items: [...wall(0, [-35, 0]), ...wall(30, [35, 0])]};
  const twoSlow = {name:'T', length:320, items: [...wall(0, [-35, 0]), ...wall(300, [35, 0])]};
  const v1 = SP.validate(full, 300), v2 = SP.validate(holed, 300), v3 = SP.validate(twoFast, 640), v4 = SP.validate(twoSlow, 110);
  t('F3-T05 検証器: 完全な壁×/穴○/届かない2枚×/届く2枚○', !v1 && v2 && !v3 && v4, `${v1} ${v2} ${v3} ${v4}`);

  // ---- ディレクター(ヘッドレスの早回しシミュレーション) ----
  const sim = (seed, seconds, dt = 1/30)=>{
    const d = SP.director(seed); d.prefill(110);
    let speed = 110, maxR = 0, maxC = 0, t = 0; const ev = [];
    while(t < seconds){
      t += dt;
      speed = Math.min(d.sector.cap, speed + dt*6);
      for(const e of d.step(dt, speed)) ev.push({...e, t});
      const rk = d.items.filter(i=>i.kind === 'rock').length, co = d.items.filter(i=>i.kind === 'core').length;
      maxR = Math.max(maxR, rk); maxC = Math.max(maxC, co);
    }
    return {d, ev, maxR, maxC};
  };
  const S600 = sim(42, 600);

  // F3-T06: パターン間の空白 ≥ speed×0.9
  const lg = S600.d.log;
  let gapNg = 0;
  for(let i = 1; i < lg.length; i++){
    // gapFromPrev: 生成した瞬間の「前パターンの末尾z − 今回の先頭z」。基準は前パターン配置時の速度
    if(!(lg[i].gapFromPrev >= lg[i-1].speed*SP.CONST.GAP_T - 1)) gapNg++;
  }
  t('F3-T06 パターン間の空白 ≥ speed×GAP_T', lg.length > 20 && gapNg === 0, `patterns=${lg.length} NG=${gapNg}`);

  // F3-T07: 600秒で同時使用 ≤ 岩46/コア6
  t('F3-T07 プール上限(600秒)', S600.maxR <= 46 && S600.maxC <= 6,
    `最大 岩${S600.maxR} コア${S600.maxC} 切り詰め${lg.reduce((a, l)=>a + l.truncated, 0)}`);

  // F3-T08: セクター遷移と速度上限
  const secAt = [40.01, 80.01, 120.01, 160.01].map(x=>SP.sectorAt(x));
  t('F3-T08 セクター 2/3/4/5 と上限', secAt.map(s=>s.n).join() === '2,3,4,5' &&
    secAt.map(s=>s.cap).join() === '300,380,460,500' && SP.sectorAt(0).cap === 220 && SP.sectorAt(400).cap === 640,
    secAt.map(s=>`${s.n}:${s.name}:${s.cap}`).join(' '));
  const secEv = S600.ev.filter(e=>e.type === 'sector').map(e=>+e.t.toFixed(1));
  t('F3-T08b 遷移イベントが40秒ごと', secEv.length >= 14 && Math.abs(secEv[0] - 40) < .1 && Math.abs(secEv[1] - 80) < .1, secEv.slice(0, 4).join(','));
  // 遷移直後 1.2 秒は生成しない
  const quiet = secEv.slice(0, 8).every(ts=>!S600.ev.some(e=>e.type === 'spawn' && e.t > ts && e.t < ts + 1.2 - 1e-6));
  t('F3-T09a 遷移後1.2秒の生成停止', quiet);

  // F3-T10: 動く岩
  const dr = SP.make('DRIFT', SP.rng(3), {sector: SP.sectorAt(50), speed: 300});
  const cm = SP.make('COMET_STREAM', SP.rng(3), {sector: SP.sectorAt(130), speed: 460});
  const dd = SP.director(5); dd.prefill(110);
  const moving = dd.items.find(i=>i.vx) || null;
  let movedOk = dr.items.some(i=>i.vx) && cm.items.every(i=>i.kind !== 'rock' || Math.abs(i.vx) >= 40);
  if(moving){ const x0 = moving.x; dd.step(.1, 110); movedOk = movedOk && moving.x !== x0; }
  t('F3-T10 DRIFT/COMETが横移動', movedOk);

  // F3-T11: 彗星の予兆は到達の1.5秒前
  let warnOk = 0, warnNg = 0;
  for(const e of S600.ev.filter(e=>e.type === 'warn')){
    // 予兆時点での先頭の岩の到達までの時間
    if(e.eta >= 1.5 - 1/30 - 1e-6 && e.eta <= 1.5 + .1) warnOk++; else warnNg++;
  }
  t('F3-T11 彗星の予兆(到達1.5秒前)', warnOk > 0 && warnNg === 0, `ok=${warnOk} ng=${warnNg}`);

  // F3-T14: 霧の視認時間 ≥0.7秒
  const fogOk = [110, 300, 460, 640].map(v=>{ const d30 = Math.sqrt(-Math.log(.3))/SP.fogFor(v); return +(d30/v).toFixed(2); });
  t('F3-T14 霧の視認時間 ≥0.7s', fogOk.every(x=>x >= .7), fogOk.join(' / ') + ' s');

  // ---- ゲーム組込 ----
  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 300));
  const D = V.AsteroidRun.debug();
  // F3-T12: 開始直後から岩が見える
  const vis = D.asts.filter(m=>m.visible && m.position.z < -80 && m.position.z > -900).length;
  t('F3-T12 開始直後に岩あり(-900〜-80)', vis >= 10, 'visible=' + vis);
  // 生成はディレクター経由(メッシュ位置=アイテム位置)
  const dir = D.director;
  const synced = dir && dir.items.filter(i=>i.kind === 'rock').every(i=>i.mesh && Math.abs(i.mesh.position.z - i.z) < 1e-6);
  t('F3-T15 メッシュがディレクターの位置に同期', !!synced);
  // F3-T09: 遷移演出(バナー+音+HUD)
  if(dir){
    dir.t = 39.9; D.stRef.time = 39.9;
    for(let i = 0; i < 12; i++) D.tick(16);
    const ban = document.getElementById('g-sector');
    const hudTxt = document.getElementById('game-hud').textContent;
    const sfx = V.SoundEngine._test().lastSfx;
    t('F3-T09 遷移バナー/HUD/音', ban && /SECTOR 02/.test(ban.textContent) && ban.classList.contains('show') &&
      /02|S02/.test(hudTxt) && dir.sector.n === 2,
      `banner="${ban && ban.textContent}" hud="${hudTxt.replace(/\s+/g, ' ').slice(0, 60)}" sfx=${sfx && sfx.type}`);
    t('F3-T09b 遷移音', V.SoundEngine.muted || (sfx && ['sector', 'warn'].includes(sfx.type)), sfx && sfx.type);
    // 速度上限がセクターに従う
    D.stRef.speed = 999; D.tick(16);
    t('F3-T08c ゲームの速度上限=セクター', Math.abs(D.stRef.speed - 300) < 1e-6, 'speed=' + D.stRef.speed);
    t('F3-T14b 霧の濃度が速度連動', Math.abs(D.composer.passes[0].scene.fog.density - SP.fogFor(300)) < 1e-9,
      D.composer.passes[0].scene.fog.density);
  }
  V.AsteroidRun.stop(); V.closeLayer();

  window.__PF3RESULTS = R;
  console.table(R);
  return R;
})();
