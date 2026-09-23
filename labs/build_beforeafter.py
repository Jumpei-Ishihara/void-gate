# SPEC-09 の before/after 比較ページ(labs/before-after.html)を生成する。
#   A = SPEC-09 着手前のコード(git: 6f7cb79 の index.html から Assets/glowTexture を抽出)+ 当時の照明・合成
#   B = 現行 index.html の Assets/Look をそのまま抽出(本番と同一の生成コード)+ 本番と同じ照明・合成
# 岩の配置・カメラ・時刻は A/B で完全に同じ。違いは SPEC-09 で変えたものだけ。
import re, pathlib, subprocess
root = pathlib.Path(__file__).resolve().parent.parent
BEFORE = '6f7cb79'
old_src = subprocess.run(['git', 'show', f'{BEFORE}:index.html'], cwd=root, capture_output=True, text=True, check=True).stdout
new_src = (root/'index.html').read_text()

def block(src, start_pat, end_pat):
    lines = src.split('\n')
    s = next(i for i, l in enumerate(lines) if re.match(start_pat, l))
    e = next(i for i in range(s+1, len(lines)) if re.match(end_pat, lines[i]))
    return '\n'.join(lines[s:e+1])

old_glow = block(old_src, r'^function glowTexture', r'^}$')
old_assets = block(old_src, r'^const Assets = \(\(\)=>\{', r'^\}\)\(\);$')
new_glow = block(new_src, r'^function glowTexture', r'^}$')
new_look = block(new_src, r'^const Look = \(\(\)=>\{', r'^\}\)\(\);$')
new_assets = block(new_src, r'^const Assets = \(\(\)=>\{', r'^\}\)\(\);$')

html = r'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>VOID GATE — Before / After (SPEC-09)</title>
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
  #ui{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:3;flex-wrap:wrap;justify-content:center}
  #ui button{font:600 12px system-ui;padding:8px 12px;color:#dff;background:rgba(0,10,20,.75);
       border:1px solid rgba(0,240,255,.4);cursor:pointer}
  #ui button.on{background:rgba(0,240,255,.25)}
</style>
</head>
<body>
<canvas id="ca"></canvas><canvas id="cb"></canvas><div id="divider"></div>
<div class="lbl" id="la">BEFORE — SPEC-09 着手前</div>
<div class="lbl" id="lb">AFTER — F1〜F7 完了後(本番と同一コード)</div>
<div id="ui">
  <button data-v="split" class="on">左右比較</button><button data-v="a">BEFOREのみ</button><button data-v="b">AFTERのみ</button>
  <button data-cam="chase" class="on">追跡視点</button><button data-cam="close">岩の接写</button><button data-cam="ship">機体の接写</button>
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

/* ---- BEFORE: git __BEFORE__ の index.html から自動抽出 ---- */
const Old = (()=>{
__OLD_GLOW__
const starTex = glowTexture();
__OLD_ASSETS__
return {Assets, starTex};
})();

/* ---- AFTER: 現行 index.html から自動抽出(本番と同一) ---- */
const New = (()=>{
__NEW_GLOW__
const starTex = glowTexture();
__NEW_LOOK__
__NEW_ASSETS__
return {Assets, Look, starTex};
})();

// ===== 共通: 決定的な配置 =====
let seed = 7; const rnd = ()=>((seed = (seed*1664525 + 1013904223)>>>0)/4294967296);
const LAYOUT = [{x:-9, y:2.5, z:-26, s:6.2, g:5}, {x:11, y:-4, z:-44, s:5.2, g:2}, {x:-3, y:7, z:-74, s:7.5, g:1}, {x:6, y:3, z:-18, s:2.2, g:3}];
for(let i = 0; i < 34; i++) LAYOUT.push({x:(rnd()-.5)*110, y:(rnd()-.5)*80, z:-60 - rnd()*820, s:2 + rnd()*6, g:i%8});
const SPINS = LAYOUT.map(()=>({x:(rnd()-.5)*.5, y:(rnd()-.5)*.5, z:(rnd()-.5)*.4}));
function makeStars(){
  const n = 3000, p = new Float32Array(n*3);
  for(let i = 0; i < n; i++){ const u = rnd()*2 - 1, a = rnd()*6.283, r = 900, q = Math.sqrt(1 - u*u);
    p[i*3] = Math.cos(a)*q*r; p[i*3+1] = u*r; p[i*3+2] = Math.sin(a)*q*r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({size:1.4, color:0xcfe4ff, sizeAttenuation:false, fog:false, transparent:true, opacity:.8}));
}

