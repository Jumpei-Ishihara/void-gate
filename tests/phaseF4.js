/* Phase F4 (SPEC-09d 岩マテリアル刷新: 法線・粗さ・トライプラナー・岩種・影) 受け入れテスト
 * 実行: fetch('tests/phaseF4.js').then(r=>r.text()).then(eval)
 */
(async ()=>{
  const R = [];
  const t = (id, pass, detail='') => R.push({id, pass: !!pass, detail: String(detail)});
  const V = window.VG, T = V && V.THREE, A = V && V.Assets;
  t('H-01', !!A && !!T);
  if(!A || !T){ window.__PF4RESULTS = R; console.table(R); return R; }

  // F4-T01: シード付きで再現 + Math.random を使わない
  const hash = cv=>{ const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let h = 2166136261;
    for(let i = 0; i < d.length; i += 7){ h ^= d[i]; h = Math.imul(h, 16777619); } return h >>> 0; };
  const s1 = A.rockSurface ? A.rockSurface(128, 11) : null, s2 = A.rockSurface ? A.rockSurface(128, 11) : null;
  const s3 = A.rockSurface ? A.rockSurface(128, 12) : null;
  const src = await fetch('/void-gate/index.html?f4=' + Date.now()).then(r=>r.text());
  const i0 = src.indexOf('function rockHeightCanvas('), i1 = src.indexOf('function rockMats(');
  const texSrc = i0 > 0 && i1 > i0 ? src.slice(i0, i1) : '';
  t('F4-T01 シード再現・Math.randomなし', s1 && hash(s1.height) === hash(s2.height) && hash(s1.height) !== hash(s3.height) &&
    texSrc.length > 300 && !/Math\.random/.test(texSrc), `src=${texSrc.length}字`);

  // F4-T02: 3材質とも map/normal/roughness、bumpなし
  const mats = A.rockMats();
  t('F4-T02 map/normal/roughness(bumpなし)', mats.length === 3 && mats.every(m=>m.map && m.normalMap && m.roughnessMap && !m.bumpMap));

  // F4-T03: 法線マップの平均がほぼ上向き
  const nc = mats[0].normalMap.image;
  let mr = 0, mg = 0, mb = 0, n = 0;
  if(nc && nc.getContext){ const d = nc.getContext('2d').getImageData(0, 0, nc.width, nc.height).data;
    for(let i = 0; i < d.length; i += 4){ mr += d[i]; mg += d[i+1]; mb += d[i+2]; n++; } }
  mr /= n*255; mg /= n*255; mb /= n*255;
  t('F4-T03 法線マップ平均≈(.5,.5,1)', Math.abs(mr - .5) < .05 && Math.abs(mg - .5) < .05 && mb > .9,
    [mr, mg, mb].map(x=>x.toFixed(3)).join(','));

  // F4-T04: トライプラナー(UV非依存) — uv属性を消した岩でも模様が出る / 定義を外すと平坦になる
  // 実物の材質を使う(clone は onBeforeCompile と独自 define を引き継がないため)。一様な半球光なので陰影は出ず、
  // 分散は「テクスチャの模様」だけから生じる。uv属性を消した形状では、UV経路は1点を読むだけで平坦になる
  const probeUVless = (triplanar)=>{
    A.setTriplanar(triplanar);
    const RD = V.pageFx.renderer, sc = new T.Scene(), cam = new T.PerspectiveCamera(40, 1, .1, 50);
    cam.position.set(0, 0, 4.2); cam.lookAt(0, 0, 0);
    sc.add(new T.HemisphereLight(0xffffff, 0xffffff, 12));
    const g = A.rockGeos()[0].clone(); g.deleteAttribute('uv');
    sc.add(new T.Mesh(g, mats[0]));
    const rt = new T.WebGLRenderTarget(128, 128);
    RD.setRenderTarget(rt); RD.render(sc, cam);
    const buf = new Uint8Array(128*128*4); RD.readRenderTargetPixels(rt, 0, 0, 128, 128, buf);
    RD.setRenderTarget(null); rt.dispose(); g.dispose();
    const Y = []; for(let y = 44; y < 84; y++) for(let x = 44; x < 84; x++){ const i = (y*128 + x)*4; Y.push(buf[i] + buf[i+1] + buf[i+2]); }
    const mean = Y.reduce((a, b)=>a + b, 0)/Y.length;
    return Math.sqrt(Y.reduce((a, b)=>a + (b - mean)**2, 0)/Y.length);
  };
  const vTri = probeUVless(true), vUV = probeUVless(false);
  A.setTriplanar(true);
  t('F4-T04 トライプラナー(uvなしでも模様)', vTri > vUV*3 && vTri > 3, `分散 tri=${vTri.toFixed(1)} uv=${vUV.toFixed(1)}`);

  // F4-T05: 岩種
  const cols = new Set(mats.map(m=>m.color.getHex()));
  t('F4-T05a 岩種C/S/M(色3・M型は金属質)', cols.size === 3 && mats[2].metalness > mats[0].metalness && mats[2].metalness > mats[1].metalness,
    mats.map(m=>`${m.color.getHexString()}/m${m.metalness}/r${m.roughness}`).join(' '));

  // ---- ゲーム ----
  V.openLayer('asteroid'); V.AsteroidRun.menu();
  document.getElementById('g-start').click();
  await new Promise(r=>setTimeout(r, 300));
  const D = V.AsteroidRun.debug(), RD = D.composer.renderer, Q = V.Quality;
  t('F4-T05b 全岩に isRock/type', D.asts.every(m=>m.userData.isRock && ['C', 'S', 'M'].includes(m.userData.type)));
  Q.reset();
  const pc = !D.isTouch;
  D.stRef.inv = 1e15;   // 被弾で止まらないよう無敵にして約1.5秒進め、岩を機体の近く(z>-120)まで運ぶ
  for(let i = 0; i < 95; i++) D.tick(16);
  const casters = D.asts.filter(m=>m.castShadow).length;
  let shipRecv = true; D.shipObj.traverse(o=>{ if(o.isMesh && !o.material.transparent && !o.receiveShadow) shipRecv = false; });
  t('F4-T06 影(PC L0): 有効・キャスター≤8・機体が受ける', pc ? (RD.shadowMap.enabled && casters <= 8 && casters >= 1 && shipRecv) : !RD.shadowMap.enabled,
    `enabled=${RD.shadowMap.enabled} casters=${casters} shipRecv=${shipRecv} touch=${D.isTouch}`);

  // F4-T10: draw call 予算(PC L0 ≤155 / SP ≤140)
  RD.info.autoReset = false; RD.info.reset(); D.composer.render();
  const calls = RD.info.render.calls; RD.info.autoReset = true;
  t('F4-T10 draw calls', calls <= (pc ? 155 : 140), `calls=${calls} (上限 ${pc ? 155 : 140})`);

  // F4-T08: 輝度(F2と同じ基準・判定)
  const B = {chase:{mean:.059, blownPct:0, rockMean:.2113, rockCrushedPct:0}, cockpit:{mean:.0827, blownPct:0, rockMean:.214, rockCrushedPct:0}};
  const within = (m, b)=>m.rockMean >= b.rockMean*.9 && m.rockCrushedPct <= b.rockCrushedPct + 8 && m.blownPct <= b.blownPct + .1 && m.mean >= b.mean*.5;
  for(const v of ['chase', 'cockpit']){ const m = D.lookProbe(v);
    t(`F4-T08 輝度 ${v}`, within(m, B[v]), `岩 ${m.rockMean}(${B[v].rockMean}) 岩黒 ${m.rockCrushedPct}% 白飛び ${m.blownPct}% 平均 ${m.mean}`); }

  // F4-T07: Quality 縮退(L1 影OFF / L2 トライプラナーOFF)
  Q.degrade();   // → L1(PC) / L2(SP)
  const l1Shadow = RD.shadowMap.enabled;
  Q.degrade();
  const triOff = mats.every(m=>!(m.defines && 'TRIPLANAR' in m.defines));
  t('F4-T07 縮退: L1影OFF / L2トライプラナーOFF', !l1Shadow && triOff, `L1 shadow=${l1Shadow} L2 triplanarOff=${triOff}`);
  Q.reset();
  const triBack = mats.every(m=>m.defines && 'TRIPLANAR' in m.defines);
  t('F4-T07b reset で復帰(PC)', !pc || (RD.shadowMap.enabled && triBack), `shadow=${RD.shadowMap.enabled} tri=${triBack}`);
  V.AsteroidRun.stop(); V.closeLayer();

  // F4-T09: サイトの岩も同じ材質
  const G = V.Guide, set = new Set(mats);
  t('F4-T09 サイトの岩帯も新材質', G.sortie.rocks.length > 0 && G.sortie.rocks.every(m=>set.has(m.material)));
  // サイトの輝度(F2基準)
  const SB = {sortie:{k:.5, mean:.0378, blownPct:.003, rockMean:.1418, rockCrushedPct:17.42}, flight:{k:.6, mean:.0718, blownPct:.304, rockMean:.0506, rockCrushedPct:31.13},
              weapons:{k:.65, mean:.055, blownPct:.004, rockMean:.1227, rockCrushedPct:16.56}, survival:{k:.6, mean:.0928, blownPct:.008, rockMean:.0942, rockCrushedPct:10.41}};
  for(const [id, b] of Object.entries(SB)){ const m = V.pageFx.lookProbe(id, b.k);
    t(`F4-T08b サイト輝度 ${id}`, within(m, b), `岩 ${m.rockMean}(${b.rockMean}) 岩黒 ${m.rockCrushedPct}%(${b.rockCrushedPct}) 白飛び ${m.blownPct}% 平均 ${m.mean}`); }

  window.__PF4RESULTS = R;
  console.table(R);
  return R;
})();
