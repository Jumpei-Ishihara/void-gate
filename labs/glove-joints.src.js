// ===== パイロットの手: 継ぎ目を関節に見せる工夫の比較(ルックデブ)。build_glove_joints.py が本番の Look/Assets と結合して glove-joints.html を生成 =====
// 座標: 操縦桿のグリップ座標(軸 = y・前 = -z)。手の姿勢・大きさは本番(SPEC-14)と同じ
const V3 = (x, y, z)=>new THREE.Vector3(x, y, z);
const PROF = [[0, .18], [.026, .18], [.03, .2], [.034, .215], [.031, .228], [.036, .245], [.033, .26], [.037, .278], [.036, .3], [.033, .32], [.036, .34], [.03, .352], [.016, .36], [0, .362]]
  .map(([r, y])=>new THREE.Vector2(r, y));
const gripR = y=>{ for(let i = 1; i < PROF.length; i++){ const a = PROF[i - 1], b = PROF[i]; if(y >= a.y && y <= b.y) return a.x + (b.x - a.x)*(y - a.y)/Math.max(1e-6, b.y - a.y); } return 0; };
const around = (y, deg, r)=>{ const R = gripR(y) + r + .002, f = deg*Math.PI/180; return V3(Math.cos(f)*R, y, -Math.sin(f)*R*1.25); };
const FINGERS = [
  {y: .318, r: .015, deg: [20, 62, 95]},
  {y: .286, r: .0155, deg: [20, 70, 125, 172]},
  {y: .254, r: .0148, deg: [20, 70, 122, 165]},
  {y: .224, r: .0135, deg: [20, 68, 115, 155]},
];
const HAND_YAW = -.59, HC = V3(.105, .27, .03);
const THUMB = [V3(.075, .318, .048), V3(.048, .354, .036), V3(.022, .386, .012)];
const WRIST = [V3(.16, .255, .07), V3(.2, .195, .12)];
const SLEEVE_END = V3(.42, -.1, .38);

// ---- 材質 ----
const std = o=>new THREE.MeshStandardMaterial(o);
const M = {
  glove: std({color: 0x3d3833, roughness: .55, metalness: .12, envMapIntensity: .8}),
  gloveAO: std({color: 0x3d3833, roughness: .55, metalness: .12, envMapIntensity: .8, vertexColors: true}),
  rubber: std({color: 0x15171a, roughness: .78, metalness: .05, envMapIntensity: .4, vertexColors: true}),
  armor: std({color: 0x5c6673, roughness: .32, metalness: .72, envMapIntensity: 1.1, vertexColors: true}),
  sleeve: std({color: 0x1b2230, roughness: .88, metalness: 0, envMapIntensity: .3}),
  glow: new THREE.MeshBasicMaterial({color: new THREE.Color('#00f0ff').multiplyScalar(1.6)}),
};

