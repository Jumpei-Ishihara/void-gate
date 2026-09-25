/* Phase K2 (SPEC-13b ホログラム・状態色・警告・DOM HUD の一本化) 受け入れテスト
 * 実行: fetch('tests/phaseK2.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;
  t('H-01 VG公開', !!V);
  if(!V){ window.__PK2RESULTS = R; console.table(R); return R; }

  V.openLayer('asteroid'); V.AsteroidRun.menu();
  const vc = document.querySelector('.vchip[data-v="cockpit"]'); if(vc) vc.click();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 400));
  const D = V.AsteroidRun.debug(), ck = D.ck, st = D.stRef;
  t('H-02 起動(操縦席視点)', D.playing && ck && ck.holos, 'holos=' + !!(ck && ck.holos));
  if(!ck || !ck.holos){ V.AsteroidRun.stop(); V.closeLayer(); window.__PK2RESULTS = R; console.table(R); return R; }
  st.inv = 1e15;
  const T = V.THREE, H = ck.holos, names = ['shield', 'arm', 'top', 'alert', 'edge'];

  // K2-T01: 5パネル・加算・深度書き込みなし・レティクルと別の材質
  const retMats = new Set(); D.reticle.traverse(o=>{ if(o.material) retMats.add(o.material); });
  const bad = names.filter(n=>{ const m = H[n] && H[n].mesh && H[n].mesh.material;
    return !m || m.blending !== T.AdditiveBlending || m.depthWrite !== false || retMats.has(m); });
  t('K2-T01 ホログラム5枚(加算・深度なし・レティクルと別材質)', bad.length === 0, bad.length ? 'NG=' + bad : 'ok');

  // K2-T02: 情報の一本化(各パネルが描いた文字)
  st.shields = 2; st.cores = 2; st.dist = 678.4; st.mult = 1.5; st.combo = 6;
  if(!D.lockMode()) V.AsteroidRun.toggleLock();
  ck.redrawAll();
  const tx = ck.texts(), all = [...tx.shield, ...tx.arm, ...tx.top].join(' | ');
  const sec = D.director.sector, want = [`S${String(sec.n).padStart(2, '0')}`, sec.name, D.score().toLocaleString(), '678 Mkm', '◆ 2', '×1.5', 'AUTO LOCK', 'SHIELD'];
  const miss = want.filter(w=>!all.includes(w));
  t('K2-T02 情報がホログラムに出る', miss.length === 0, miss.length ? `不足=[${miss}] 描画=${all}` : all);

  // K2-T03: DOM HUD の数値行は操縦席で非表示、ボタンは表示。追跡視点では表示
  D.hud();
  const rowDisp = ()=>{ const r = document.querySelector('#game-hud .ghud-row'); return r ? getComputedStyle(r).display : 'なし'; };
  const btn = document.getElementById('g-view') || document.getElementById('g-sound');
  const inCock = rowDisp(), btnDisp = btn ? getComputedStyle(btn).display : 'なし';
  V.AsteroidRun.toggleView(); const inChase = rowDisp(); V.AsteroidRun.toggleView();
  t('K2-T03 操縦席で数値行を非表示・ボタンは表示', inCock === 'none' && btnDisp !== 'none' && inChase !== 'none',
    `操縦席=${inCock} ボタン=${btnDisp} 追跡=${inChase}`);

  // K2-T04: 状態色
  const COL = ['#00f0ff', '#ffb347', '#ff3b5c'], res = [];
  for(const [s, idx] of [[3, 0], [1, 1], [0, 2]]){
    st.shields = s; D.tick(16); D.tick(16);
    const k = ck.keys();
    res.push({s, col: ck.stateColor(), glow: ck.glowState(), keyOk: [k.shield, k.arm].every(x=>String(x).endsWith('|' + idx)), idx});
  }
  t('K2-T04 状態色(シアン/琥珀/赤)', res.every(r=>r.col === COL[r.idx] && r.glow === r.idx && r.keyOk),
    res.map(r=>`${r.s}:${r.col}/${r.glow}/${r.keyOk}`).join(' '));

  // K2-T05: 警告はシールド0の時だけ
  st.shields = 3; D.tick(16); const off1 = H.alert.mesh.visible || H.edge.mesh.visible;
  st.shields = 0; D.tick(16); const on = H.alert.mesh.visible && H.edge.mesh.visible;
  st.shields = 3; D.tick(16); const off2 = H.alert.mesh.visible || H.edge.mesh.visible;
  t('K2-T05 警告はシールド0の時だけ', !off1 && on && !off2, `3=${off1} 0=${on} 3=${off2}`);

  // K2-T06: reduced-motion では明滅しない
  ck.setReduced(true); st.shields = 0; D.tick(16);
  const a1 = [H.alert.mesh.material.opacity, H.edge.mesh.material.opacity, H.shield.mesh.material.opacity];
  D.tick(53); const a2 = [H.alert.mesh.material.opacity, H.edge.mesh.material.opacity, H.shield.mesh.material.opacity];
  ck.setReduced(false); D.tick(16); D.tick(53);
  const b1 = H.alert.mesh.material.opacity; D.tick(90); const b2 = H.alert.mesh.material.opacity;
  ck.setReduced(null); st.shields = 3; D.tick(16);
  t('K2-T06 reduced-motion で明滅なし', a1.every((v, i)=>v === a2[i]) && a1[0] === 1 && Math.abs(b1 - b2) > 1e-3,
    `reduced=${a1.map(v=>v.toFixed(2))}→${a2.map(v=>v.toFixed(2))} 通常=${b1.toFixed(2)}→${b2.toFixed(2)}`);

  // K2-T07: 値が変わらない間は描き直さない(上帯は目盛りの流しで4フレームごとのみ)
  st.hitStop = 10;   // 世界の時間を止めて値を固定
  D.tick(16);
  const r0 = {shield: H.shield.redraws, arm: H.arm.redraws, top: H.top.redraws};
  for(let i = 0; i < 60; i++) D.tick(16);
  const dr = {shield: H.shield.redraws - r0.shield, arm: H.arm.redraws - r0.arm, top: H.top.redraws - r0.top};
  st.hitStop = 0;
  t('K2-T07 変化時のみ再描画', dr.shield === 0 && dr.arm === 0 && dr.top <= 16, JSON.stringify(dr));

  // K2-T08: 輝度(警告表示中も)
  st.shields = 0; D.tick(16);
  const lp = D.lookProbe('cockpit');
  st.shields = 3; D.tick(16);
  t('K2-T08 輝度(白飛び≤.1%・岩・平均)', lp.blownPct <= .1 && lp.rockMean >= .214*.9 && lp.mean >= .0827*.5,
    `白飛び=${lp.blownPct}% 岩=${lp.rockMean} 平均=${lp.mean}`);

  // K2-T09: 加点ポップとメーターが重ならない(1280×720)
  const mr = ck.meterRect(1280, 720), popBottom = 720*(1 - .36);
  t('K2-T09 加点ポップはメーターより上', mr.y0 > popBottom, `メーター上端=${mr.y0.toFixed(0)}px ポップ下端=${popBottom.toFixed(0)}px`);

  V.AsteroidRun.stop(); V.closeLayer();
  window.__PK2RESULTS = R; console.table(R);
  return R;
})();
