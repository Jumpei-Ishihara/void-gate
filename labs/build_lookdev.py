# 本番index.htmlから Assets / glowTexture を抽出し、比較用ルックデブ(labs/lookdev.html)を生成する。
# 本番と同一の岩・機体・コア生成コードを使うことで「素材は同じ、照明/材質/後処理だけが違う」比較にする。
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root/'index.html').read_text()
lines = src.split('\n')
def block(start_pat, end_pat):
    s = next(i for i,l in enumerate(lines) if re.match(start_pat, l))
    e = next(i for i in range(s+1, len(lines)) if re.match(end_pat, lines[i]))
    return '\n'.join(lines[s:e+1])
glow = block(r'^function glowTexture', r'^}$')
assets = block(r'^const Assets = \(\(\)=>\{', r'^\}\)\(\);$')

html = r'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>VOID GATE — Look-dev 比較(現行 vs 提案)</title>
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:system-ui,-apple-system,sans-serif}
  canvas{position:fixed;top:0;height:100%;display:block}
  #ca{left:0;width:50%} #cb{right:0;width:50%}
  body.only-a #cb, body.only-b #ca{display:none}
  body.only-a #ca, body.only-b #cb{width:100%}
  .lbl{position:fixed;top:14px;padding:6px 12px;font:600 12px/1 system-ui;letter-spacing:.12em;
       color:#dff;background:rgba(0,10,20,.6);border:1px solid rgba(0,240,255,.35);z-index:2}
  #la{left:14px} #lb{left:calc(50% + 14px)}
  body.only-a #lb, body.only-b #la{display:none}
  body.only-b #lb{left:14px}
  #divider{position:fixed;left:50%;top:0;bottom:0;width:1px;background:rgba(0,240,255,.5);z-index:2}
  body.only-a #divider, body.only-b #divider{display:none}
  #ui{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:3}
  #ui button{font:600 12px system-ui;padding:8px 12px;color:#dff;background:rgba(0,10,20,.75);
       border:1px solid rgba(0,240,255,.4);cursor:pointer}
  #ui button.on{background:rgba(0,240,255,.25)}
  #stats{position:fixed;bottom:56px;left:50%;transform:translateX(-50%);font:12px ui-monospace,monospace;
       color:#9fe;background:rgba(0,10,20,.7);padding:6px 10px;white-space:pre;z-index:3}
</style>
</head>
<body>
<canvas id="ca"></canvas><canvas id="cb"></canvas><div id="divider"></div>
<div class="lbl" id="la">A — 現行 (CURRENT)</div>
<div class="lbl" id="lb">B — 提案 (PROPOSED)</div>
<div id="ui">
  <button data-v="split" class="on">左右比較</button><button data-v="a">現行のみ</button><button data-v="b">提案のみ</button>
  <button data-cam="chase" class="on">追跡視点</button><button data-cam="close">岩の接写</button>
  <button id="pause">一時停止</button>
</div>
<div id="stats"></div>
<script type="importmap">
{"imports":{"three":"../libs/three.module.js","three/addons/":"../libs/addons/"}}
</script>
<script type="module">
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';

const IS_TOUCH = false;
/* ---- 本番index.htmlから自動抽出(同一コード) ---- */
__GLOW__
const starTex = glowTexture();
__ASSETS__
/* ---- 抽出ここまで ---- */

// ================= 共通: 決定的な配置(A/Bで完全に同じ位置・同じ岩) =================
let seed = 7; const rnd = ()=>((seed = (seed*1664525 + 1013904223)>>>0)/4294967296);
const LAYOUT = [
  {x:-9, y:2.5, z:-26, s:6.2, g:5}, {x:11, y:-4, z:-44, s:5.2, g:2}, {x:-3, y:7, z:-74, s:7.5, g:1},
  {x:6, y:3, z:-18, s:2.2, g:3},
];
for(let i=0;i<34;i++) LAYOUT.push({x:(rnd()-.5)*110, y:(rnd()-.5)*80, z:-60 - rnd()*820, s:2 + rnd()*6, g:i%8});
const SPINS = LAYOUT.map(()=>({x:(rnd()-.5)*.5, y:(rnd()-.5)*.5, z:(rnd()-.5)*.4}));