// ---- 形状の部品 ----
function capsule(a, b, r, seg = 8){
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(1e-4, L), 3, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()));
  const m = a.clone().add(b).multiplyScalar(.5); g.translate(m.x, m.y, m.z);
  return g;
}
function frustum(a, b, ra, rb, seg = 18){
  const d = new THREE.Vector3().subVectors(b, a), L = d.length();
  const g = new THREE.CylinderGeometry(rb, ra, L, seg, 1, false);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()));
  const m = a.clone().add(b).multiplyScalar(.5); g.translate(m.x, m.y, m.z);
  return g;
}
// 頂点色つきで結合(色がない形状は白)
function merge(list){
  const gs = list.map(g=>g.index ? g.toNonIndexed() : g);
  let n = 0; gs.forEach(g=>n += g.attributes.position.count);
  const pos = new Float32Array(n*3), nor = new Float32Array(n*3), col = new Float32Array(n*3).fill(1);
  let o = 0;
  for(const g of gs){ const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, o*3); nor.set(g.attributes.normal.array, o*3);
    if(g.attributes.color) col.set(g.attributes.color.array, o*3);
    o += c; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
const tint = (g, v)=>{ const n = g.attributes.position.count, c = new Float32Array(n*3).fill(v); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
// 可変半径のチューブ(継ぎ目のない指)。rFn(t)=半径、aoFn(t, 法線, 位置)=頂点の明るさ(擬似AO)
function tubeVar(points, rFn, {tubular = 56, radial = 14, aoFn = null, capEnd = true} = {}){
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', .5);
  const fr = curve.computeFrenetFrames(tubular, false);
  const pos = [], nor = [], col = [], idx = [];
  for(let i = 0; i <= tubular; i++){
    const t = i/tubular, P = curve.getPointAt(t), N = fr.normals[i], B = fr.binormals[i], r = rFn(t);
    for(let j = 0; j <= radial; j++){
      const a = j/radial*Math.PI*2, s = Math.sin(a), c = -Math.cos(a);
      const n = V3(c*N.x + s*B.x, c*N.y + s*B.y, c*N.z + s*B.z);
      pos.push(P.x + r*n.x, P.y + r*n.y, P.z + r*n.z); nor.push(n.x, n.y, n.z);
      const ao = aoFn ? aoFn(t, n, P) : 1; col.push(ao, ao, ao);
    }
  }
  for(let i = 1; i <= tubular; i++) for(let j = 1; j <= radial; j++){
    const a = (radial + 1)*(i - 1) + j - 1, b = (radial + 1)*i + j - 1, c = (radial + 1)*i + j, d = (radial + 1)*(i - 1) + j;
    idx.push(a, b, d, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const parts = [g];
  if(capEnd){ const e = curve.getPointAt(1), tip = new THREE.SphereGeometry(rFn(1), radial, 8); tip.translate(e.x, e.y, e.z); parts.push(tint(tip, aoFn ? aoFn(1, V3(0, 1, 0), e) : 1)); }
  return {geo: merge(parts), curve};
}
// 折れ線の各点の位置(0〜1)
const jointT = pts=>{ const L = [0]; for(let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1])); return L.map(v=>v/L[L.length - 1]); };
const bump = (t, c, w)=>Math.exp(-(((t - c)/w)**2));
// 指の経路: 手の甲の中から始め(付け根の継ぎ目を隠す)、関節を通る
function fingerPath(f){
  const pts = f.deg.map((d, k)=>around(f.y - k*.003, d, f.r));
  const base = pts[0].clone().lerp(HC, .45);
  return [base, ...pts];
}
// 蛇腹(手首のブーツ): 波打つ回転体
function bellows(a, b, r0, r1, rings = 5){
  const d = new THREE.Vector3().subVectors(b, a), L = d.length(), pts = [];
  for(let i = 0; i <= 40; i++){ const t = i/40, r = r0 + (r1 - r0)*t + .0045*Math.cos(t*rings*Math.PI*2); pts.push(new THREE.Vector2(r, t*L)); }
  const g = new THREE.LatheGeometry(pts, 20);
  const pos = g.attributes.position, col = new Float32Array(pos.count*3);
  for(let i = 0; i < pos.count; i++){ const t = pos.getY(i)/L, v = .55 + .45*(.5 + .5*Math.cos(t*rings*Math.PI*2)); col[i*3] = col[i*3 + 1] = col[i*3 + 2] = v; }   // 谷を暗く
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize())); g.translate(a.x, a.y, a.z);
  return g;
}
// チューブ上の位置 t に、進行方向に直交する輪(関節のゴムの帯)
function bandAt(curve, t, r, tube = .0028){
  const P = curve.getPointAt(t), T = curve.getTangentAt(t);
  const g = new THREE.TorusGeometry(r, tube, 6, 20);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), T)); g.translate(P.x, P.y, P.z);
  return tint(g, .8);
}
// 指節の装甲板: チューブの外側(グリップと反対側)を覆う湾曲板
function plateOn(curve, t0, t1, r, arc = 3.4){
  const P0 = curve.getPointAt(t0), P1 = curve.getPointAt(t1), mid = curve.getPointAt((t0 + t1)/2);
  const d = new THREE.Vector3().subVectors(P1, P0), L = d.length();
  const out = V3(mid.x, 0, mid.z).normalize();   // グリップ軸から外向き
  const g = new THREE.CylinderGeometry(r, r, L, 12, 1, true, -arc/2, arc);   // 開いた筒の一部(+z 側が中心)
  // 筒の中心方向(+z)を外向きに、軸を指の方向に合わせる
  const q1 = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
  const zNow = V3(0, 0, 1).applyQuaternion(q1);
  const outP = out.clone().addScaledVector(d.clone().normalize(), -out.dot(d.clone().normalize())).normalize();
  const ang = Math.atan2(new THREE.Vector3().crossVectors(zNow, outP).dot(d.clone().normalize()), zNow.dot(outP));
  const q2 = new THREE.Quaternion().setFromAxisAngle(d.clone().normalize(), ang);
  g.applyQuaternion(q1); g.applyQuaternion(q2);
  const m = P0.clone().add(P1).multiplyScalar(.5); g.translate(m.x, m.y, m.z);
  // 縁を暗く(板の厚み・隙間の影)
  const pos = g.attributes.position, col = new Float32Array(pos.count*3), v = new THREE.Vector3();
  for(let i = 0; i < pos.count; i++){ v.fromBufferAttribute(pos, i); const u = Math.abs(v.clone().sub(m).dot(d.clone().normalize()))/(L/2);
    const c = 1 - .45*Math.max(0, u - .7)/.3; col[i*3] = col[i*3 + 1] = col[i*3 + 2] = c; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function backOfHand(){
  const g = new THREE.SphereGeometry(1, 22, 16); g.scale(.07, .064, .03); g.rotateY(HAND_YAW); g.translate(HC.x, HC.y, HC.z);
  return g;
}
function backPlate(w = .075, h = .075, off = .028){
  const nrm = V3(Math.sin(HAND_YAW), 0, Math.cos(HAND_YAW));
  const g = new THREE.BoxGeometry(w, h, .01); g.rotateY(HAND_YAW);
  const p = HC.clone().addScaledVector(nrm, off); g.translate(p.x, p.y, p.z);
  return g;
}
// 手の甲の曲面装甲: 楕円体の外側(パイロット側)の面に沿う殻(平板の「刺さり」をなくす)
function backShell(){
  const g = new THREE.SphereGeometry(1, 18, 10, Math.PI/2 - .95, 1.9, .62, 1.9);
  g.scale(.07*1.05, .064*1.05, .03*1.32); g.rotateY(HAND_YAW); g.translate(HC.x, HC.y, HC.z);
  const pos = g.attributes.position, col = new Float32Array(pos.count*3), v = new THREE.Vector3();
  const ax = V3(Math.cos(HAND_YAW), 0, -Math.sin(HAND_YAW));
  for(let i = 0; i < pos.count; i++){ v.fromBufferAttribute(pos, i).sub(HC);
    const e = Math.max(Math.abs(v.dot(ax))/.07, Math.abs(v.y)/.064); const c = 1 - .5*Math.max(0, e - .75)/.3; col[i*3] = col[i*3 + 1] = col[i*3 + 2] = Math.max(.5, c); }   // 縁を暗く
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function cuffRing(r = .049){
  const mid = WRIST[0].clone().lerp(WRIST[1], .55), ax = new THREE.Vector3().subVectors(WRIST[1], WRIST[0]).normalize();
  const g = new THREE.TorusGeometry(r, .004, 5, 24);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), ax)); g.translate(mid.x, mid.y, mid.z);
  return g;
}
// 指の擬似AO: 関節のしわ + グリップ側(内側)を暗く
const fingerAO = (tj, P0)=>(t, n, P)=>{
  let ao = 1;
  for(const c of tj.slice(1, -1)) ao -= .45*bump(t, c, .028);
  const toAxis = V3(-P.x, 0, -P.z).normalize();
  ao *= 1 - .3*Math.max(0, n.dot(toAxis));
  return Math.max(.35, ao);
};
const fingerR = (f, tj)=>t=>{
  let r = f.r*(1 - .16*t);
  for(const c of tj.slice(1, -1)){ r *= 1 - .13*bump(t, c, .022); r *= 1 + .07*bump(t, c - .055, .035); }   // 関節のくびれ + 手前の膨らみ
  return r;
};

