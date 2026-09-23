# SPEC 09d — Phase F4: 岩マテリアル刷新（法線・粗さ・トライプラナー・岩種・影）

状態: **Verified (2026-09-23 phaseF4 18/18・run-all 16スイート259テスト ALL GREEN。PC L0 描画 約1.7ms)** ／ 親: [SPEC-09](09-realism-gameplay-policy.md) R2 ／ 前提: F2 Verified（Look / 輝度プローブ） ／ 外部素材: 不要

## 1. 目的

岩を「青紫の平板なポリゴン」から「恒星に照らされたクレーターのある岩塊」にする。
ルックデブの接写で判明した **UV の引き伸ばし**（多面体の各面でクレーターが斜めに流れる）を解消する。

### 現状
- `makeRockTex`: `Math.random` 由来のまだら模様。`map` と `bumpMap` に同じテクスチャ（bumpScale .06）
- 色: 0x8a8fa8 / 0x9a8878 / 0x7d88a8（青紫寄り・明るめ）
- UV: IcosahedronGeometry の標準 UV（極付近と継ぎ目で歪む）

## 2. 要件

| ID | 要件 |
|---|---|
| F4-01 | 岩表面の高さマップを**シード付き**で Canvas 生成（多オクターブのまだら + 縁の盛り上がったクレーター + 微細な粒）。PC 512² / SP 256² |
| F4-02 | 高さマップから Sobel で**法線マップ**、同じ高さから**粗さマップ**を生成。アルベド（色）も同じ高さから派生させ、凹凸と色の模様を一致させる |
| F4-03 | **トライプラナー投影**: `onBeforeCompile` で MeshStandardMaterial を拡張し、岩ローカル空間の位置・法線で map / normalMap / roughnessMap をサンプリング（UV 非依存。岩が自転しても模様が岩に固定される） |
| F4-04 | 岩種 3 系統: C 型（暗灰 0x8a847d・粗さ .92・金属度 .03）/ S 型（褐色 0x96806c・.88・.03）/ M 型（金属質 0x7a8390・.55・.35） |
| F4-05 | 識別子: 岩メッシュに `userData.isRock = true`、岩種 `userData.type`（C/S/M） |
| F4-06 | 影（PC の Quality L0 のみ）: 主光の影を有効化。影を落とすのは機体に近い岩 **最大 8 個**、受けるのは全岩と機体。影カメラは機体に追従（正射影 ±45、far 260） |
| F4-07 | Quality 縮退への組み込み: L1 で影 OFF、L2 でトライプラナーを通常 UV サンプリングに切替（シェーダの define 切替） |
| F4-08 | 破片（爆発時の shards）は元の岩の材質を引き継ぐ（現行どおり `boom(..., material)`） |
| F4-09 | サイト背景の岩（Sortie 岩帯・章の岩）も同じ材質を使う（`Assets.rockMats()` 共有のため自動的に適用） |
| F4-10 | 明るさ: F2 の輝度プローブで平均輝度が基準 ±20% を維持。ヘッドライト LIGHT-02/03・LIGHT-S を維持 |
| F4-11 | 性能: draw call 予算を PC L0 のみ 140 → **155** に改訂（影パスの追加分 = 影キャスター 8 + 機体）。SP は影なしで 140 を維持 |

## 3. 技術設計

### 3.1 テクスチャ生成（F4-01/02）

ルックデブ `labs/lookdev.html` の `rockHeightCanvas` / `heightToNormal` / `roughFromHeight` を `Assets` に移植し、
`Math.random` をシード付き rng に置換する。

```js
function rockSurface(size, seed){
  const h = rockHeightCanvas(size, seed);             // グレースケール高さ
  return {
    albedo: albedoFromHeight(h),                      // 凹部を暗く・縁を明るく（AO 相当）。色は材質側の color で乗算
    normal: heightToNormal(h, 3.2),                   // Sobel、タイル境界は wrap で連続
    rough:  roughFromHeight(h, .88, .25)};
}
```

- `colorSpace`: albedo は SRGB、normal / rough は線形（NoColorSpace）
- テクスチャは岩種で共有（3 材質 × 3 テクスチャ = 9 枚ではなく、テクスチャ 3 枚を 3 材質で共有）

### 3.2 トライプラナー（F4-03）

```glsl
// vertex: 追加 varying
varying vec3 vObjPos; varying vec3 vObjN;
vObjPos = position; vObjN = normal;

// fragment: 3 軸投影の重み
vec3 tpW(vec3 n){ vec3 w = pow(abs(n), vec3(4.)); return w/(w.x + w.y + w.z); }
vec4 tp(sampler2D t, vec3 p, vec3 w){ return texture2D(t, p.yz*TP_SCALE)*w.x + texture2D(t, p.zx*TP_SCALE)*w.y + texture2D(t, p.xy*TP_SCALE)*w.z; }
// map_fragment を置換:        diffuseColor *= tp(map, vObjPos, w);
// roughnessmap_fragment を置換: roughnessFactor *= tp(roughnessMap, vObjPos, w).g;
// normal_fragment_maps を置換: 各軸の接空間法線を whiteout ブレンドでローカル法線に合成し、
//                              mat3(viewMatrix * modelMatrix) で視空間へ（fragment に modelMatrix を宣言）
```

