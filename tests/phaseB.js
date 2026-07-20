/* Phase B (SPEC-07b 訓練章02〜05) 受け入れテスト
 * 実行: fetch('tests/phaseB.js').then(r=>r.text()).then(eval) → window.__PBRESULTS
 * 章のt範囲はDOM実測依存のため VG.Guide.info() から取得して駆動する
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, G = V && V.Guide, Tl = V && V.Tl;
  t('H-01 Guide公開', !!G && !!Tl && typeof G.info === 'function' && typeof G.stage === 'function');
  if(!G){ window.__PBRESULTS = R; console.table(R); return R; }

  const info = G.info();
  t('B-01 4章登録', info.length === 4 && ['flight','weapons','survival','comm'].every(id=>info.find(c=>c.id === id)),
    info.map(c=>c.id).join(','));
  t('B-01b t範囲が昇順', info.every((c,i)=>c.t1 > c.t0 && (i === 0 || c.t0 >= info[i-1].t0)),
    info.map(c=>`${c.id}:${c.t0.toFixed(2)}-${c.t1.toFixed(2)}`).join(' '));
  const ch = id => info.find(c=>c.id === id);
  const at = (c, k) => c.t0 + (c.t1 - c.t0)*k;
  const go = (c, k) => { Tl._setT(at(c, k)); Tl.update(.016); };

  // ---- 章02 FLIGHT ----
  const f = ch('flight'), Sf = G.stage('flight');
  go(f, .4);
  t('F-01 機体出現', Sf.group.visible && Sf.ship.scale.x > .1, 'scale='+Sf.ship.scale.x.toFixed(2));
  const mx0 = Sf.ship.position.x;
  V.pageMouse.x = .8; Tl.update(.016);
  const followed = Sf.ship.position.x !== mx0;
  V.pageMouse.x = 0; Tl.update(.016);
  t('F-02 入力追従デモ', followed, `x ${mx0.toFixed(2)}→moved`);
  go(f, 0);
  t('F-03 章外は非表示', !Sf.group.visible);

  // ---- 章03 WEAPONS ----
  const w = ch('weapons'), Sw = G.stage('weapons');
  go(w, .15);
  const coreZ1 = Sw.core.position.z;
  go(w, .3);
  t('W-01 コア接近', Sw.core.position.z > coreZ1, `z ${coreZ1.toFixed(1)}→${Sw.core.position.z.toFixed(1)}`);
  go(w, .55);
  t('W-02 トレーサー表示', Sw.tracers[0].visible && Sw.tracers[0].material.opacity > .1);
  go(w, .7);
  t('W-03 爆発中: 標的消滅+破片飛散', !Sw.target.visible && Sw.shards[0].visible
    && Sw.shards[0].position.length() > .5, 'shardDist='+Sw.shards[0].position.length().toFixed(2));
  // 決定性(AC-02)
  const snap1 = Sw.shards[0].position.toArray().map(v=>+v.toFixed(4)).join(',');
  go(w, .2); go(w, .7);
  const snap2 = Sw.shards[0].position.toArray().map(v=>+v.toFixed(4)).join(',');
  t('W-04 逆スクロール決定性', snap1 === snap2);
  // 音のエッジ検出(B-06): 上向き通過で発音、下向きでは鳴らない
  go(w, .5);
  V.SoundEngine.ui('select');                  // マーカー
  go(w, .7);
  const upFx = V.SoundEngine._test().lastSfx.type;
  V.SoundEngine.ui('select');
  go(w, .5);
  const downFx = V.SoundEngine._test().lastSfx.type;
  t('W-05 音エッジ検出', upFx === 'explosion' && downFx === 'ui:select', `up=${upFx} down=${downFx}`);

  // ---- 章04 SURVIVAL ----
  const sv = ch('survival'), Ss = G.stage('survival');
  const shieldsOn = ()=>Ss.shields.filter(m=>m.visible).length;
  go(sv, .1);  const n1 = shieldsOn();
  go(sv, .37); const n2 = shieldsOn();
  go(sv, .7);  const n3 = shieldsOn();
  t('S-01 シールド段階破壊', n1 === 3 && n2 === 2 && n3 === 0, `${n1}→${n2}→${n3}`);
  go(sv, .75);
  t('S-02 CRITICALビネット', parseFloat(Ss.vign.style.opacity) > .1, 'op='+Ss.vign.style.opacity);
  go(sv, 0);
  t('S-03 章外でビネット消灯', parseFloat(Ss.vign.style.opacity || 0) === 0);

  // ---- 章05 COMM ----
  const cm = ch('comm'), Sc = G.stage('comm');
  const devAt = k => {
    go(cm, k);
    const p = Sc.player.geometry.attributes.position, q = Sc.target.geometry.attributes.position;
    let d = 0;
    for(let i = 0; i < p.count; i += 10) d += Math.abs(p.getY(i) - q.getY(i));
    return d;
  };
  const d1 = devAt(.15), d2 = devAt(.95);
  t('C-01 波形が同調に収束', d2 < d1*.2, `dev ${d1.toFixed(1)}→${d2.toFixed(1)}`);
  go(cm, .75);
  t('C-02 同調パルス', Sc.pulse.visible && Sc.pulse.material.opacity > 0);

  // ---- テキスト行 ----
  go(f, .9);
  const litCount = document.querySelectorAll('#ch-flight .ch-line.lit').length;
  t('T-01 行点灯', litCount >= 3, 'lit='+litCount);
  go(f, .05);
  const litEarly = document.querySelectorAll('#ch-flight .ch-line.lit').length;
  t('T-02 進行度未達は消灯', litEarly === 0, 'lit='+litEarly);
  const bodyTxt = document.querySelector('#ch-weapons').textContent;
  t('T-03 操作語の出し分け', V.isTouch ? bodyTxt.includes('FIREボタン') : bodyTxt.includes('左クリック'));

  // ---- 性能 ----
  Tl._setT(.5); Tl.update(.016);
  const t0 = performance.now();
  for(let i = 0; i < 60; i++){ Tl.update(.016); V.pageFx.composer.render(); }
  const per = (performance.now() - t0)/60;
  t('PERF 章駆動込み合成', per < 12, per.toFixed(1)+'ms/frame');

  // ---- ゲーム回帰 ----
  Tl._setT(0); Tl.update(.016);
  for(const n of [1,2,3,4]){
    const src = await fetch(`/void-gate/tests/phase${n}.js?b=1`).then(r=>r.text());
    await eval(src);
    await new Promise(r=>setTimeout(r, 250));
  }
  const regs = [window.__P1RESULTS, window.__P2RESULTS, window.__P3RESULTS, window.__P4RESULTS];
  t('REG phase1〜4', regs.every(x=>x && x.every(y=>y.pass)),
    regs.map((x,i)=>`p${i+1}:${x?x.filter(y=>!y.pass).length:'?'}ng`).join(' '));

  window.__PBRESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[PhaseB] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