// ================= 提案B用: 生成テクスチャ(外部素材なし) =================
// 高さ(グレースケールcanvas) → Sobelで法線マップ化
function heightToNormal(srcCanvas, strength){
  const w = srcCanvas.width, h = srcCanvas.height;
  const sd = srcCanvas.getContext('2d').getImageData(0,0,w,h).data;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const oc = out.getContext('2d'), od = oc.createImageData(w,h);
  const H = (x,y)=>sd[(((y+h)%h)*w + ((x+w)%w))*4]/255;
  for(let y=0;y<h;y++) for(let x=0;x<w;x++){
    const dx = (H(x+1,y-1)+2*H(x+1,y)+H(x+1,y+1)) - (H(x-1,y-1)+2*H(x-1,y)+H(x-1,y+1));
    const dy = (H(x-1,y+1)+2*H(x,y+1)+H(x+1,y+1)) - (H(x-1,y-1)+2*H(x,y-1)+H(x+1,y-1));
    let nx = -dx*strength, ny = -dy*strength, nz = 1; const L = Math.hypot(nx,ny,nz);
    const i = (y*w+x)*4;
    od.data[i] = (nx/L*.5+.5)*255; od.data[i+1] = (ny/L*.5+.5)*255; od.data[i+2] = (nz/L*.5+.5)*255; od.data[i+3] = 255;
  }
  oc.putImageData(od,0,0);
  const t = new THREE.CanvasTexture(out); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// 岩の高さ: 多オクターブの斑+クレーター(縁が盛り上がる)
function rockHeightCanvas(size){
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0,0,size,size);
  let s2 = 91; const r2 = ()=>((s2 = (s2*1664525 + 1013904223)>>>0)/4294967296);
  for(let o=0;o<5;o++){ const n = 30<<o, cell = size/Math.sqrt(n);
    for(let i=0;i<n;i++){ g.fillStyle = r2()<.5 ? `rgba(255,255,255,${.07/(o+1)})` : `rgba(0,0,0,${.09/(o+1)})`;
      g.beginPath(); g.arc(r2()*size, r2()*size, cell*(.4+r2()*.9), 0, 7); g.fill(); } }
  for(let i=0;i<60;i++){ const x=r2()*size, y=r2()*size, r=size*(.008+Math.pow(r2(),2.2)*.06);
    const rg = g.createRadialGradient(x,y,0,x,y,r*1.25);
    rg.addColorStop(0,'rgba(0,0,0,.55)'); rg.addColorStop(.72,'rgba(0,0,0,.18)');
    rg.addColorStop(.86,'rgba(255,255,255,.28)'); rg.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(x,y,r*1.25,0,7); g.fill(); }
  const id = g.getImageData(0,0,size,size), d = id.data;
  for(let i=0;i<d.length;i+=4){ const n=(r2()-.5)*26; d[i]+=n; d[i+1]+=n; d[i+2]+=n; }
  g.putImageData(id,0,0); return c;
}
// 機体の外板: パネル継ぎ目+リベット
function hullHeightCanvas(size){
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#9a9a9a'; g.fillRect(0,0,size,size);
  let s3 = 17; const r3 = ()=>((s3 = (s3*1664525 + 1013904223)>>>0)/4294967296);
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 3;
  const split = (x,y,w,h,d)=>{ if(d>4 || w<40 || h<40){ g.strokeRect(x+1.5,y+1.5,w-3,h-3);
      g.fillStyle='#c8c8c8'; if(r3()<.5) for(let k=6;k<w-6;k+=18){ g.beginPath(); g.arc(x+k,y+7,2.2,0,7); g.fill(); } return; }
    if(w>h){ const k=w*(.3+r3()*.4); split(x,y,k,h,d+1); split(x+k,y,w-k,h,d+1); }
    else { const k=h*(.3+r3()*.4); split(x,y,w,k,d+1); split(x,y+k,w,h-k,d+1); } };
  split(0,0,size,size,0); return c;
}
function roughFromHeight(canvas, base, amp){
  const w = canvas.width, sd = canvas.getContext('2d').getImageData(0,0,w,w).data;
  const out = document.createElement('canvas'); out.width = out.height = w;
  const oc = out.getContext('2d'), od = oc.createImageData(w,w);
  for(let i=0;i<sd.length;i+=4){ const v = Math.max(0,Math.min(255,(base + (sd[i]/255-.5)*amp)*255));
    od.data[i]=od.data[i+1]=od.data[i+2]=v; od.data[i+3]=255; }
  oc.putImageData(od,0,0); const t = new THREE.CanvasTexture(out); t.wrapS=t.wrapT=THREE.RepeatWrapping; return t;
}
// 環境光(IBL)用の宇宙: 暗い背景+恒星の輝点+淡い星雲 → PMREMで反射に使う
function buildSpaceEnv(renderer, keyDir){
  const s = new THREE.Scene();
  const mat = new THREE.ShaderMaterial({side:THREE.BackSide, depthWrite:false, uniforms:{kd:{value:keyDir.clone().normalize()}},
    vertexShader:`varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform vec3 kd; varying vec3 vd;
      void main(){ float k = max(dot(normalize(vd), kd), 0.);
        vec3 c = vec3(.006,.008,.018);
        c += vec3(1.,.93,.82) * pow(k, 900.) * 60.;           // 恒星の本体
        c += vec3(1.,.85,.7) * pow(k, 24.) * .35;             // 恒星のハロー
        c += vec3(.25,.12,.45) * smoothstep(.2,1.,vd.y*.5+.5) * .05;   // 上方の淡い星雲
        c += vec3(.0,.25,.35) * smoothstep(.4,1.,-vd.x) * .03;
        gl_FragColor = vec4(c,1.); }`});
  s.add(new THREE.Mesh(new THREE.SphereGeometry(10, 64, 32), mat));
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.02); pm.dispose(); return rt.texture;
}
// 仕上げ: ビネット + 粒子ノイズ + 周辺の色収差(レンズ感)
const FinishShader = {
  uniforms:{tDiffuse:{value:null}, time:{value:0}, vig:{value:.38}, grain:{value:.016}, ca:{value:.0016}},
  vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
  fragmentShader:`uniform sampler2D tDiffuse; uniform float time, vig, grain, ca; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec2 d = vUv - .5; float r2 = dot(d,d);
      vec3 col; col.r = texture2D(tDiffuse, vUv + d*ca*r2*8.).r; col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - d*ca*r2*8.).b;
      col *= 1. - vig*smoothstep(.08, .55, r2);
      col += (h(vUv*1000. + time) - .5) * grain;
      gl_FragColor = vec4(col, 1.); }`
};

