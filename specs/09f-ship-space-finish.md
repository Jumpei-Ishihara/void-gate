# SPEC 09f — Phase F6: 機体外板・排気プルーム・惑星大気・近傍ダスト・仕上げパス

状態: **Draft** ／ 親: [SPEC-09](09-realism-gameplay-policy.md) R3 + R4 ／ 前提: F2（GradePass / Look）・F4（高さ→法線の生成器）Verified ／ 外部素材: 不要

## 1. 目的

機体を「金属の外板を持つ機械」に、空間を「奥行きと空気感のある宇宙」にする。
ルックデブで判明した「排気の発光球が機体の輪郭を覆う」問題を、発光の**形**から作り直して解消する。

## 2. 要件

### 機体（R3）

| ID | 要件 |
|---|---|
| F6-01 | 外板: パネルの継ぎ目 + リベットの高さマップ（シード付き、PC 512² / SP 256²）から法線・粗さマップを生成。金属度 .86 / 粗さ .34 で主光と環境を映す |
| F6-02 | 外板の UV: 機首（円錐）・主翼・尾翼の各ジオメトリに箱投影の UV を付与（パネル模様が面ごとに均一な密度になる） |
| F6-03 | **排気プルーム**: 球状スプライト（ex1/ex2）を、細長い円錐メッシュ + 加算ブレンドのシェーダに置換。長さは速度に比例、根元が白〜シアン・先端に向けて青く消える、時間ノイズで揺らぐ |
| F6-04 | 互換: `parts.exhaust` は2要素の配列のまま、`scale.y` が長さを表す（既存の速度連動テストと Sortie の `e.scale.set(.9, 1.6*ex, 1)` がそのまま動く） |
| F6-05 | エンジン光球 `eng`（スプライト、scale 4）を scale 2 に縮小し、HDR 値で bloom に芯だけを拾わせる |
| F6-06 | 被弾時の外板スパーク: 外板の emissive を橙（0xff7a2a）で 0.25 秒パルス |
| F6-07 | 排気が輪郭を覆わない: 追跡視点で、機体シルエット内の画素のうち bloom で飽和（輝度 >0.95）した割合が **15% 以下** |

### 空間（R4）

| ID | 要件 |
|---|---|
| F6-08 | ゲームの遠景惑星: emissive を撤去し主光で昼夜の境界を出す + フレネルの大気縁光（外殻シェル、加算、`fog:false`） |
| F6-09 | **近傍ダスト**: カメラ周囲 30 単位内の微粒子 120 個（SP 60）。速度方向に伸びる短い線で描き、明るさは距離で減衰（ヘッドライトに照らされる見え方）。既存の遠景の塵・流線とは別レイヤー |
| F6-10 | **仕上げ**: GradeShader にビネット（.32）・粒状ノイズ（.016）・周辺の色収差（.0016）を追加。**hud パスより前**で適用し、レティクルには掛からない |
| F6-11 | サイト（PC のみ）にも同じ仕上げを適用（ブルームの後段に GradePass を追加。SP は合成パスを増やさない） |
| F6-12 | Quality 縮退: L1 で色収差と粒状ノイズを OFF（ビネットは計算が軽いため残す）、L2 で近傍ダスト半減 |
| F6-13 | 明るさ: 輝度プローブで基準 ±20%（ビネットによる平均の低下も含めて満たす） |

## 3. 技術設計

### 3.1 排気プルーム（F6-03/04）

```js
// 長さ方向を +y に持つ円錐（開いた円柱: 根元半径 .45 → 先端 .05、長さ 1）
const plumeGeo = new THREE.CylinderGeometry(.05, .45, 1, 16, 8, true).translate(0, .5, 0);
const plumeMat = new THREE.ShaderMaterial({
  transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, side:THREE.DoubleSide,
  uniforms:{time:{value:0}, hot:{value:new THREE.Color(0xdffcff).multiplyScalar(1.8)}, cool:{value:new THREE.Color(0x2a7bff)}},
  vertexShader: /* uv.y = 長さ方向 0→1 */,
  fragmentShader: /* col = mix(hot, cool, v)、alpha = (1-v)^1.6 × 縁のフレネル減衰 × (0.85 + 0.15×noise(v*8 - time*20)) */});
const ex = new THREE.Mesh(plumeGeo, plumeMat);
ex.rotation.x = Math.PI/2;       // +y（長さ）を機体後方 +z へ
ex.position.set(±1.6, -.15, 3.3);
```