// ================= 現状(SPEC-14): 図形を重ねただけ =================
function gloveCurrent(){
  const gl = [], ar = [];
  FINGERS.forEach(f=>{ const pts = f.deg.map((d, k)=>around(f.y - k*.003, d, f.r));
    for(let k = 1; k < pts.length; k++) gl.push(capsule(pts[k - 1], pts[k], f.r*(1 - k*.06)));
    const b = new THREE.SphereGeometry(f.r*1.2, 10, 8), q = around(f.y, 14, f.r + .006); b.translate(q.x, q.y, q.z); gl.push(b); });
  gl.push(backOfHand(), capsule(THUMB[0], THUMB[1], .0165), capsule(THUMB[1], THUMB[2], .0148), frustum(WRIST[0], WRIST[1], .045, .05));
  const kk = y=>around(y, 16, .032);
  ar.push(capsule(kk(.222), kk(.322), .014), backPlate());
  return group([[merge(gl), M.gloveAO], [merge(ar), M.armor], [cuffRing(), M.glow], [frustum(WRIST[1], SLEEVE_END, .06, .075, 20), M.sleeve]]);
}
// ================= 案1 ORGANIC: 継ぎ目のない指 + 関節のしわ + 擬似AO =================
function gloveOrganic(){
  const gl = [];
  FINGERS.forEach(f=>{ const pts = fingerPath(f), tj = jointT(pts);
    gl.push(tubeVar(pts, fingerR(f, tj), {aoFn: fingerAO(tj)}).geo);
    const b = new THREE.SphereGeometry(f.r*1.18, 12, 10), q = around(f.y, 14, f.r + .005); b.translate(q.x, q.y, q.z); gl.push(tint(b, .95)); });
  const tp = [HC.clone().lerp(THUMB[0], .6), ...THUMB], tt = jointT(tp);
  gl.push(tubeVar(tp, t=>.0168*(1 - .14*t)*(1 - .12*bump(t, tt[2], .03))*(1 + .06*bump(t, tt[2] - .06, .04)), {aoFn: fingerAO(tt)}).geo);
  const back = backOfHand(), pos = back.attributes.position, col = new Float32Array(pos.count*3), v = new THREE.Vector3();
  for(let i = 0; i < pos.count; i++){ v.fromBufferAttribute(pos, i); const c = .78 + .22*Math.min(1, v.clone().sub(HC).length()/.06); col[i*3] = col[i*3 + 1] = col[i*3 + 2] = c; }
  back.setAttribute('color', new THREE.BufferAttribute(col, 3)); gl.push(back);
  // 手首: 革のしわ(細い溝)を入れた円錐台
  const wr = frustum(WRIST[0], WRIST[1], .045, .05, 22), wp = wr.attributes.position, wc = new Float32Array(wp.count*3).fill(.85);
  wr.setAttribute('color', new THREE.BufferAttribute(wc, 3)); gl.push(wr);
  for(const t of [.3, .6]){ const P = WRIST[0].clone().lerp(WRIST[1], t), ax = new THREE.Vector3().subVectors(WRIST[1], WRIST[0]).normalize();
    const g = new THREE.TorusGeometry(.046 + t*.005, .0025, 6, 24); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), ax)); g.translate(P.x, P.y, P.z); gl.push(tint(g, .45)); }
  return group([[merge(gl), M.gloveAO], [cuffRing(), M.glow], [frustum(WRIST[1], SLEEVE_END, .06, .075, 20), M.sleeve]]);
}
// ================= 案2 ARMORED: 指節ごとの装甲板 + 隙間から見える関節 =================
function gloveArmored(){
  const rb = [], ar = [];
  FINGERS.forEach(f=>{ const pts = fingerPath(f), tj = jointT(pts);
    const {geo, curve} = tubeVar(pts, t=>f.r*.78*(1 - .12*t), {aoFn: ()=>.8});
    rb.push(geo);
    for(let k = 1; k < tj.length - 1; k++){ const P = curve.getPointAt(tj[k]); const s = new THREE.SphereGeometry(f.r*.92, 12, 10); s.translate(P.x, P.y, P.z); rb.push(tint(s, .6)); }   // 関節の玉
    for(let k = 1; k < tj.length; k++){ const g0 = tj[k - 1] + (k === 1 ? .02 : .05), g1 = tj[k] - (k === tj.length - 1 ? -.02 : .05);
      ar.push(plateOn(curve, g0, Math.min(1, g1), f.r*1.05*(1 - .1*k))); }
  });
  const tp = [HC.clone().lerp(THUMB[0], .6), ...THUMB], tt = jointT(tp);
  const th = tubeVar(tp, t=>.0165*.8*(1 - .1*t), {aoFn: ()=>.8}); rb.push(th.geo);
  { const P = th.curve.getPointAt(tt[2]); const s = new THREE.SphereGeometry(.0155, 12, 10); s.translate(P.x, P.y, P.z); rb.push(tint(s, .6)); }
  ar.push(plateOn(th.curve, tt[1] + .04, tt[2] - .06, .0175), plateOn(th.curve, tt[2] + .06, 1.0, .0158));
  rb.push(tint(backOfHand(), .9));
  // 手の甲: 重なり合う3枚の板(拳側から手首側へ)
  const nrm = V3(Math.sin(HAND_YAW), 0, Math.cos(HAND_YAW)), along = V3(Math.cos(HAND_YAW), 0, -Math.sin(HAND_YAW));
  for(let i = 0; i < 3; i++){ const g = new THREE.BoxGeometry(.034, .08 - i*.006, .009); g.rotateY(HAND_YAW);
    const p = HC.clone().addScaledVector(nrm, .028 + i*.002).addScaledVector(along, -.034 + i*.03); g.translate(p.x, p.y, p.z); ar.push(tint(g, 1 - i*.08)); }
  const kk = y=>around(y, 16, .032);
  ar.push(tint(capsule(kk(.222), kk(.322), .015), 1));
  rb.push(bellows(WRIST[0], WRIST[1], .044, .05, 5));
  return group([[merge(rb), M.rubber], [merge(ar), M.armor], [cuffRing(.053), M.glow], [frustum(WRIST[1], SLEEVE_END, .06, .075, 20), M.sleeve]]);
}
// ================= 案3 HYBRID(推奨): 継ぎ目のない革の指 + 関節のゴムの帯 + 付け根の指節だけ装甲 + 手首の蛇腹 =================
function gloveHybrid(){
  const gl = [], rb = [], ar = [];
  FINGERS.forEach(f=>{ const pts = fingerPath(f), tj = jointT(pts);
    const {geo, curve} = tubeVar(pts, fingerR(f, tj), {aoFn: fingerAO(tj)});
    gl.push(geo);
    for(const c of tj.slice(1, -1)) rb.push(bandAt(curve, c, fingerR(f, tj)(c)*1.04, .0026));   // 関節の帯
    ar.push(plateOn(curve, tj[1] + .045, tj[2] - .05, fingerR(f, tj)((tj[1] + tj[2])/2)*1.12, 2.6));   // 付け根の指節の装甲
  });
  const tp = [HC.clone().lerp(THUMB[0], .6), ...THUMB], tt = jointT(tp), thR = t=>.0168*(1 - .14*t)*(1 - .12*bump(t, tt[2], .03));
  const th = tubeVar(tp, thR, {aoFn: fingerAO(tt)}); gl.push(th.geo);
  rb.push(bandAt(th.curve, tt[2], thR(tt[2])*1.05, .0028));
  ar.push(plateOn(th.curve, tt[1] + .05, tt[2] - .06, .0185, 2.6));
  const back = backOfHand(); gl.push(tint(back, .92));
  const kk = y=>around(y, 16, .032);
  ar.push(tint(capsule(kk(.222), kk(.322), .014), 1), backShell());
  rb.push(bellows(WRIST[0], WRIST[1], .044, .05, 4));
  return group([[merge(gl), M.gloveAO], [merge(rb), M.rubber], [merge(ar), M.armor], [cuffRing(.053), M.glow], [frustum(WRIST[1], SLEEVE_END, .06, .075, 20), M.sleeve]]);
}
function group(list){
  const g = new THREE.Group(); let tris = 0;
  for(const [geo, mat] of list){ g.add(new THREE.Mesh(geo, mat)); tris += (geo.index ? geo.index.count : geo.attributes.position.count)/3; }
  g.userData.tris = Math.round(tris); g.userData.meshes = list.length;
  return g;
}