// ================= シーン構築 =================
function makeStars(){
  const n = 3000, p = new Float32Array(n*3);
  for(let i=0;i<n;i++){ const u = rnd()*2-1, a = rnd()*6.283, r = 900, q = Math.sqrt(1-u*u);
    p[i*3]=Math.cos(a)*q*r; p[i*3+1]=u*r; p[i*3+2]=Math.sin(a)*q*r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p,3));
  return new THREE.Points(g, new THREE.PointsMaterial({size:1.4, color:0xcfe4ff, sizeAttenuation:false, fog:false, transparent:true, opacity:.8}));
}
function buildWorld(mode, renderer){
  const S = new THREE.Scene(), P = mode === 'b';
  S.background = new THREE.Color(P ? 0x01010a : 0x020010);
  S.fog = new THREE.FogExp2(P ? 0x01010a : 0x020010, P ? .0026 : .0035);
  S.add(makeStars());
  const keyDir = new THREE.Vector3(-60, 35, 40);
  if(P){
    const env = buildSpaceEnv(renderer, keyDir);
    S.environment = env;
    S.add(new THREE.HemisphereLight(0x2a3e66, 0x0a0710, .9));          // ごく弱い宇宙の回り込み光
    const key = new THREE.DirectionalLight(0xfff0dc, 7.5);               // 恒星(主光源): 硬い明暗境界
    key.position.copy(keyDir); key.castShadow = true;
    key.shadow.mapSize.set(1024,1024); key.shadow.bias = -.0004; key.shadow.normalBias = .03;
    Object.assign(key.shadow.camera, {left:-45, right:45, top:45, bottom:-45, near:1, far:260});
    S.add(key); S.add(key.target);
    const rim = new THREE.DirectionalLight(0x6fb8ff, 2.4); rim.position.set(40, 18, -70); S.add(rim);   // 輪郭を拾う寒色リム
  }else{
    S.add(new THREE.AmbientLight(0x445577, 2));
    const key = new THREE.DirectionalLight(0xaaccff, 2.4); key.position.set(40,60,30); S.add(key);
  }
  // 機体
  const sb = Assets.buildShip(), ship = sb.group; S.add(ship);
  if(P){
    const hh = hullHeightCanvas(512);
    const hull = new THREE.MeshStandardMaterial({color:0xc4ccd8, metalness:.86, roughness:.34,
      normalMap:heightToNormal(hh, 2.2), roughnessMap:roughFromHeight(hh, .55, .5), envMapIntensity:1.1});
    ship.traverse(o=>{ if(o.isMesh && o.material.type === 'MeshStandardMaterial'){ o.material = hull; } if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });
    sb.parts.exhaust.forEach(e=>{ e.material.opacity = .5; e.scale.multiplyScalar(.6); });
    ship.children.find(c=>c.isSprite && c.scale.x === 4)?.scale.set(2, 2, 1);   // エンジン光球を控えめに
  }
  // 岩
  const geos = Assets.rockGeos(), mats = Assets.rockMats();
  let bMats = null;
  if(P){
    const hc = rockHeightCanvas(512), nrm = heightToNormal(hc, 3.2), rgh = roughFromHeight(hc, .88, .25);
    bMats = [0x8a847d, 0x96806c, 0x7a8390].map(c=>new THREE.MeshStandardMaterial({color:c,
      map:mats[0].map, normalMap:nrm, normalScale:new THREE.Vector2(1.1,1.1), roughnessMap:rgh, roughness:1, metalness:.03, envMapIntensity:.35}));
  }
  const rocks = LAYOUT.map((L,i)=>{ const m = new THREE.Mesh(geos[L.g], P ? bMats[i%3] : mats[i%3]);
    m.position.set(L.x, L.y, L.z); m.scale.setScalar(L.s); m.rotation.set(i*.7, i*1.3, i*.4);
    if(P){ m.castShadow = i < 4; m.receiveShadow = true; }
    S.add(m); return m; });
  // コア
  const core = Assets.buildCore(); core.position.set(3.5, 1.2, -36); S.add(core);
  // 遠景惑星
  const pl = new THREE.Mesh(new THREE.SphereGeometry(140, 64, 48), P
    ? new THREE.MeshStandardMaterial({color:0x4b3fa0, roughness:.95, metalness:0, envMapIntensity:.15, fog:false})
    : new THREE.MeshStandardMaterial({color:0x5b46c8, emissive:0x180f40, roughness:.85, metalness:.1, fog:false}));
  pl.position.set(-270, -70, -1370); S.add(pl);
  if(P){   // 大気の縁光(フレネル)
    const atm = new THREE.Mesh(new THREE.SphereGeometry(148, 64, 48), new THREE.ShaderMaterial({
      transparent:true, blending:THREE.AdditiveBlending, side:THREE.BackSide, depthWrite:false, fog:false,
      vertexShader:`varying vec3 n; varying vec3 v; void main(){ n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader:`varying vec3 n; varying vec3 v; void main(){ float f = pow(1. - abs(dot(n, v)), 3.); gl_FragColor = vec4(vec3(.55,.45,1.)*f*1.6, f); }`}));
    atm.position.copy(pl.position); S.add(atm);
  }
  // ヘッドライト(現行ゲームと同等)
  const hl = new THREE.SpotLight(0xcce9ff, P ? 260 : 420, 165, .58, .8, 1.5), hlT = new THREE.Object3D();
  hl.position.set(0, .4, -7); hlT.position.set(0, 0, -95); hl.target = hlT; S.add(hl, hlT);
  return {S, ship, rocks, core, parts: sb.parts};
}

// ================= レンダラ2系統(同一カメラ・同一時刻) =================
const cam = new THREE.PerspectiveCamera(72, 1, .1, 1500);
function makePane(id, mode){
  const canvas = document.getElementById(id);
  const R = new THREE.WebGLRenderer({canvas, antialias:true});
  R.setPixelRatio(Math.min(devicePixelRatio, 2));
  if(mode === 'b'){
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
    R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  const W = buildWorld(mode, R);
  const comp = new EffectComposer(R);
  comp.addPass(new RenderPass(W.S, cam));
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), mode === 'b' ? .45 : .85, mode === 'b' ? .3 : .6, mode === 'b' ? 1.0 : .62);
  comp.addPass(bloom);
  let fin = null;
  if(mode === 'b'){ fin = new ShaderPass(FinishShader); comp.addPass(fin); }
  // ShaderPassが最終段の場合は出力の色空間変換が行われないため、sRGB化を最後に明示する
  const out = new ShaderPass({uniforms:{tDiffuse:{value:null}, tm:{value: mode === 'b' ? 1 : 0}},
    vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform sampler2D tDiffuse; uniform float tm; varying vec2 vUv;
      vec3 aces(vec3 x){ x *= 1.15; return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14), 0., 1.); }
      vec3 srgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; if(tm > .5) c = aces(c); gl_FragColor = vec4(srgb(clamp(c,0.,1.)), 1.); }`});
  comp.addPass(out);
  return {R, comp, W, fin, canvas};
}
const A = makePane('ca', 'a'), B = makePane('cb', 'b');
window.LOOKDEV = {A, B, cam, THREE};

let view = 'split', camMode = 'chase', paused = false, t = 0;
function resize(){
  const both = view === 'split';
  for(const p of [A, B]){
    const w = both ? innerWidth/2 : innerWidth, h = innerHeight;
    p.R.setSize(w, h, false); p.comp.setSize(w, h);
  }
  cam.aspect = (view === 'split' ? innerWidth/2 : innerWidth)/innerHeight; cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
document.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{ view = b.dataset.v;
  document.body.className = view === 'split' ? '' : 'only-' + view;
  document.querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('on', x === b)); resize(); });
document.querySelectorAll('[data-cam]').forEach(b=>b.onclick=()=>{ camMode = b.dataset.cam;
  document.querySelectorAll('[data-cam]').forEach(x=>x.classList.toggle('on', x === b)); });
document.getElementById('pause').onclick = e=>{ paused = !paused; e.target.textContent = paused ? '再生' : '一時停止'; };

function step(tt){
  for(const p of [A, B]){ const W = p.W;
    W.ship.position.set(Math.sin(tt*.6)*2.2, Math.sin(tt*.9)*.8, 0);
    W.ship.rotation.z = -Math.cos(tt*.6)*.35; W.ship.rotation.x = Math.cos(tt*.9)*.06;
    W.rocks.forEach((m,i)=>{ const s = SPINS[i]; m.rotation.set(i*.7 + tt*s.x, i*1.3 + tt*s.y, i*.4 + tt*s.z); });
    W.core.userData.ring1.rotation.y = tt*1.8; W.core.userData.ring2.rotation.x = -tt*1.2;
    if(p.fin) p.fin.uniforms.time.value = tt;
  }
  if(camMode === 'chase'){ cam.position.set(Math.sin(tt*.6)*2.2*.9, 4 + Math.sin(tt*.9)*.3, 17); cam.lookAt(0, 0, -60); }
  else { const r0 = LAYOUT[0]; cam.position.set(r0.x + 13*Math.cos(tt*.25), r0.y + 4, r0.z + 13*Math.sin(tt*.25) + 4);
         cam.lookAt(r0.x, r0.y, r0.z); }
}
window.LOOKDEV.step = step;
window.LOOKDEV.renderBoth = ()=>{ A.comp.render(); B.comp.render(); };

let last = performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last)/1000); last = now;
  if(!paused) t += dt;
  step(t);
  if(view !== 'b') A.comp.render();
  if(view !== 'a') B.comp.render();
}
resize(); requestAnimationFrame(loop);

