# 操縦席デザイン3案の確認ページ(labs/cockpit-concepts.html)を生成する。
# 照明・岩・環境反射・ACES/仕上げは本番 index.html の Look/Assets をそのまま抽出して使う(本番と同じ質感で比較するため)
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
src = (root/'index.html').read_text()

def block(start_pat, end_pat):
    lines = src.split('\n')
    s = next(i for i, l in enumerate(lines) if re.match(start_pat, l))
    e = next(i for i in range(s+1, len(lines)) if re.match(end_pat, lines[i]))
    return '\n'.join(lines[s:e+1])

glow = block(r'^function glowTexture', r'^}$')
look = block(r'^const Look = \(\(\)=>\{', r'^\}\)\(\);$')
assets = block(r'^const Assets = \(\(\)=>\{', r'^\}\)\(\);$')
concepts = (root/'labs'/'cockpit-concepts.src.js').read_text()

html = r'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>VOID GATE — 操縦席デザイン案</title>
<link rel="stylesheet" href="../fonts/fonts.css">
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:"Noto Sans JP",system-ui,sans-serif;color:#dff}
  canvas{position:fixed;inset:0;width:100%;height:100%;display:block}
  #panel{position:fixed;left:14px;top:14px;max-width:min(430px,calc(100% - 28px));background:rgba(0,8,16,.72);border:1px solid rgba(0,240,255,.3);
    padding:12px 14px;z-index:2;backdrop-filter:blur(6px);font-size:12px;line-height:1.7}
  #panel h1{font:700 15px Orbitron,sans-serif;letter-spacing:.14em;margin:0 0 4px;color:#fff}
  #panel p{margin:0 0 6px;color:#bfe}
  #panel ul{margin:0;padding-left:1.2em;color:#9cc}
  #ui{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:3;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 20px)}
  #ui button{font:600 12px Orbitron,system-ui;padding:8px 12px;color:#dff;background:rgba(0,10,20,.8);border:1px solid rgba(0,240,255,.4);cursor:pointer}
  #ui button.on{background:rgba(0,240,255,.25)}
  #ui .sep{width:10px}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="panel"><h1 id="pt"></h1><p id="pd"></p><ul id="pl"></ul></div>
<div id="ui">
  <button data-c="0" class="on">案A HOLO CANOPY</button><button data-c="1">案B TACTICAL DECK</button><button data-c="2">案C ZERO-UI POD</button>
  <span class="sep"></span>
  <button data-s="normal" class="on">通常</button><button data-s="low">シールド低下</button><button data-s="critical">CRITICAL</button><button data-s="combo">コンボ中</button>
  <button id="pause">一時停止</button>
</div>
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
/* ---- 本番 index.html から自動抽出(同一コード) ---- */
__GLOW__
const starTex = glowTexture();
__LOOK__
__ASSETS__
/* ---- 抽出ここまで ---- */
__CONCEPTS__

// ===== 共通の宇宙(本番と同じ照明・岩・合成) =====
const R = new THREE.WebGLRenderer({canvas: document.getElementById('c'), antialias: true});
R.setPixelRatio(Math.min(devicePixelRatio, 2));
const S = new THREE.Scene();
S.background = new THREE.Color(Look.LOOK.fog); S.fog = new THREE.FogExp2(Look.LOOK.fog, .0024);
Look.rig(S); S.environment = Look.spaceEnv(R);
const stars = (()=>{ const n = 3000, p = new Float32Array(n*3); let s = 3; const r = ()=>((s = (s*1664525 + 1013904223)>>>0)/4294967296);
  for(let i = 0; i < n; i++){ const u = r()*2 - 1, a = r()*6.283, q = Math.sqrt(1 - u*u); p[i*3] = Math.cos(a)*q*900; p[i*3+1] = u*900; p[i*3+2] = Math.sin(a)*q*900; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({size: 1.4, color: 0xcfe4ff, sizeAttenuation: false, fog: false})); })();
S.add(stars);
const geos = Assets.rockGeos(), mats = Assets.rockMats();
let sd = 11; const rnd = ()=>((sd = (sd*1664525 + 1013904223)>>>0)/4294967296);
const rocks = Array.from({length: 38}, (_, i)=>{ const m = new THREE.Mesh(geos[i%8], mats[i%3]); m.scale.setScalar(2 + rnd()*6);
  m.position.set((rnd() - .5)*110, (rnd() - .5)*70, -40 - rnd()*800); m.userData.spin = [(rnd() - .5)*.6, (rnd() - .5)*.6]; S.add(m); return m; });
const cam = new THREE.PerspectiveCamera(72, 1, .05, 1500); S.add(cam);
const hl = new THREE.SpotLight(0xcce9ff, 420, 165, .58, .8, 1.5), hlT = new THREE.Object3D();
hl.position.set(0, -.15, -7); hlT.position.set(0, -.5, -95); cam.add(hl, hlT); hl.target = hlT;
cam.add(reticle());
const comp = new EffectComposer(R);
comp.addPass(new RenderPass(S, cam));
comp.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), .45, .3, 1.0));
const grade = new ShaderPass(Look.GradeShader); grade.uniforms.encode.value = 1; comp.addPass(grade);