// ===== BEFORE の世界(当時の本番と同じ照明・合成) =====
function buildBefore(R){
  const A = Old.Assets, S = new THREE.Scene();
  S.background = new THREE.Color(0x020010); S.fog = new THREE.FogExp2(0x020010, .0035);
  S.add(makeStars());
  S.add(new THREE.AmbientLight(0x445577, 2));
  const key = new THREE.DirectionalLight(0xaaccff, 2.4); key.position.set(40, 60, 30); S.add(key);
  const sb = A.buildShip(); S.add(sb.group);
  const geos = A.rockGeos(), mats = A.rockMats();
  const rocks = LAYOUT.map((L, i)=>{ const m = new THREE.Mesh(geos[L.g], mats[i%3]); m.position.set(L.x, L.y, L.z); m.scale.setScalar(L.s); S.add(m); return m; });
  const core = A.buildCore(); core.position.set(3.5, 1.2, -36); S.add(core);
  const pl = new THREE.Mesh(new THREE.SphereGeometry(140, 28, 22), new THREE.MeshStandardMaterial({color:0x5b46c8, emissive:0x180f40, roughness:.85, metalness:.1, fog:false}));
  pl.position.set(-270, -70, -1370); S.add(pl);
  const hl = new THREE.SpotLight(0xcce9ff, 420, 165, .58, .8, 1.5), hlT = new THREE.Object3D();
  hl.position.set(0, .4, -7); hlT.position.set(0, 0, -95); hl.target = hlT; S.add(hl, hlT);
  const comp = new EffectComposer(R);
  comp.addPass(new RenderPass(S, cam));
  comp.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), .85, .6, .62));
  // 当時の最終出力(AfterimagePass の MeshBasic コピー)と同じ sRGB 化のみ
  comp.addPass(new ShaderPass({uniforms:{tDiffuse:{value:null}},
    vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader:`uniform sampler2D tDiffuse; varying vec2 vUv;
      vec3 s(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
      void main(){ gl_FragColor = vec4(s(clamp(texture2D(tDiffuse, vUv).rgb, 0., 1.)), 1.); }`}));
  return {S, comp, ship: sb.group, parts: sb.parts, rocks, core};
}