// 客観指標: 各ペインの輝度統計(平均/コントラスト/白飛び率/黒つぶれ率)
window.LOOKDEV.measure = ()=>{
  const res = {};
  for(const [k, p] of [['A_current', A], ['B_proposed', B]]){
    p.comp.render();
    const gl = p.R.getContext(), w = p.R.domElement.width, h = p.R.domElement.height;
    const buf = new Uint8Array(w*h*4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    let n = 0, sum = 0, sq = 0, hot = 0, crush = 0, lit = [];
    for(let i = 0; i < buf.length; i += 16){ const Y = (.2126*buf[i] + .7152*buf[i+1] + .0722*buf[i+2])/255;
      n++; sum += Y; sq += Y*Y; if(Y > .98) hot++; if(Y < .02) crush++; lit.push(Y); }
    lit.sort((a,b)=>a-b); const q = f=>lit[Math.floor(f*(lit.length-1))];
    const mean = sum/n;
    res[k] = {mean:+mean.toFixed(3), rmsContrast:+Math.sqrt(sq/n - mean*mean).toFixed(3),
      p99_minus_p50:+(q(.99) - q(.5)).toFixed(3), blownPct:+(hot/n*100).toFixed(2), crushedPct:+(crush/n*100).toFixed(1)};
  }
  return res;
};
</script>
</body>
</html>
'''
html = html.replace('__GLOW__', glow).replace('__ASSETS__', assets)
(root/'labs'/'lookdev.html').write_text(html)
print('labs/lookdev.html written:', len(html), 'bytes')