- 既存の `stepVisual` は `exhaust[i].scale.y` を速度で伸ばしているため、そのまま長さになる（F6-04）
- time uniform は `stepVisual` で更新（Sortie は gT() 純関数で更新 = 逆再生対応）

### 3.2 外板（F6-01/02）

```js
const hullH = hullHeightCanvas(IS_TOUCH ? 256 : 512, 17);   // ルックデブの関数をシード付きで移植
hull.normalMap = heightToNormal(hullH, 2.2);
hull.roughnessMap = roughFromHeight(hullH, .55, .5);
hull.emissive.set(0x000000);                                 // F2 で撤去済み。F6-06 のパルス用に emissive を使う
boxProjectUV(noseGeo); boxProjectUV(wingGeo); boxProjectUV(finGeo);   // 法線の主軸で UV を振り直す
```

### 3.3 仕上げ（F6-10）

GradeShader（F2）に uniform `vig, grain, ca, time` を追加し、ACES の**後**に適用:

```glsl
vec2 d = vUv - .5; float r2 = dot(d, d);
c.r = aces(texture2D(tDiffuse, vUv + d*ca*r2*8.).rgb).r;   // 色収差は周辺ほど強い（中央=レティクル位置ではほぼ 0）
c *= 1. - vig*smoothstep(.08, .55, r2);
c += (hash(vUv*1000. + time) - .5)*grain;
```

- レティクルは hud パスで後から合成されるため、ビネット・ノイズ・色収差の影響を受けない（F2-05 の構成）

## 4. 受け入れテスト（tests/phaseF6.js）

| テストID | 検証内容 |
|---|---|
| F6-T01 | 外板に normalMap / roughnessMap、emissive は通常時 0 |
| F6-T02 | 機首・主翼・尾翼のジオメトリに uv 属性があり、面ごとの UV 密度の比が 1.5 以内 |
| F6-T03 | exhaust が Mesh（ShaderMaterial・加算）で2本、`scale.y` が速度 110 < 640 で増加（既存テストと同じ判定） |
| F6-T04 | Sortie（サイト）でも排気がプルームになり、逆スクロールで同じ見た目に戻る（gT 純関数） |
| F6-T05 | 排気の飽和割合: 追跡視点で機体シルエット内の輝度 >0.95 の画素 ≤ 15% |
| F6-T06 | 被弾で外板 emissive が橙に点灯し、0.3 秒後に 0 |
| F6-T07 | 遠景惑星の emissive = 0、大気シェルがあり `fog:false` |
| F6-T08 | 近傍ダストの数（PC 120 / SP 60）、速度に応じて線が伸びる |
| F6-T09 | 仕上げの uniform（vig/grain/ca）が設定され、L1 で grain=0・ca=0 |
| F6-T10 | **CON-05**: F2-T05/T06/T07 が引き続き合格（仕上げがレティクルに掛からない） |
| F6-T11 | 輝度プローブ: 基準 ±20%（ゲーム・サイト） |
| F6-T12 | draw call: PC L0 ≤ 155、SP ≤ 140 |

## 5. 既存テストの改訂

| 既存 | 改訂 | 理由 |
|---|---|---|
| phase3 `exhaustScale`（スプライト前提の比較） | 判定内容は同じ（scale.y の増加）。型チェックがあれば Sprite → Mesh | プルーム化 |

## 6. リスク

| リスク | 対策 |
|---|---|
| 色収差・ノイズが「汚れ」に見える | 既定値は控えめ（ルックデブで確認済み）。実プレイのレビューで定数のみ調整 |
| プルームの加算で機体後方が明るくなりすぎる | F6-T05 で機械的に上限を保証 |
