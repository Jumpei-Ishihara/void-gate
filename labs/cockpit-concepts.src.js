// ===== 操縦席デザイン3案(ルックデブ)。build_cockpit_concepts.py が本番の Look/Assets と結合して cockpit-concepts.html を生成 =====
// 座標はカメラ基準(カメラ=原点、前方=-z、上=+y)。本番の操縦席と同じくカメラの子として置く。FOV 72°

// ---- 疑似テレメトリ(状態デモ用) ----
const W = {speed: 300, shields: 3, cores: 2, score: 12340, mult: 1, combo: 0, sector: {n: 3, name: 'DENSE CORE'}, state: 'normal', t: 0, sectorFlash: 0};
const COL = {cyan: '#39f3ff', amber: '#ffb347', red: '#ff3b5c', green: '#7dffb0', white: '#eaf6ff', dim: 'rgba(160,220,255,.55)'};
const stateCol = ()=>W.state === 'critical' ? COL.red : W.state === 'low' ? COL.amber : COL.cyan;
const hdr = (hex, k)=>new THREE.Color(hex).multiplyScalar(k);
function canvasTex(w, h){
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return {cv, g: cv.getContext('2d'), tex};
}
// ホログラム(加算)または画面(不透明)の板。draw(g, w, h) で描き直す
function uiPlane(w, h, cw, ch, draw, {holo = true, gain = 1} = {}){
  const c = canvasTex(cw, ch);
  const mat = holo
    ? new THREE.MeshBasicMaterial({map: c.tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1, 1, 1).multiplyScalar(gain)})
    : new THREE.MeshBasicMaterial({map: c.tex, color: new THREE.Color(1, 1, 1).multiplyScalar(gain)});
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.userData.redraw = ()=>{ c.g.clearRect(0, 0, cw, ch); draw(c.g, cw, ch); c.tex.needsUpdate = true; };
  return m;
}
const F = (px, w = 500)=>`${w} ${px}px Orbitron, "Noto Sans JP", monospace`;
function glowText(g, txt, x, y, px, col, align = 'center', blur = 10){
  g.font = F(px); g.textAlign = align; g.fillStyle = col; g.shadowColor = col; g.shadowBlur = blur; g.fillText(txt, x, y); g.shadowBlur = 0;
}
// 岩のレーダー表示用(カメラ基準の相対位置)
let RADAR = [];

// ---- 共通: 本番と同一のレティクル(CON-05: 色0x00f0ff・不透明度.12は不変) ----
function reticle(){
  const mat = new THREE.MeshBasicMaterial({color: 0x00f0ff, transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide});
  const g = new THREE.Group(), bar = (w, h, x, y)=>{ const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, 0); g.add(m); };
  const rs = .17, ra = .07, rt = .006;
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sy])=>{ bar(ra, rt, sx*(rs - ra/2), sy*rs); bar(rt, ra, sx*rs, sy*(rs - ra/2)); });
  bar(.09, rt, 0, 0); bar(rt, .09, 0, 0);
  g.position.set(0, -.65, -3);
  return g;
}