// ---- 操縦桿(本番と同じ造形) ----
function makeStick(){
  const mGrip = std({color: 0x2c333e, metalness: .35, roughness: .5, envMapIntensity: .9});
  const mRubber = std({color: 0x0d0f13, metalness: .2, roughness: .82});
  const mMetal = std({color: 0x8d96a3, metalness: .9, roughness: .3, envMapIntensity: 1.2});
  const body = new THREE.Group(), grp = new THREE.Group(); grp.rotation.x = -.18; body.add(grp);
  const add = (geo, mat, parent, x, y, z, rx = 0)=>{ const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.rotation.x = rx; parent.add(o); return o; };
  add(new THREE.CylinderGeometry(.04, .09, .1, 20, 3), mRubber, body, 0, .05, 0);
  add(new THREE.CylinderGeometry(.013, .017, .1, 16), mMetal, body, 0, .14, 0);
  add(new THREE.TorusGeometry(.028, .003, 6, 32), M.glow, body, 0, .182, 0, Math.PI/2);
  const lathe = new THREE.LatheGeometry(PROF, 28); lathe.scale(1, 1, 1.25); add(lathe, mGrip, grp, 0, 0, 0);
  const head = new THREE.CapsuleGeometry(.024, .05, 6, 16); head.scale(1.15, .75, 1); add(head, mGrip, grp, 0, .352, -.012, Math.PI/2);
  add(new THREE.CylinderGeometry(.009, .011, .014, 12), mMetal, grp, 0, .374, .006);
  add(new THREE.SphereGeometry(.006, 10, 8), M.glow, grp, 0, .382, .006);
  const red = new THREE.MeshBasicMaterial({color: new THREE.Color(0xff3b5c).multiplyScalar(1.8)});
  const fb = add(new THREE.CylinderGeometry(.008, .008, .01, 12), red, grp, -.03, .35, -.025); fb.rotation.z = Math.PI/2;
  add(new THREE.CapsuleGeometry(.007, .03, 4, 8), mMetal, grp, 0, .31, -.044, .3);
  return {body, grp};
}