// ===== 案の切替 =====
const INFO = [
  {t: '案A — HOLO CANOPY', d: '物理的な計器を最小にし、情報をキャノピー手前のホログラムへ。視線を前方から外さずに読める。', l: [
    '速度テープ(左)・シールド弧(右)・セクター帯(上)・スコア(レティクル下)を視線の近くに配置',
    '低く削いだダッシュと細いキャノピー枠で視界を最大化。レーダーはダッシュ上に投影',
    '状態は色で伝える(通常=シアン / 低下=琥珀 / 危険=赤でキャノピーの縁が明滅)']},
  {t: '案B — TACTICAL DECK', d: '実在の戦闘機の文法を未来的に洗練。役割ごとに分かれた3面ディスプレイと手元の実体感。', l: [
    '左=飛行(速度・推力) / 中央=戦術(レーダー・セクター) / 右=防御と武装(シールド・コア・スコア)',
    '眉庇(グレアシールド)・HUDコンバイナー・左右コンソール・HOTAS。琥珀の手元灯で機内に空気感',
    '情報量が最も多く「乗っている」実感が強い。視界は最も狭い']},
  {t: '案C — ZERO-UI POD', d: '計器パネルを持たない継ぎ目のない陶器質のポッド。数値はレティクルを囲むリング1つだけ。', l: [
    '速度=左の弧 / シールド=右の3分割 / コンボ=下の桃色の弧。読むより「感じる」表示',
    '窓枠の光の継ぎ目が状態色で脈動。近づく岩の方向を窓の縁の矢印で知らせる(周辺視野)',
    '最も未来的で視界が広い。情報の読み取りには慣れが必要']}];
let current = null, ci = 0;
const builders = [conceptA, conceptB, conceptC];
function show(i){
  if(current) cam.remove(current.group);
  ci = i; current = builders[i](); cam.add(current.group);
  document.getElementById('pt').textContent = INFO[i].t; document.getElementById('pd').textContent = INFO[i].d;
  document.getElementById('pl').innerHTML = INFO[i].l.map(s=>`<li>${s}</li>`).join('');
  document.querySelectorAll('[data-c]').forEach(b=>b.classList.toggle('on', +b.dataset.c === i));
}
function setState(s){
  W.state = s === 'combo' ? 'normal' : s;
  W.shields = s === 'critical' ? 0 : s === 'low' ? 1 : 3;
  W.mult = s === 'combo' ? 2 : 1; W.combo = s === 'combo' ? 12 : 0;
  document.querySelectorAll('[data-s]').forEach(b=>b.classList.toggle('on', b.dataset.s === s));
}
document.querySelectorAll('[data-c]').forEach(b=>b.onclick = ()=>show(+b.dataset.c));
document.querySelectorAll('[data-s]').forEach(b=>b.onclick = ()=>setState(b.dataset.s));
let paused = false; document.getElementById('pause').onclick = e=>{ paused = !paused; e.target.textContent = paused ? '再生' : '一時停止'; };

function resize(){ R.setSize(innerWidth, innerHeight, false); comp.setSize(innerWidth, innerHeight); cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize);
function step(dt){
  W.t += dt;
  W.speed = 375 + 265*Math.sin(W.t*.25);
  W.score += Math.round(dt*W.speed*.5*W.mult);
  const sp = W.speed;
  for(const m of rocks){ m.position.z += sp*dt*.6; m.rotation.x += m.userData.spin[0]*dt; m.rotation.y += m.userData.spin[1]*dt;
    if(m.position.z > 20){ m.position.set((rnd() - .5)*110, (rnd() - .5)*70, -820); } }
  cam.rotation.set(Math.sin(W.t*.5)*.03, Math.sin(W.t*.37)*.04, Math.sin(W.t*.3)*.05);
  cam.updateMatrixWorld();
  const inv = new THREE.Matrix4().copy(cam.matrixWorld).invert(), v = new THREE.Vector3();
  RADAR = rocks.map(m=>{ v.copy(m.position).applyMatrix4(inv); return {x: v.x, y: v.y, z: v.z}; });
  current.update();
  for(const u of current.ui) u.userData.redraw();
  grade.uniforms.time.value = W.t;
}
window.COCKPIT = {show, setState, step, render: ()=>comp.render(), W};
let last = performance.now();
function loop(now){ requestAnimationFrame(loop); const dt = Math.min(.05, (now - last)/1000); last = now; if(!paused) step(dt); comp.render(); }
await document.fonts.load('20px Orbitron').catch(()=>{});
show(0); setState('normal'); resize(); requestAnimationFrame(loop);
</script>
</body>
</html>
'''
html = html.replace('__GLOW__', glow).replace('__LOOK__', look).replace('__ASSETS__', assets).replace('__CONCEPTS__', concepts)
(root/'labs'/'cockpit-concepts.html').write_text(html)
print('labs/cockpit-concepts.html written:', len(html), 'bytes')