- `TP_SCALE = .42`（実装時に .9 から改訂 → §4.1）
- `#define TRIPLANAR` の有無で通常 UV サンプリングに戻せる（F4-07 の L2 縮退）
- `customProgramCacheKey` を設定し、define 切替時にシェーダが正しく再コンパイルされるようにする
- 初回コンパイルのスタッター対策: 既存のシェーダウォームアップ（build 末尾の composer.render）で岩も1回描く

### 3.3 影（F4-06）

```js
key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
key.shadow.bias = -.0004; key.shadow.normalBias = .03;
// 毎フレーム: 影カメラの中心を機体へ
key.position.copy(ship.position).addScaledVector(LOOK.keyDir.clone().normalize(), 120);
key.target.position.copy(ship.position);
// 影キャスター: z∈[-120, 20] の岩を機体に近い順に最大 8 個だけ castShadow=true
```

- `R.shadowMap.type = PCFSoftShadowMap`
- SP（IS_TOUCH）は Quality の開始レベルが 1 のため、最初から影なし

## 4. 受け入れテスト（tests/phaseF4.js）

| テストID | 検証内容 |
|---|---|
| F4-T01 | 同じシードから同じ高さマップ（画素ハッシュ一致）。`makeRockTex` 系に `Math.random` が残っていない |
| F4-T02 | 3 材質とも map / normalMap / roughnessMap あり、bumpMap なし |
| F4-T03 | 法線マップの平均が (0.5, 0.5, 1.0) 近傍（±.05）で、平坦領域の法線が +z |
| F4-T04 | トライプラナー: 岩の2つの異なる面（法線が直交）で、テクスチャの縦横比の歪みが 1.2 以内（画面上の模様の自己相関で計測） |
| F4-T05 | 岩種: 色が C/S/M の3色、M 型の金属度 > C/S 型、`userData.isRock/type` が全岩にある |
| F4-T06 | 影: PC L0 で `R.shadowMap.enabled`、castShadow=true の岩が ≤ 8、機体が receiveShadow |
| F4-T07 | Quality L1 で影 OFF、L2 で TRIPLANAR の define が外れる |
| F4-T08 | 輝度プローブ: 基準 ±20% を維持（F2-T08 と同条件） |
| F4-T09 | サイトの Sortie 岩も新材質（`Assets.rockMats()` と同一参照） |
| F4-T10 | draw call: PC L0 ≤ 155、SP ≤ 140 |

### 4.1 実装時の判断・知見

- **F4-T04 の検証方法**: 「uv 属性を消した岩」を一様な半球光で描き、模様の分散で判定（トライプラナー 43.6 / 通常UV 0.0）。
  `material.clone()` は `onBeforeCompile` と独自 define を引き継がないため、実物の材質を `Assets.setTriplanar` で切り替えて測る
- **トライプラナーの縮尺**: 当初案 `.9` は UV 貼り（周長 1 タイル）比で模様が約 5 倍細かくなるため **`.42`** とした
- **継ぎ目**: 高さマップは端をまたぐ円を反対側にも描いてタイル化（Sobel も折り返し）。トライプラナーの繰り返しで線が出ない
- **輝度プローブの不具合修正**: F3 以降コアは未使用時に非表示になるため、プローブがコアの表示状態を固定しておらず、
  ページの履歴によって岩の黒つぶれ率が 3% ⇔ 8% と揺れていた（コアの加算光が近くの岩に乗るか否か）。プローブでコア1個の表示を明示して解消
- 実測: 岩の平均輝度 ゲーム 0.314 / 0.328（F2前 0.211 / 0.214）、岩の黒つぶれ 2.2% / 4.2%。描画 PC L0 約 1.7ms/フレーム

## 5. 既存テストの改訂

| 既存 | 改訂 | 理由 |
|---|---|---|
| phase2 AST-03 `hasMap && hasBump` | `hasMap && hasNormal && hasRough` | bump を法線マップに置換 |
| phase3 / phase4 BUDGET ≤140 | PC L0 は ≤155（影パス分）、それ以外 ≤140 | 影の追加 |
| phase4 PRF L1 の内容 | 「bloom 半解像度」に「影 OFF」を追加 | 縮退段の追加 |

## 6. リスク

| リスク | 対策 |
|---|---|
| 暗色の岩が見えにくくなる（視認性の低下） | 主光を接近面に当てる向き（F2）+ ヘッドライト + 輝度テスト。岩の色は反射率の上限側を採用済み |
| 影のちらつき（岩の高速移動） | キャスター 8 個・PCFSoft・normalBias で抑制。目立つ場合は影を機体のみ受ける設定へ縮小 |
| onBeforeCompile の three 版依存 | three は r160 固定で同梱。置換対象のチャンク名をテストで存在確認 |