// ===== AFTER の世界(本番と同じ Look・材質・合成) =====
function buildAfter(R){
  const A = New.Assets, L = New.Look, S = new THREE.Scene();
  S.background = new THREE.Color(L.LOOK.fog); S.fog = new THREE.FogExp2(L.LOOK.fog, .0026);
  S.add(makeStars());
  const rig = L.rig(S); S.environment = L.spaceEnv(R);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  rig.key.castShadow = true; rig.key.shadow.mapSize.set(1024, 1024); rig.key.shadow.bias = -.0004; rig.key.shadow.normalBias = .03;
  Object.assign(rig.key.shadow.camera, {left:-45, right:45, top:45, bottom:-45, near:1, far:260});
  rig.key.position.copy(L.LOOK.keyDir).normalize().multiplyScalar(120);
  const sb = A.buildShip(); S.add(sb.group);
  sb.group.traverse(o=>{ if(o.isMesh && !o.material.transparent){ o.castShadow = true; o.receiveShadow = true; } });
  const geos = A.rockGeos(), mats = A.rockMats();
  const rocks = LAYOUT.map((Lr, i)=>{ const m = new THREE.Mesh(geos[Lr.g], mats[i%3]); m.position.set(Lr.x, Lr.y, Lr.z); m.scale.setScalar(Lr.s);
    m.receiveShadow = true; m.castShadow = i < 8; S.add(m); return m; });
  const core = A.buildCore(); core.position.set(3.5, 1.2, -36); S.add(core);
  const pl = new THREE.Mesh(new THREE.SphereGeometry(140, 48, 32), new THREE.MeshStandardMaterial({color:0x5b46c8, roughness:.9, metalness:0, envMapIntensity:.2, fog:false}));
  pl.position.set(-270, -70, -1370); S.add(pl);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(149, 48, 32), new THREE.ShaderMaterial({transparent:true, blending:THREE.AdditiveBlending, side:THREE.BackSide, depthWrite:false, fog:false,
    vertexShader:`varying vec3 n; varying vec3 v; void main(){ n = normalize(normalMatrix*normal); vec4 mv = modelViewMatrix*vec4(position,1.); v = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader:`varying vec3 n; varying vec3 v; void main(){ float f = pow(1. - abs(dot(n, v)), 3.); gl_FragColor = vec4(vec3(.55,.45,1.)*f*1.4, f); }`}));
  atmo.position.copy(pl.position); S.add(atmo);
  const hl = new THREE.SpotLight(0xcce9ff, 420, 165, .58, .8, 1.5), hlT = new THREE.Object3D();
  hl.position.set(0, .4, -7); hlT.position.set(0, 0, -95); hl.target = hlT; S.add(hl, hlT);
  const comp = new EffectComposer(R);
  comp.addPass(new RenderPass(S, cam));
  comp.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), .45, .3, 1.0));
  const grade = new ShaderPass(L.GradeShader); grade.uniforms.encode.value = 1;   // ACES+仕上げ+sRGB(サイトPCと同じ最終パス)
  comp.addPass(grade);
  return {S, comp, ship: sb.group, parts: sb.parts, rocks, core, grade};
}

const cam = new THREE.PerspectiveCamera(72, 1, .1, 1500);
function makePane(id, build){
  const R = new THREE.WebGLRenderer({canvas: document.getElementById(id), antialias:true});
  R.setPixelRatio(Math.min(devicePixelRatio, 2));
  return {R, W: build(R)};
}
const A = makePane('ca', buildBefore), B = makePane('cb', buildAfter);
window.BEFORE_AFTER = {A, B, cam, THREE};

let view = 'split', camMode = 'chase', paused = false, t = 0;
function resize(){
  const w = view === 'split' ? innerWidth/2 : innerWidth, h = innerHeight;
  for(const p of [A, B]){ p.R.setSize(w, h, false); p.W.comp.setSize(w, h); }
  cam.aspect = w/h; cam.updateProjectionMatrix();
}
addEventListener('resize', resize);
document.querySelectorAll('[data-v]').forEach(b=>b.onclick = ()=>{ view = b.dataset.v;
  document.body.className = view === 'split' ? '' : 'only-' + view;
  document.querySelectorAll('[data-v]').forEach(x=>x.classList.toggle('on', x === b)); resize(); });
document.querySelectorAll('[data-cam]').forEach(b=>b.onclick = ()=>{ camMode = b.dataset.cam;
  document.querySelectorAll('[data-cam]').forEach(x=>x.classList.toggle('on', x === b)); });
document.getElementById('pause').onclick = e=>{ paused = !paused; e.target.textContent = paused ? '再生' : '一時停止'; };

function step(tt){
  for(const p of [A, B]){ const W = p.W;
    W.ship.position.set(Math.sin(tt*.6)*2.2, Math.sin(tt*.9)*.8, 0);
    W.ship.rotation.z = -Math.cos(tt*.6)*.35; W.ship.rotation.x = Math.cos(tt*.9)*.06;
    W.rocks.forEach((m, i)=>{ const s = SPINS[i]; m.rotation.set(i*.7 + tt*s.x, i*1.3 + tt*s.y, i*.4 + tt*s.z); });
    W.core.userData.ring1.rotation.y = tt*1.8; W.core.userData.ring2.rotation.x = -tt*1.2;
    const k = .35 + .25*Math.sin(tt*.4);
    W.parts.exhaust.forEach(e=>e.scale.set(.9 + .6*k, 1.6 + 3.2*k, 1));
    if(W.parts.plumeMat){ W.parts.plumeMat.uniforms.time.value = tt; W.parts.plumeMat.uniforms.strength.value = .45 + .55*k; }
    if(W.grade) W.grade.uniforms.time.value = tt;
  }
  if(camMode === 'chase'){ cam.position.set(Math.sin(tt*.6)*2.2*.9, 4 + Math.sin(tt*.9)*.3, 17); cam.lookAt(0, 0, -60); }
  else if(camMode === 'close'){ const r0 = LAYOUT[0]; cam.position.set(r0.x + 13*Math.cos(tt*.25), r0.y + 4, r0.z + 13*Math.sin(tt*.25) + 4); cam.lookAt(r0.x, r0.y, r0.z); }
  else { cam.position.set(6*Math.cos(tt*.3), 2.5, 6*Math.sin(tt*.3) + 1); cam.lookAt(0, 0, .5); }
}
window.BEFORE_AFTER.step = step;
let last = performance.now();
function loop(now){
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (now - last)/1000); last = now;
  if(!paused) t += dt;
  step(t);
  if(view !== 'b') A.W.comp.render();
  if(view !== 'a') B.W.comp.render();
}
resize(); requestAnimationFrame(loop);
</script>
</body>
</html>
'''
html = (html.replace('__BEFORE__', BEFORE).replace('__OLD_GLOW__', old_glow).replace('__OLD_ASSETS__', old_assets)
            .replace('__NEW_GLOW__', new_glow).replace('__NEW_LOOK__', new_look).replace('__NEW_ASSETS__', new_assets))
(root/'labs'/'before-after.html').write_text(html)
print('labs/before-after.html written:', len(html), 'bytes')
