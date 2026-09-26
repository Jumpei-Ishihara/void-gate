# パイロットの手の「継ぎ目を関節に見せる工夫」比較ページ(labs/glove-joints.html)を生成する。
# 照明・環境反射・ACES/仕上げは本番 index.html の Look をそのまま抽出して使う(本番と同じ質感で比較するため)
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
body = (root/'labs'/'glove-joints.src.js').read_text()

html = r'''<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>VOID GATE — 手の関節表現の比較</title>
<link rel="stylesheet" href="../fonts/fonts.css">
<style>
  html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:"Noto Sans JP",system-ui,sans-serif;color:#dff}
  canvas{position:fixed;inset:0;width:100%;height:100%;display:block}
  #panel{position:fixed;left:14px;top:14px;max-width:min(440px,calc(100% - 28px));background:rgba(0,8,16,.72);border:1px solid rgba(0,240,255,.3);
    padding:12px 14px;z-index:2;backdrop-filter:blur(6px);font-size:12px;line-height:1.7}
  #panel h1{font:700 15px Orbitron,sans-serif;letter-spacing:.12em;margin:0 0 4px;color:#fff}
  #panel p{margin:0 0 6px;color:#bfe}
  #panel ul{margin:0;padding-left:1.2em;color:#9cc}
  #panel small{color:#7aa}
  #ui{position:fixed;bottom:14px;left:50%;transform:translateX(-50%);display:flex;gap:6px;z-index:3;flex-wrap:wrap;justify-content:center;max-width:calc(100% - 20px)}
  #ui button{font:600 12px Orbitron,system-ui;padding:8px 12px;color:#dff;background:rgba(0,10,20,.8);border:1px solid rgba(0,240,255,.4);cursor:pointer}
  #ui button.on{background:rgba(0,240,255,.25)}
  #ui .sep{width:10px}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div id="panel"><h1 id="pt"></h1><p id="pd"></p><ul id="pl"></ul><small id="ps"></small></div>
<div id="ui">
  <button data-g="0">現状</button><button data-g="1">案1 ORGANIC</button><button data-g="2">案2 ARMORED</button><button data-g="3" class="on">案3 HYBRID</button>
  <span class="sep"></span>
  <button data-v="close" class="on">クローズアップ</button><button data-v="cockpit">操縦席視点</button>
  <button id="pause">回転停止</button>
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
/* ---- 本番 index.html から自動抽出(同一コード) ---- */
__GLOW__
__LOOK__
/* ---- 抽出ここまで ---- */
__BODY__

const R = new THREE.WebGLRenderer({canvas: document.getElementById('c'), antialias: true, preserveDrawingBuffer: true});
R.setPixelRatio(Math.min(devicePixelRatio, 2));
const S = new THREE.Scene();
S.background = new THREE.Color(0x05070c);
Look.rig(S); S.environment = Look.spaceEnv(R);
// 操縦席の文脈: 計器台の上面(本番と同じ寸法)と室内灯
const dashM = new THREE.MeshStandardMaterial({color: 0x121821, metalness: .72, roughness: .36, envMapIntensity: .9, side: THREE.DoubleSide});
const topG = new THREE.RingGeometry(.74, 1.05, 72, 1, Math.PI/2 - 1.05, 2.1); topG.rotateX(-Math.PI/2);
const dashTop = new THREE.Mesh(topG, dashM); dashTop.position.y = -.58;
const cl = new THREE.PointLight(0x00f0ff, 1.6, 5, 2); cl.position.set(0, -.4, -1);
const world = new THREE.Group(); world.add(dashTop, cl); S.add(world);
// クローズアップ用のスタジオ光(形を比べるための中立な白色光。操縦席視点では消す)
const studio = new THREE.DirectionalLight(0xffffff, 2.2), studioFill = new THREE.DirectionalLight(0xdde8ff, .7);
studio.position.set(1, 2, 1.5); studioFill.position.set(-1.5, .5, -1); S.add(studio, studioFill);
// 操縦桿(本番の位置・倍率)
const stick = makeStick(); const pivot = new THREE.Group(); pivot.position.set(0, -.76, -.55); stick.body.scale.setScalar(1.3); pivot.add(stick.body); world.add(pivot);
const cam = new THREE.PerspectiveCamera(72, 1, .02, 200); S.add(cam);
const comp = new EffectComposer(R);
comp.addPass(new RenderPass(S, cam));
comp.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), .45, .3, 1.0));
const grade = new ShaderPass(Look.GradeShader); grade.uniforms.encode.value = 1; comp.addPass(grade);

const INFO = [
  {t: '現状 — 図形を重ねただけ', d: 'カプセル・球・円錐台を重ねて配置。重なり目がそのまま硬い線として見え、関節の「曲がる場所」が読めない。', l: [
    '指: 関節ごとに別のカプセル → 太さが一定で、つなぎ目にくびれも影もない',
    '手の甲と指の付け根・手首が、別の図形の「刺さり」で終わっている']},
  {t: '案1 ORGANIC — 継ぎ目のない指', d: '指を関節を通る1本の曲線チューブにし、太さを関節でくびらせ、手前を膨らませる。しわの位置を頂点の明るさで暗くする(擬似AO)。', l: [
    '指の付け根は手の甲の中から始めて、刺さり目を消す',
    '関節: くびれ(-13%)+手前の膨らみ(+7%)+しわの影。グリップ側の面も暗く',
    '手首は革のしわの溝2本。最も自然な革手袋。SF感は控えめ']},
  {t: '案2 ARMORED — 指節ごとの装甲', d: '指の芯はゴム、指節ごとに湾曲した装甲板を被せ、関節では板を切って隙間からゴムの関節球を見せる。', l: [
    '「板の切れ目=関節」がはっきり読める(ガンダムのノーマルスーツ・パワードスーツの文法)',
    '手の甲は重なり合う3枚の板、手首はゴムの蛇腹',
    '最もSF・メカ的。部品が多く、遠目には細かくうるさい']},
  {t: '案3 HYBRID — 革の指+関節の帯+要所の装甲(推奨)', d: '案1の継ぎ目のない革の指を土台に、関節にゴムの細い帯、付け根の指節と親指だけに装甲板、手首にゴムの蛇腹。', l: [
    '関節の位置が「帯」で読める一方、指の形は有機的に連続する',
    '装甲は付け根の指節・拳・手の甲だけ → 操縦席視点で見える面に集中。手の甲は平板ではなく曲面の殻',
    '手首の蛇腹で袖との継ぎ目も「曲がる部品」として見せる']},
];
let cur = null, gi = 3, view = 'close', paused = false, ang = .6;
const builders = [gloveCurrent, gloveOrganic, gloveArmored, gloveHybrid];
function show(i){
  if(cur) stick.grp.remove(cur);
  gi = i; cur = builders[i](); stick.grp.add(cur);
  document.getElementById('pt').textContent = INFO[i].t; document.getElementById('pd').textContent = INFO[i].d;
  document.getElementById('pl').innerHTML = INFO[i].l.map(s=>`<li>${s}</li>`).join('');
  document.getElementById('ps').textContent = `メッシュ ${cur.userData.meshes} / 三角形 ${cur.userData.tris.toLocaleString()}`;
  document.querySelectorAll('[data-g]').forEach(b=>b.classList.toggle('on', +b.dataset.g === i));
}
function setView(v){ view = v; document.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle('on', b.dataset.v === v)); }
document.querySelectorAll('[data-g]').forEach(b=>b.onclick = ()=>show(+b.dataset.g));
document.querySelectorAll('[data-v]').forEach(b=>b.onclick = ()=>setView(b.dataset.v));
document.getElementById('pause').onclick = e=>{ paused = !paused; e.target.textContent = paused ? '回転再開' : '回転停止'; };
function resize(){ R.setSize(innerWidth, innerHeight, false); comp.setSize(innerWidth, innerHeight); cam.aspect = innerWidth/innerHeight; cam.updateProjectionMatrix(); }
addEventListener('resize', resize);
const target = new THREE.Vector3();
function place(a = ang){
  if(view === 'cockpit'){ cam.position.set(0, 0, 0); cam.fov = 72; cam.lookAt(0, -.2/1.35*1, -160); cam.rotation.set(0, 0, 0); }
  else { stick.grp.updateWorldMatrix(true, false); target.set(.05, .29, .03).applyMatrix4(stick.grp.matrixWorld);
    cam.fov = 40; cam.position.set(target.x + Math.sin(a)*.42, target.y + .16, target.z + Math.cos(a)*.42); cam.lookAt(target); }
  studio.visible = studioFill.visible = view === 'close'; cl.intensity = view === 'close' ? .4 : 1.6;
  cam.updateProjectionMatrix();
}
function render(){ place(); comp.render(); }
let last = performance.now();
function loop(now){ requestAnimationFrame(loop); const dt = Math.min(.05, (now - last)/1000); last = now; if(!paused) ang += dt*.35; render(); }
window.GLOVE = {show, setView, render, setAngle: a=>{ ang = a; }, info: ()=>cur.userData};
show(3); resize(); requestAnimationFrame(loop);
</script>
</body>
</html>
'''
html = html.replace('__GLOW__', glow).replace('__LOOK__', look).replace('__BODY__', body)
out = root/'labs'/'glove-joints.html'
out.write_text(html)
print(f'{out.relative_to(root)} written: {len(html)} bytes')
