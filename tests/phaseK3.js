/* Phase K3 (SPEC-13c ロック札・起動演出・スマホ調整) 受け入れテスト
 * 実行: fetch('tests/phaseK3.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;
  t('H-01 VG公開', !!V);
  if(!V){ window.__PK3RESULTS = R; console.table(R); return R; }
  const startGame = async ()=>{
    V.openLayer('asteroid'); V.AsteroidRun.menu();
    const vc = document.querySelector('.vchip[data-v="cockpit"]'); if(vc) vc.click();
    document.getElementById('g-start').click();
    await new Promise(r=>setTimeout(r, 300));
    return V.AsteroidRun.debug();
  };
  let D = await startGame(), ck = D.ck;
  t('H-02 起動(操縦席視点)', D.playing && ck && ck.lockTag && ck.boot, 'lockTag=' + !!(ck && ck.lockTag));
  if(!ck || !ck.lockTag){ V.AsteroidRun.stop(); V.closeLayer(); window.__PK3RESULTS = R; console.table(R); return R; }
  let st = D.stRef; st.inv = 1e15; st.bootT = 9;   // 起動演出は済ませた状態で始める

  // 正面 z-150 に岩1個(他の岩は横へ退避)。世界の時間を止めてレティクルを追従させる
  const ship = D.shipObj, rocks = D.asts.filter(m=>m.visible && m.userData.item);
  const rock = rocks[0];
  const place = (dx)=>{ rocks.forEach((m, i)=>{ const it = m.userData.item; if(i){ it.x = ship.position.x + 400; } else { it.x = ship.position.x + dx; it.y = ship.position.y; it.z = ship.position.z - 150; } }); };
  if(!D.lockMode()) V.AsteroidRun.toggleLock();
  V.AsteroidRun.input(innerWidth/2, innerHeight/2);
  st.hitStop = 100; st.speed = 200;
  place(0); for(let i = 0; i < 40; i++) D.tick(16);
  const L = ck.lockTag();
  const inter = (a, b)=>a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  t('K3-T01 ロック札: 表示・レティクル枠の上・枠と重ならない', L.visible && Math.abs(L.ndc[0] - L.retNdc[0]) < .02 && L.ndc[1] > L.retNdc[1] && !inter(L.rect, L.retRect),
    `visible=${L.visible} tag=${L.ndc.map(v=>v.toFixed(2))} ret=${L.retNdc.map(v=>v.toFixed(2))} 重なり=${inter(L.rect, L.retRect)}`);

  // K3-T02: 接触までの秒数
  const want = (ship.position.z - rock.position.z)/st.speed;
  t('K3-T02 T- = 距離/速度 (±0.1秒)', rock && Math.abs(L.ttc - want) <= .1 && L.text.includes('T-'), `ttc=${L.ttc.toFixed(2)} 期待=${want.toFixed(2)} text=${L.text}`);

  // K3-T03: 対象なし / LOCK OFF / 追跡視点では非表示
  place(60); for(let i = 0; i < 4; i++) D.tick(16); const v1 = ck.lockTag().visible;
  place(0); D.tick(16); V.AsteroidRun.toggleLock(); D.tick(16); const v2 = ck.lockTag().visible; V.AsteroidRun.toggleLock(); D.tick(16);
  V.AsteroidRun.toggleView(); D.tick(16); const v3 = ck.lockTag().visible; V.AsteroidRun.toggleView(); D.tick(16);
  const v4 = ck.lockTag().visible;
  t('K3-T03 対象なし/LOCK OFF/追跡視点で非表示', !v1 && !v2 && !v3 && v4, `横へ外す=${v1} OFF=${v2} 追跡=${v3} 復帰=${v4}`);
  st.hitStop = 0;
  V.AsteroidRun.stop(); V.closeLayer();

  // K3-T04: 起動演出(0.5秒 / 1.2秒 / 1.6秒)。演出中もゲームは進む
  ck.setReduced(false);
  D = await startGame(); st = D.stRef; st.inv = 1e15; st.bootT = 0; const d0 = st.dist;
  for(let i = 0; i < 31; i++) D.tick(16);
  const b05 = ck.boot(), dist05 = st.dist;
  for(let i = 0; i < 44; i++) D.tick(16);
  const b12 = ck.boot();
  for(let i = 0; i < 25; i++) D.tick(16);
  const b16 = ck.boot();
  const s05 = b05.shown, s12 = b12.shown;
  const ok4 = s05.meter && s05.shield && !s05.top && !s05.radar && b05.meterShown >= 480*.8 && dist05 > d0 &&
    ['strip', 'meter', 'shield', 'arm', 'top', 'radar'].every(k=>s12[k] === 1) && s12.online && !b16.shown.online;
  t('K3-T04 起動演出の順序と進行', ok4,
    `0.5s=${JSON.stringify(s05)} meter=${b05.meterShown.toFixed(0)} dist ${d0.toFixed(1)}→${dist05.toFixed(1)} / 1.2s=${JSON.stringify(s12)} / 1.6s online=${b16.shown.online}`);
  V.AsteroidRun.stop(); V.closeLayer();

  // K3-T05: reduced-motion は即時表示
  ck.setReduced(true);
  D = await startGame(); st = D.stRef; st.inv = 1e15;
  D.tick(16);
  const b0 = ck.boot();
  ck.setReduced(null);
  t('K3-T05 reduced-motion で即時表示', ['strip', 'meter', 'shield', 'arm', 'top', 'radar'].every(k=>b0.shown[k] === 1) && !b0.shown.online,
    JSON.stringify(b0.shown));

  // K3-T06: 文字の実寸(PC 1280×720 / SP 667×375)
  const pc = ck.textPx(1280, 720, false), sp = ck.textPx(667, 375, true);
  t('K3-T06 文字の実寸', pc.speed >= 18 && pc.score >= 14 && pc.cores >= 14 && pc.labelsMin >= 10 &&
    sp.speed >= 10 && sp.score >= 9 && sp.cores >= 9 && sp.labelsMin >= 7,
    `PC ${JSON.stringify(pc)} / SP ${JSON.stringify(sp)}`);

  // K3-T07: SP の FIRE ボタンとメーターが重ならない
  const fb = document.getElementById('fire-btn'), cs = getComputedStyle(fb);
  const fl = parseFloat(cs.left), fbt = parseFloat(cs.bottom), fw = parseFloat(cs.width), fh = parseFloat(cs.height);
  const fire = [fl, 375 - fbt - fh, fl + fw, 375 - fbt];
  const mr = ck.meterRect(667, 375, true), meter = [mr.x0, mr.y0, mr.x1, mr.y1];
  t('K3-T07 SP: FIREボタンとメーターが重ならない', !inter(fire, meter), `fire=${fire.map(Math.round)} meter=${meter.map(Math.round)}`);

  // K3-T08: 演出後は変化時のみ再描画
  st.bootT = 9; st.hitStop = 100; D.tick(16); D.tick(16);
  const H = ck.holos, r0 = [H.shield.redraws, H.arm.redraws];
  for(let i = 0; i < 60; i++) D.tick(16);
  st.hitStop = 0;
  t('K3-T08 演出後は変化時のみ再描画', H.shield.redraws === r0[0] && H.arm.redraws === r0[1], `shield +${H.shield.redraws - r0[0]} arm +${H.arm.redraws - r0[1]}`);

  V.AsteroidRun.stop(); V.closeLayer();
  window.__PK3RESULTS = R; console.table(R);
  return R;
})();
