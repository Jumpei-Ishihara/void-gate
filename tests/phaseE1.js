/* Phase E1 (SPEC-08a SIGNAL TUNER撤去) 受け入れテスト
 * 実行: fetch('tests/phaseE1.js').then(r=>r.text()).then(eval) → window.__PE1RESULTS
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG;
  t('H-01 VG', !!V);
  if(!V){ window.__PE1RESULTS = R; console.table(R); return R; }

  // ---- AC-01: コード/DOMからの完全撤去(存在チェック) ----
  t('REM-01 SignalGame不在', !('SignalGame' in V) && typeof window.SignalGame === 'undefined');
  t('REM-02 beatOsc不在', !('beatOsc' in V.SoundEngine));
  t('REM-01b wave-canvas不在', !document.getElementById('wave-canvas'));
  t('REM-01c SIGNAL系DOM不在', !document.getElementById('btn-contact') && !document.getElementById('deck-contact')
    && !document.getElementById('best-sig') && !document.getElementById('ch-comm'));
  const html = document.documentElement.outerHTML;
  t('REM-06 文言掃除', !html.includes('SIGNAL TUNER') && !html.includes('TUNE IN'));

  // ---- AC-02: hero単独CTA / DECK単独ベイ / 早見表1枚 ----
  t('AC-02 hero単独CTA', document.querySelectorAll('.hero-actions .btn').length === 1
    && !!document.getElementById('btn-explore'));
  t('AC-02b DECK単独ベイ', document.querySelectorAll('.deck-bay').length === 1
    && !!document.getElementById('deck-explore') && !!document.getElementById('best-ast'));
  t('AC-02c 早見表1枚', document.querySelectorAll('#quickref .card').length === 1);

  // ---- AC-03: 通信ターミナルの移設と機能 ----
  const ct = document.getElementById('contact');
  t('AC-03 通信ターミナル位置', !!ct && ct.offsetTop >= document.getElementById('ch-launch').offsetTop
    && ct.textContent.includes('通信ターミナル'));
  document.getElementById('f-name').value = 'TEST';
  document.getElementById('send').click();
  await new Promise(r=>setTimeout(r, 100));
  t('AC-03b 送信演出', document.getElementById('send-msg').textContent.includes('ENCRYPTING'));

  // ---- ガイド章: comm章が消えて4章(briefing+3訓練章) ----
  const ids = V.Guide.info().map(d=>d.id);
  t('GUIDE 章構成', ids.length === 4 && !ids.includes('comm')
    && ['sortie','flight','weapons','survival'].every(id=>ids.includes(id)), ids.join(','));   // E3でbriefing→sortie

  // ---- ゲーム動作サニティ(ASTEROID RUN 無傷) ----
  document.getElementById('deck-explore').click();
  const menuOk = document.querySelector('.gtitle') && document.querySelector('.gtitle').textContent === 'ASTEROID RUN';
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 350));
  const playing = V.AsteroidRun.debug().playing;
  V.AsteroidRun.fire();
  const fired = ['gun','explosion','noCore'].includes(V.SoundEngine._test().lastSfx.type);
  V.closeLayer();
  t('GAME サニティ', menuOk && playing && fired, `menu=${menuOk} playing=${playing} fired=${fired}`);

  // ---- HUD: comm行が消えている ----
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, document.getElementById('ch-survival').offsetTop + 10);
  dispatchEvent(new Event('scroll'));
  const lbl = document.getElementById('hud-status').textContent;
  window.scrollTo(0, 0); dispatchEvent(new Event('scroll'));
  t('HUD 章表記', lbl.includes('SURVIVAL') || lbl.includes('生存規定'), lbl);

  window.__PE1RESULTS = R;
  const ng = R.filter(x=>!x.pass);
  console.info(`[PhaseE1] ${R.length-ng.length}/${R.length} pass`, ng.length?ng:'ALL GREEN');
  console.table(R);
  return R;
})();