// ================= 案A: HOLO CANOPY(ホログラフィック・キャノピー) =================
// 物理的な計器を最小にし、情報はキャノピー手前に浮かぶホログラムへ。視線を前方から外さずに読める
function conceptA(){
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({color: 0x121821, metalness: .72, roughness: .36, envMapIntensity: .9, side: THREE.DoubleSide});
  const frameM = new THREE.MeshStandardMaterial({color: 0x1a202a, metalness: .85, roughness: .28, envMapIntensity: 1.1});
  // 低く彫刻的なダッシュ(側面 + 天面)
  const arc = 2.1, ts = Math.PI - arc/2;
  const side = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, .4, 72, 1, true, ts, arc), dark); side.position.y = -.8;
  const topG = new THREE.RingGeometry(.78, 1.1, 72, 1, Math.PI/2 - arc/2, arc); topG.rotateX(-Math.PI/2);
  const top = new THREE.Mesh(topG, dark); top.position.y = -.6;
  // 天面の縁の細い光(状態色)
  const stripG = new THREE.TorusGeometry(.79, .004, 6, 120, arc); stripG.rotateZ(Math.PI/2 - arc/2); stripG.rotateX(-Math.PI/2);
  const strip = new THREE.Mesh(stripG, new THREE.MeshBasicMaterial({color: hdr(0x39f3ff, 2.2)})); strip.position.y = -.595;
  // キャノピーの枠(弓形 + 左右の支柱)
  const bowG = new THREE.TorusGeometry(2.05, .028, 10, 96, 2.9); bowG.rotateZ(Math.PI/2 - 1.45);
  const bow = new THREE.Mesh(bowG, frameM); bow.position.set(0, -1.0, -1.95);
  // キャノピーのガラス(縁ほど光るフレネル)
  const glass = new THREE.Mesh(new THREE.SphereGeometry(2.3, 48, 32, Math.PI*1.5 - 1.5, 3.0, .25, 1.6), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 n; varying vec3 v; void main(){ n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 n; varying vec3 v; void main(){ float f = pow(1. - abs(dot(n, v)), 3.); gl_FragColor = vec4(vec3(.5,.8,1.)*f*.35, f*.35); }`}));
  glass.position.y = -.2;
  g.add(side, top, strip, bow, glass);
  // ---- ホログラム ----
  const Z = -2.3;
  const tape = uiPlane(.34, 1.0, 170, 500, (c, w, h)=>{   // 速度テープ(左)
    const col = stateCol(), v = W.speed*4;
    c.strokeStyle = col; c.globalAlpha = .75; c.lineWidth = 2;
    const off = (v % 100)/100*50;
    for(let i = -6; i <= 6; i++){ const y = h/2 + i*50 + off, major = true;
      c.beginPath(); c.moveTo(w - 10, y); c.lineTo(w - (major ? 40 : 25), y); c.stroke();
      const lab = Math.round(v/100 - i)*100; if(lab >= 0 && Math.abs(y - h/2) > 40){ c.font = F(16); c.fillStyle = col; c.textAlign = 'right'; c.fillText(lab, w - 48, y + 6); } }
    c.globalAlpha = 1;
    c.fillStyle = 'rgba(0,20,30,.6)'; c.fillRect(8, h/2 - 26, w - 16, 52); c.strokeStyle = col; c.strokeRect(8, h/2 - 26, w - 16, 52);
    glowText(c, String(Math.round(v)), w/2, h/2 + 11, 30, COL.white);
    glowText(c, 'km/s', w - 16, h/2 - 32, 12, col, 'right');
  });
  tape.position.set(-.78, -.12, Z); tape.rotation.y = .22;
  const shield = uiPlane(.62, .62, 300, 300, (c, w, h)=>{   // シールド弧(右)
    const col = stateCol(), cx = w/2, cy = h/2, r = 110;
    for(let i = 0; i < 3; i++){ const a0 = -Math.PI*.35 + i*Math.PI*.24, on = i < W.shields;
      c.lineWidth = 16; c.lineCap = 'butt'; c.strokeStyle = on ? col : 'rgba(255,255,255,.08)'; c.shadowColor = col; c.shadowBlur = on ? 14 : 0;
      c.beginPath(); c.arc(cx, cy, r, a0, a0 + Math.PI*.2); c.stroke(); }
    c.shadowBlur = 0;
    glowText(c, W.state === 'critical' ? 'CRITICAL' : 'SHIELD', cx + 40, cy - 4, 18, col, 'center');
    glowText(c, `◆ ${W.cores}`, cx + 40, cy + 30, 22, COL.white, 'center');
  });
  shield.position.set(.78, -.12, Z); shield.rotation.y = -.22;
  const topStrip = uiPlane(1.5, .15, 750, 75, (c, w, h)=>{   // 上: セクター + 方位目盛り
    const col = stateCol();
    c.strokeStyle = col; c.globalAlpha = .5; c.lineWidth = 2;
    for(let i = 0; i < 30; i++){ const x = ((i*40 + W.t*60) % 1200) - 225; if(x < 40 || x > w - 40) continue; c.beginPath(); c.moveTo(x, h - 8); c.lineTo(x, h - (i % 3 ? 16 : 26)); c.stroke(); }
    c.globalAlpha = 1;
    glowText(c, `S${String(W.sector.n).padStart(2, '0')} · ${W.sector.name}`, w/2, 32, 22, W.sectorFlash > 0 ? COL.white : col);
  });
  topStrip.position.set(0, .66, Z);
  const scoreL = uiPlane(.9, .12, 540, 72, (c, w, h)=>{   // レティクル下: スコア+コンボ
    glowText(c, W.score.toLocaleString(), w/2 - (W.mult > 1 ? 60 : 0), 46, 30, COL.white);
    if(W.mult > 1) glowText(c, `×${W.mult.toFixed(1)}`, w/2 + 120, 46, 26, '#ff5fd0');
  });
  scoreL.position.set(0, -.74, Z);
  const radar = uiPlane(.5, .5, 256, 256, (c, w, h)=>drawRadar(c, w, h, stateCol(), true));   // ダッシュ上の投影レーダー
  radar.position.set(0, -.54, -.95); radar.rotation.x = -1.1;
  const warn = uiPlane(7.2, 4.1, 720, 410, (c, w, h)=>{   // 危険時だけ視界の縁(キャノピーの縁)が赤く明滅
    if(W.state !== 'critical') return;
    const a = .16 + .12*Math.sin(W.t*9);
    const gr = c.createRadialGradient(w/2, h/2, h*.5, w/2, h/2, w*.6);
    gr.addColorStop(0, 'rgba(255,59,92,0)'); gr.addColorStop(1, `rgba(255,59,92,${a})`);
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  warn.position.set(0, 0, -2.6);
  const ui = [tape, shield, topStrip, scoreL, radar, warn];
  g.add(...ui);
  return {name: 'A — HOLO CANOPY', group: g, ui, update(){ strip.material.color.set(stateCol()).multiplyScalar(2.2); }};
}

// レーダー(上から見た岩の位置)
function drawRadar(c, w, h, col, holo){
  const cx = w/2, cy = h*.62, R = w*.42;
  c.strokeStyle = col; c.globalAlpha = holo ? .6 : .8; c.lineWidth = 2;
  for(const k of [.35, .7, 1]){ c.beginPath(); c.arc(cx, cy, R*k, Math.PI, 2*Math.PI); c.stroke(); }
  c.beginPath(); c.moveTo(cx - R, cy); c.lineTo(cx + R, cy); c.stroke();
  c.globalAlpha = 1;
  for(const p of RADAR){ const x = cx + p.x/90*R, y = cy + p.z/260*R; if(y > cy || Math.hypot(x - cx, y - cy) > R) continue;
    const near = p.z > -70; c.fillStyle = near ? COL.red : col; c.shadowColor = c.fillStyle; c.shadowBlur = 8;
    c.beginPath(); c.arc(x, y, near ? 5 : 3.5, 0, 7); c.fill(); }
  c.shadowBlur = 0;
  c.fillStyle = COL.white; c.beginPath(); c.moveTo(cx, cy - 9); c.lineTo(cx - 6, cy + 5); c.lineTo(cx + 6, cy + 5); c.fill();
}

// ================= 案B: TACTICAL DECK(実機志向の戦術コックピット) =================
// 眉庇(グレアシールド)の下に3面の多機能ディスプレイ、HUDコンバイナー、左右コンソール、HOTAS。役割ごとに情報を分ける
function conceptB(){
  const g = new THREE.Group();
  const panelM = new THREE.MeshStandardMaterial({color: 0x252a31, metalness: .55, roughness: .6, envMapIntensity: .7});
  const matte = new THREE.MeshStandardMaterial({color: 0x15181d, metalness: .3, roughness: .85, side: THREE.DoubleSide});
  const bezelM = new THREE.MeshStandardMaterial({color: 0x101216, metalness: .45, roughness: .7});
  const btnM = new THREE.MeshStandardMaterial({color: 0x3a3f47, metalness: .3, roughness: .6});
  const frameM = new THREE.MeshStandardMaterial({color: 0x1e232b, metalness: .8, roughness: .35});
  const amber = new THREE.MeshBasicMaterial({color: hdr(0xffb347, 1.1)});
  // 計器盤(角を丸めた板を押し出し、上端を奥へ倒す)
  const shape = new THREE.Shape(), PW = 1.2, PH = .22, rr = .05;
  shape.moveTo(-PW + rr, -PH); shape.lineTo(PW - rr, -PH); shape.quadraticCurveTo(PW, -PH, PW, -PH + rr); shape.lineTo(PW, PH - rr);
  shape.quadraticCurveTo(PW, PH, PW - rr, PH); shape.lineTo(-PW + rr, PH); shape.quadraticCurveTo(-PW, PH, -PW, PH - rr); shape.lineTo(-PW, -PH + rr); shape.quadraticCurveTo(-PW, -PH, -PW + rr, -PH);
  const panel = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, {depth: .06, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 2}), panelM);
  panel.position.set(0, -.64, -1.12); panel.rotation.x = -.3;
  g.add(panel);
  // 3面の多機能ディスプレイ + ベゼル + 周囲の押しボタン
  const mfds = [];
  [-.76, 0, .76].forEach((x, i)=>{
    const draw = [drawMfdFlight, drawMfdTactical, drawMfdDefense][i];
    const scr = uiPlane(.42, .31, 400, 304, draw, {holo: false, gain: 1.15});
    scr.position.set(x, 0, .082); panel.add(scr); mfds.push(scr);
    const bz = new THREE.Mesh(new THREE.ExtrudeGeometry((()=>{ const s = new THREE.Shape(); s.moveTo(-.245, -.19); s.lineTo(.245, -.19); s.lineTo(.245, .19); s.lineTo(-.245, .19); s.lineTo(-.245, -.19);
      const hole = new THREE.Path(); hole.moveTo(-.212, -.157); hole.lineTo(-.212, .157); hole.lineTo(.212, .157); hole.lineTo(.212, -.157); hole.lineTo(-.212, -.157); s.holes.push(hole); return s; })(),
      {depth: .02, bevelEnabled: true, bevelThickness: .006, bevelSize: .006, bevelSegments: 1}), bezelM);
    bz.position.set(x, 0, .07); panel.add(bz);
    for(let k = 0; k < 5; k++) for(const yy of [-.212, .212]){
      const b = new THREE.Mesh(new THREE.BoxGeometry(.045, .018, .014), btnM); b.position.set(x - .17 + k*.085, yy*.84, .09); panel.add(b);
    }
  });
  // 眉庇(グレアシールド): 計器盤の上に張り出す曲面
  const hoodG = new THREE.RingGeometry(.86, 1.18, 64, 1, Math.PI/2 - .8, 1.6); hoodG.rotateX(-Math.PI/2 + .12);
  const hood = new THREE.Mesh(hoodG, matte); hood.position.set(0, -.4, 0);
  const hoodEdgeG = new THREE.TorusGeometry(.86, .004, 6, 96, 1.6); hoodEdgeG.rotateZ(Math.PI/2 - .8); hoodEdgeG.rotateX(-Math.PI/2 + .12);
  const hoodEdge = new THREE.Mesh(hoodEdgeG, amber); hoodEdge.position.copy(hood.position);
  g.add(hood, hoodEdge);
  // HUDコンバイナー(レティクルが投影される斜めのガラス)
  const comb = new THREE.Mesh(new THREE.PlaneGeometry(.46, .3), new THREE.MeshStandardMaterial({color: 0x9fffd0, metalness: .95, roughness: .05, transparent: true, opacity: .1, envMapIntensity: 2}));
  comb.position.set(0, -.25, -.95); comb.rotation.x = -.45;
  const combFrame = new THREE.Mesh(new THREE.TorusGeometry(.012, .006, 6, 12), frameM);
  const posts = [-.22, .22].map(x=>{ const p = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .2, 8), frameM); p.position.set(x, -.36, -.9); return p; });
  g.add(comb, ...posts);
  // 左右コンソール(トグルスイッチ列 + 琥珀の刻印灯)
  for(const sx of [-1, 1]){
    const con = new THREE.Mesh(new THREE.BoxGeometry(.5, .12, 1.0), panelM); con.position.set(sx*1.02, -.9, -.55); con.rotation.z = sx*.18; g.add(con);
    for(let r = 0; r < 3; r++) for(let k = 0; k < 4; k++){
      const sw = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .05, 6), btnM);
      sw.position.set(sx*(.86 + k*.08), -.82 + k*.012, -.25 - r*.22); sw.rotation.x = -.5; g.add(sw);
    }
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(.3, .012), amber); lab.position.set(sx*.98, -.835, -.95); lab.rotation.x = -Math.PI/2; lab.rotation.y = 0; g.add(lab);
  }
  // HOTAS: 操縦桿(ブーツ・グリップ・トリガー)とスロットル
  const rubber = new THREE.MeshStandardMaterial({color: 0x0c0d10, roughness: .9});
  const stick = new THREE.Group(); stick.position.set(.62, -1.1, -.62);
  const boot = new THREE.Mesh(new THREE.ConeGeometry(.09, .16, 16), rubber); boot.position.y = .06;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.02, .025, .22, 12), frameM); shaft.position.y = .2;
  const grip = new THREE.Mesh(new THREE.CapsuleGeometry(.045, .13, 6, 16), rubber); grip.position.y = .36; grip.rotation.x = .25;
  const trig = new THREE.Mesh(new THREE.BoxGeometry(.02, .04, .02), frameM); trig.position.set(0, .36, -.05);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .02, 8), amber); hat.position.set(0, .46, -.01);
  stick.add(boot, shaft, grip, trig, hat); g.add(stick);
  const thr = new THREE.Group(); thr.position.set(-.9, -1.02, -.7);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(.08, .03, .36), panelM);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(.1, .09, .08), rubber); handle.position.set(0, .07, 0);
  thr.add(rail, handle); g.add(thr);
  // キャノピー枠(太めの弓形 + 側面の縁)
  const bowG = new THREE.TorusGeometry(2.0, .045, 10, 96, 2.9); bowG.rotateZ(Math.PI/2 - 1.45);
  const bow = new THREE.Mesh(bowG, frameM); bow.position.set(0, -1.0, -1.7);
  const sills = [-1, 1].map(sx=>{ const s = new THREE.Mesh(new THREE.BoxGeometry(.06, .05, 1.6), frameM); s.position.set(sx*1.45, -.72, -.9); return s; });
  g.add(bow, ...sills);
  // 機内灯(琥珀の手元灯 + 画面の反射光)
  const flood = new THREE.PointLight(0xffb070, 1.6, 2.2, 2); flood.position.set(0, -.35, -.35);
  const scrLight = new THREE.PointLight(0x39f3ff, .8, 1.6, 2); scrLight.position.set(0, -.55, -.8);
  g.add(flood, scrLight);
  return {name: 'B — TACTICAL DECK', group: g, ui: mfds, update(){ handle.position.z = .1 - Math.min(1, (W.speed - 110)/530)*.2; }};
}
function mfdFrame(c, w, h, title){
  c.fillStyle = '#03080b'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(125,255,176,.07)'; for(let y = 0; y < h; y += 4) c.fillRect(0, y, w, 1);   // 走査線
  glowText(c, title, 16, 28, 16, COL.green, 'left', 4);
}
function drawMfdFlight(c, w, h){
  mfdFrame(c, w, h, 'FLIGHT');
  const col = COL.green, cx = w/2, cy = h/2 + 30, R = 92, a0 = Math.PI*.8, sw = Math.PI*1.4, k = Math.min(1, (W.speed - 110)/530);
  c.lineWidth = 8; c.strokeStyle = 'rgba(125,255,176,.15)'; c.beginPath(); c.arc(cx, cy, R, a0, a0 + sw); c.stroke();
  c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 8; c.beginPath(); c.arc(cx, cy, R, a0, a0 + sw*Math.max(.01, k)); c.stroke(); c.shadowBlur = 0;
  glowText(c, String(Math.round(W.speed*4)), cx, cy + 12, 40, COL.white, 'center', 6);
  glowText(c, 'km/s', cx, cy + 40, 14, col, 'center', 4);
  glowText(c, `THR ${Math.round(k*100)}%`, w - 16, 28, 14, COL.amber, 'right', 4);
}
function drawMfdTactical(c, w, h){ mfdFrame(c, w, h, `TACTICAL  S${String(W.sector.n).padStart(2, '0')}`); drawRadar(c, w, h, COL.green, false); }
function drawMfdDefense(c, w, h){
  mfdFrame(c, w, h, 'DEFENSE / ARM');
  const col = W.state === 'critical' ? COL.red : W.state === 'low' ? COL.amber : COL.green;
  for(let i = 0; i < 3; i++){ const on = i < W.shields; c.fillStyle = on ? col : 'rgba(255,255,255,.06)'; c.shadowColor = col; c.shadowBlur = on ? 10 : 0; c.fillRect(30 + i*118, 60, 104, 40); }
  c.shadowBlur = 0;
  glowText(c, W.state === 'critical' ? 'SHIELD CRITICAL' : 'SHIELD', w/2, 132, 18, col, 'center', 4);
  glowText(c, `CORE ◆ ${W.cores}`, 30, 190, 22, COL.white, 'left', 4);
  glowText(c, W.score.toLocaleString(), w - 30, 190, 22, COL.white, 'right', 4);
  if(W.mult > 1) glowText(c, `COMBO ×${W.mult.toFixed(1)}`, w - 30, 230, 18, COL.amber, 'right', 4);
}

// ================= 案C: ZERO-UI POD(ゼロUIポッド) =================
// 計器パネルを持たない継ぎ目のない陶器質のポッド。状態は光の継ぎ目の色、数値はレティクルを囲むリング1つに集約
function conceptC(){
  const g = new THREE.Group();
  const ceramic = new THREE.MeshStandardMaterial({color: 0x8b939c, metalness: .05, roughness: .62, envMapIntensity: .35, side: THREE.BackSide});
  const R = 1.9, C3 = Math.PI*1.5, WH = .95, UP = .55, DN = .42, cy = -.1;
  const seg = (p0, pl, t0, tl)=>{ const m = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 40, p0, pl, t0, tl), ceramic); m.position.set(0, cy, .25); g.add(m); };
  seg(C3 + WH, 1.4, .35, 2.3); seg(C3 - WH - 1.4, 1.4, .35, 2.3);       // 左右
  seg(C3 - WH, 2*WH, .35, Math.PI/2 - UP - .35);                          // 上
  seg(C3 - WH, 2*WH, Math.PI/2 + DN, 2.65 - Math.PI/2 - DN);              // 下
  // 窓枠の光の継ぎ目(状態色で脈動)
  const seamMat = new THREE.MeshBasicMaterial({color: hdr(0x39f3ff, 2.4)});
  const sp = (phi, th)=>new THREE.Vector3(-(R - .02)*Math.cos(phi)*Math.sin(th), (R - .02)*Math.cos(th) + cy, (R - .02)*Math.sin(phi)*Math.sin(th) + .25);
  const curve = pts=>new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 64, .008, 6, false), seamMat);
  const N = 40, line = (f)=>Array.from({length: N + 1}, (_, i)=>f(i/N));
  g.add(curve(line(k=>sp(C3 - WH + 2*WH*k, Math.PI/2 - UP))), curve(line(k=>sp(C3 - WH + 2*WH*k, Math.PI/2 + DN))),
        curve(line(k=>sp(C3 - WH, Math.PI/2 - UP + (UP + DN)*k))), curve(line(k=>sp(C3 + WH, Math.PI/2 - UP + (UP + DN)*k))));
  // レティクルを囲むリングHUD(速度・シールド・コンボを弧で)
  const ring = uiPlane(1.25, 1.25, 600, 600, (c, w, h)=>{
    const col = stateCol(), cx = w/2, cy2 = h/2, k = Math.min(1, (W.speed - 110)/530);
    c.lineCap = 'round';
    c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.arc(cx, cy2, 250, Math.PI*.72, Math.PI*1.28); c.stroke();
    c.strokeStyle = col; c.shadowColor = col; c.shadowBlur = 12; c.beginPath(); c.arc(cx, cy2, 250, Math.PI*1.28 - Math.PI*.56*k, Math.PI*1.28); c.stroke();
    for(let i = 0; i < 3; i++){ const a = -Math.PI*.26 + i*Math.PI*.19, on = i < W.shields;
      c.strokeStyle = on ? col : 'rgba(255,255,255,.08)'; c.shadowBlur = on ? 12 : 0; c.lineWidth = 9;
      c.beginPath(); c.arc(cx, cy2, 250, a, a + Math.PI*.15); c.stroke(); }
    if(W.mult > 1){ c.strokeStyle = '#ff5fd0'; c.shadowColor = '#ff5fd0'; c.lineWidth = 5; c.beginPath(); c.arc(cx, cy2, 232, Math.PI*.35, Math.PI*.35 + Math.PI*.3*Math.min(1, (W.mult - 1)/3)); c.stroke(); }
    c.shadowBlur = 0;
    glowText(c, String(Math.round(W.speed*4)), cx - 250, cy2 + 70, 20, COL.white, 'center', 6);
    glowText(c, W.score.toLocaleString(), cx, cy2 + 292, 20, COL.white, 'center', 6);
  });
  ring.position.set(0, -.65, -3.02);
  // 近接する岩の方向を窓の縁に示す(周辺視野で気づく)
  const threat = uiPlane(3.4, 2.1, 680, 420, (c, w, h)=>{
    // 近い4個だけを、その方向の窓の縁(楕円の外周)に矢印で示す
    const near = RADAR.filter(p=>p.z < -6 && p.z > -90).sort((a, b)=>b.z - a.z).slice(0, 4);
    for(const p of near){
      const a = Math.atan2(p.y + .1*p.z*0, p.x), cx = w/2 + Math.cos(a)*w*.47, cy2 = h/2 - Math.sin(a)*h*.46, s = 1 - (-p.z)/90;
      c.fillStyle = `rgba(255,${Math.round(190 - 130*s)},80,${.35 + .6*s})`; c.shadowColor = c.fillStyle; c.shadowBlur = 10;
      c.save(); c.translate(cx, cy2); c.rotate(-a);
      c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -11); c.lineTo(-8, 11); c.fill(); c.restore();
    }
    c.shadowBlur = 0;
  });
  threat.position.set(0, -.1, -2.4);
  // 手元の浮遊タッチストリップ(コア数・セクター)
  const stripUi = uiPlane(.8, .09, 480, 54, (c, w, h)=>{
    c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(0, 0, w, h);
    glowText(c, `◆ ${W.cores}`, 24, 36, 22, COL.white, 'left', 4);
    glowText(c, `S${String(W.sector.n).padStart(2, '0')} ${W.sector.name}`, w - 20, 36, 18, stateCol(), 'right', 6);
  });
  stripUi.position.set(0, -.96, -1.3); stripUi.rotation.x = -.6;
  g.add(ring, threat, stripUi);
  return {name: 'C — ZERO-UI POD', group: g, ui: [ring, threat, stripUi], update(){
    const pulse = W.state === 'critical' ? (.6 + .4*Math.sin(W.t*9)) : 1;
    seamMat.color.set(stateCol()).multiplyScalar(2.4*pulse);
  }};
}

// ================= 案A改: HOLO CANOPY + 物理の操縦桿とスピードメーター =================
// 調査からの反映: ガンダムの全天周囲モニター(視界を覆うガラス面に情報ウィンドウが浮かぶ)/ オブリビオン(警告だけ赤く中央へ)/
// Star Citizen(重要なものほど手前・色数を絞る)/ X-wing・実機(中央の操縦桿と手前の計器で「操縦している」実感)
// grip: 'center'(画面下中央の操縦桿) | 'twin'(ガンダム式の左右グリップ)
function conceptA2(grip = 'center'){
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({color: 0x121821, metalness: .72, roughness: .36, envMapIntensity: .9, side: THREE.DoubleSide});
  const frameM = new THREE.MeshStandardMaterial({color: 0x1a202a, metalness: .85, roughness: .28, envMapIntensity: 1.1});
  const rubber = new THREE.MeshStandardMaterial({color: 0x0d0f13, metalness: .2, roughness: .82});
  const metal = new THREE.MeshStandardMaterial({color: 0x8d96a3, metalness: .9, roughness: .3, envMapIntensity: 1.2});
  const glowM = new THREE.MeshBasicMaterial({color: hdr(0x39f3ff, 2.2)});
  // 計器台(案Aより少し高く・中央に張り出し)
  const arc = 2.1, ts = Math.PI - arc/2;
  const side = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, .4, 72, 1, true, ts, arc), dark); side.position.y = -.78;
  const topG = new THREE.RingGeometry(.74, 1.05, 72, 1, Math.PI/2 - arc/2, arc); topG.rotateX(-Math.PI/2);
  const top = new THREE.Mesh(topG, dark); top.position.y = -.58;
  const stripG = new THREE.TorusGeometry(.75, .004, 6, 120, arc); stripG.rotateZ(Math.PI/2 - arc/2); stripG.rotateX(-Math.PI/2);
  const strip = new THREE.Mesh(stripG, glowM); strip.position.y = -.575;
  // キャノピー枠 + ガラス(全天周囲モニターのように、縁ほど光り、うっすら継ぎ目の格子が見える)
  const bowG = new THREE.TorusGeometry(2.05, .03, 10, 96, 2.9); bowG.rotateZ(Math.PI/2 - 1.45);
  const bow = new THREE.Mesh(bowG, frameM); bow.position.set(0, -1.0, -1.95);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(2.3, 48, 32, Math.PI*1.5 - 1.5, 3.0, .25, 1.6), new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 n; varying vec3 v; varying vec2 u; void main(){ u = uv; n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying vec3 n; varying vec3 v; varying vec2 u;
      void main(){ float f = pow(1. - abs(dot(n, v)), 3.);
        vec2 q = abs(fract(u*vec2(18., 9.)) - .5); float grid = smoothstep(.49, .5, max(q.x, q.y))*.05;   // 継ぎ目の格子(ごく薄く)
        float a = f*.35 + grid; gl_FragColor = vec4(vec3(.5,.8,1.)*a, a); }`}));
  glass.position.y = -.2;
  g.add(side, top, strip, bow, glass);

  // ---- スピードメーター(計器台中央の物理計器: 金属の筐体 + ガラス越しの表示) ----
  const meterHouse = new THREE.Group();
  if(grip === 'center'){ meterHouse.position.set(-.44, -.47, -1.0); meterHouse.rotation.set(-.3, .32, 0); }   // 操縦桿の左(車のメーター位置)
  else { meterHouse.position.set(0, -.45, -.9); meterHouse.rotation.x = -.3; }   // 計器台の上面(y -.58・半径 .74〜1.05)の上に載せる
  meterHouse.scale.setScalar(.95);
  const archShape = new THREE.Shape(); archShape.moveTo(-.3, -.1); archShape.lineTo(.3, -.1); archShape.absarc(0, -.1, .3, 0, Math.PI, false);
  const house = new THREE.Mesh(new THREE.ExtrudeGeometry(archShape, {depth: .05, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2}), frameM);
  house.position.z = -.05;
  const meter = uiPlane(.54, .3, 540, 300, (c, w, h)=>{
    const col = stateCol(), cx = w/2, cy = h - 22, R = 230, k = Math.max(0, Math.min(1, (W.speed - 110)/370));   // 本番の SPD_MAX 480 に合わせる
    const a0 = Math.PI*1.08, sw = Math.PI*.84;
    c.fillStyle = '#02070c'; c.beginPath(); c.arc(cx, cy, R + 14, Math.PI, 0); c.fill();
    c.lineCap = 'butt';
    c.lineWidth = 16; c.strokeStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.arc(cx, cy, R - 12, a0, a0 + sw); c.stroke();
    c.strokeStyle = 'rgba(255,59,92,.45)'; c.beginPath(); c.arc(cx, cy, R - 12, a0 + sw*.86, a0 + sw); c.stroke();   // レッドゾーン
    c.strokeStyle = k > .86 ? COL.red : col; c.shadowColor = c.strokeStyle; c.shadowBlur = 14;
    c.beginPath(); c.arc(cx, cy, R - 12, a0, a0 + sw*Math.max(.01, k)); c.stroke(); c.shadowBlur = 0;
    c.strokeStyle = 'rgba(200,230,255,.55)'; c.lineWidth = 3;
    for(let i = 0; i <= 12; i++){ const a = a0 + sw*i/12, l = i % 3 ? 14 : 26;
      c.beginPath(); c.moveTo(cx + Math.cos(a)*(R - 32), cy + Math.sin(a)*(R - 32)); c.lineTo(cx + Math.cos(a)*(R - 32 - l), cy + Math.sin(a)*(R - 32 - l)); c.stroke(); }
    const na = a0 + sw*k; c.strokeStyle = COL.white; c.lineWidth = 4; c.shadowColor = col; c.shadowBlur = 10;
    c.beginPath(); c.moveTo(cx + Math.cos(na)*(R - 95), cy + Math.sin(na)*(R - 95)); c.lineTo(cx + Math.cos(na)*(R - 4), cy + Math.sin(na)*(R - 4)); c.stroke(); c.shadowBlur = 0;   // 数字に掛からない短い指針
    glowText(c, String(Math.round(W.speed*4)), cx, cy - 64, 58, COL.white, 'center', 8);
    glowText(c, 'km/s', cx, cy - 28, 18, col, 'center', 6);
    glowText(c, `THR ${Math.round(k*100)}%`, cx, cy - 4, 14, COL.amber, 'center', 4);
  }, {holo: false, gain: 1.1});
  meter.position.set(0, .01, .012);
  const meterGlass = new THREE.Mesh(new THREE.PlaneGeometry(.56, .32), new THREE.MeshStandardMaterial({color: 0x0a1418, metalness: .9, roughness: .05, transparent: true, opacity: .12, envMapIntensity: 2}));
  meterGlass.position.set(0, .01, .03);
  meterHouse.add(house, meter, meterGlass);
  g.add(meterHouse);

  // ---- 操縦桿 ----
  const sticks = [];
  const gripM = new THREE.MeshStandardMaterial({color: 0x2c333e, metalness: .35, roughness: .5, envMapIntensity: .9});
  const makeStick = (s = 1)=>{
    const st = new THREE.Group();
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(.04, .09, .1, 20, 3), rubber); boot.position.y = .05;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.013, .017, .1, 16), metal); shaft.position.y = .14;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.028, .003, 6, 32), glowM); ring.rotation.x = Math.PI/2; ring.position.y = .182;
    // 人間工学グリップ: 回転体の輪郭に指のくびれ、上部は親指の台座(前傾)
    const prof = [[0, .18], [.026, .18], [.03, .2], [.034, .215], [.031, .228], [.036, .245], [.033, .26], [.037, .278], [.036, .3], [.033, .32], [.036, .34], [.03, .352], [.016, .36], [0, .362]]
      .map(([r, y])=>new THREE.Vector2(r, y));
    const gripG = new THREE.LatheGeometry(prof, 28); gripG.scale(1, 1, 1.25);
    const grp = new THREE.Group(); grp.rotation.x = -.18;
    const body = new THREE.Mesh(gripG, gripM);
    const head = new THREE.Mesh(new THREE.CapsuleGeometry(.024, .05, 6, 16), gripM); head.rotation.x = Math.PI/2; head.position.set(0, .352, -.012); head.scale.set(1.15, 1, .75);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(.009, .011, .014, 12), metal); hat.position.set(0, .374, .006);
    const hatTip = new THREE.Mesh(new THREE.SphereGeometry(.006, 10, 8), glowM); hatTip.position.set(0, .382, .006);
    const fire = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .01, 12), new THREE.MeshBasicMaterial({color: hdr(0xff3b5c, 1.8)}));
    fire.rotation.z = Math.PI/2; fire.position.set(-.03, .35, -.025);
    const trig = new THREE.Mesh(new THREE.CapsuleGeometry(.007, .03, 4, 8), metal); trig.position.set(0, .31, -.044); trig.rotation.x = .3;
    const seam = new THREE.Mesh(new THREE.TorusGeometry(.0335, .0016, 6, 32), glowM); seam.rotation.x = Math.PI/2; seam.position.y = .3; seam.scale.set(1, 1.25, 1);
    grp.add(body, head, hat, hatTip, fire, trig, seam);
    st.add(boot, shaft, ring, grp); st.scale.setScalar(s);
    const pivot = new THREE.Group(); pivot.add(st); sticks.push(pivot);
    return pivot;
  };
  if(grip === 'center'){
    const p = makeStick(1.3); p.position.set(0, -.76, -.55); g.add(p);   // 画面下中央: グリップ上部と親指台座だけが見える高さ
  }else{
    for(const sx of [-1, 1]){ const p = makeStick(1.2); p.position.set(sx*.56, -.74, -.6); p.rotation.z = -sx*.12; g.add(p); }   // ガンダム式: 左右の肘掛けの先
  }

  // ---- ホログラム(速度はメーターに一本化) ----
  const Z = -2.3;
  const shieldHolo = uiPlane(.62, .62, 300, 300, (c, w, h)=>{   // 左: シールド(案Aの右から移動)
    const col = stateCol(), cx = w/2, cy = h/2, r = 110;
    for(let i = 0; i < 3; i++){ const a0 = Math.PI*.85 + i*Math.PI*.24, on = i < W.shields;
      c.lineWidth = 16; c.strokeStyle = on ? col : 'rgba(255,255,255,.08)'; c.shadowColor = col; c.shadowBlur = on ? 14 : 0;
      c.beginPath(); c.arc(cx, cy, r, a0, a0 + Math.PI*.2); c.stroke(); }
    c.shadowBlur = 0;
    glowText(c, W.state === 'critical' ? 'CRITICAL' : 'SHIELD', cx - 40, cy - 4, 18, col, 'center');
  });
  shieldHolo.position.set(-.8, -.1, Z); shieldHolo.rotation.y = .22;
  const armHolo = uiPlane(.62, .62, 300, 300, (c, w, h)=>{   // 右: 武装(コア残数)とコンボ
    const col = stateCol(), cx = w/2, cy = h/2;
    c.strokeStyle = col; c.globalAlpha = .5; c.lineWidth = 2; c.strokeRect(70, 90, 160, 120);   // 情報ウィンドウの枠(全天周囲モニター風)
    c.globalAlpha = 1; c.fillStyle = col; c.fillRect(70, 80, 60, 10);
    glowText(c, 'ARM', 136, 90, 12, col, 'left', 4);
    glowText(c, `◆ ${W.cores}`, cx, cy + 6, 34, COL.white);
    glowText(c, 'CORE', cx, cy + 34, 14, col);
    if(W.mult > 1) glowText(c, `×${W.mult.toFixed(1)}`, cx, cy + 90, 28, '#ff5fd0');
  });
  armHolo.position.set(.8, -.1, Z); armHolo.rotation.y = -.22;
  const topStrip = uiPlane(1.5, .15, 750, 75, (c, w, h)=>{
    const col = stateCol();
    c.strokeStyle = col; c.globalAlpha = .5; c.lineWidth = 2;
    for(let i = 0; i < 30; i++){ const x = ((i*40 + W.t*60) % 1200) - 225; if(x < 40 || x > w - 40) continue; c.beginPath(); c.moveTo(x, h - 8); c.lineTo(x, h - (i % 3 ? 16 : 26)); c.stroke(); }
    c.globalAlpha = 1;
    glowText(c, `S${String(W.sector.n).padStart(2, '0')} · ${W.sector.name}`, w/2, 32, 22, col);
    glowText(c, W.score.toLocaleString(), w - 30, 32, 22, COL.white, 'right', 6);
  });
  topStrip.position.set(0, .66, Z);
  const radar = uiPlane(.36, .36, 256, 256, (c, w, h)=>drawRadar(c, w, h, stateCol(), true));   // 計器台右に投影
  radar.position.set(.46, -.5, -.92); radar.rotation.set(-1.0, 0, -.25);
  const alert = uiPlane(1.6, .2, 800, 100, (c, w, h)=>{   // 警告は中央に昇格(オブリビオン)
    if(W.state !== 'critical') return;
    const a = .55 + .45*Math.sin(W.t*9); c.globalAlpha = a;
    glowText(c, '⚠  SHIELD CRITICAL', w/2, 64, 40, COL.red, 'center', 16); c.globalAlpha = 1;
  });
  alert.position.set(0, .3, Z);
  const edge = uiPlane(7.2, 4.1, 720, 410, (c, w, h)=>{
    if(W.state !== 'critical') return;
    const a = .16 + .12*Math.sin(W.t*9), gr = c.createRadialGradient(w/2, h/2, h*.5, w/2, h/2, w*.6);
    gr.addColorStop(0, 'rgba(255,59,92,0)'); gr.addColorStop(1, `rgba(255,59,92,${a})`); c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  edge.position.set(0, 0, -2.6);
  const ui = [meter, shieldHolo, armHolo, topStrip, radar, alert, edge];
  g.add(shieldHolo, armHolo, topStrip, radar, alert, edge);
  return {name: grip === 'center' ? 'A改 — CENTER STICK' : 'A改 — TWIN GRIP', group: g, ui, update(){
    strip.material = glowM; glowM.color.set(stateCol()).multiplyScalar(2.2);
    // 入力に合わせて操縦桿が傾く(デモ: 左右・前後にゆっくり)
    const ix = Math.sin(W.t*.9)*.28, iy = Math.sin(W.t*.63)*.2;
    for(const p of sticks){ p.rotation.z = -ix; p.rotation.x = iy; }
  }};
}
