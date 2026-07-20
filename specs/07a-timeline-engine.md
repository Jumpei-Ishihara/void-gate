# SPEC 07a — Phase A: 共有ファクトリ抽出＋タイムライン基盤＋カメラパス

状態: **Verified (2026-07-20 テスト15/15・ゲーム回帰70項目グリーン)** ／ 親: [SPEC-07](07-scroll-guide.md) ／ 外部素材: 不要

## 1. 目的

見た目を変えずに土台だけを入れ替えるフェーズ。
①ゲーム内の3D生成関数をページと共有できる形に抽出し（回帰網で安全確認）、
②スクロール進行度を単一タイムラインとして配布する駆動系と、
③キーフレーム式カメラパス＋ページ側ブルームを導入する。

## 2. 要件

| ID | 要件 |
|---|---|
| A-01 | `Assets` ファクトリをモジュールスコープに新設し、`deformRock(geo,seed)` / `makeRockTex(size)` / `rockMats()` / `buildCore()` / `buildShip()` を提供する |
| A-02 | AsteroidRun は自前実装を捨て Assets を参照する。**ゲームの見た目・挙動・テスト結果は完全不変**（tests/phase1〜4 全グリーンが受け入れ条件） |
| A-03 | タイムライン `Tl` を新設: RAF内で `T = scrollY/(scrollH-innerH)` をサンプリングし、慣性 `smoothT += (T-smoothT)*min(1,dt*4)` で全駆動系に配布する（scrollイベント内で3D更新しない） |
| A-04 | 章テーブル `CHAPTERS = [{id, t0, t1, update(tl)}]` を宣言的に定義し、Tlが章ローカル進行度 `tl=(smoothT-t0)/(t1-t0)` を各章に配る（範囲外は0/1にクランプして必ず毎フレーム呼ぶ＝進入/退出も純関数） |
| A-05 | ページカメラをキーフレームパス駆動に変更: `CAM = [{t, x,y,z, rx,ry, fov}]` を線形補間（章境界はイージング）。現行の「スクロールでZ前進」体験は初期キーフレームで再現する |
| A-06 | ページ側レンダラを EffectComposer 化し、PCのみ UnrealBloomPass(strength .5, threshold .62, 半解像度) を適用。SP/性能超過時は素通し（VIS-04, PER-03） |
| A-07 | 既存セクションのreveal機構・HUDセクター表示・プログレスバーは本フェーズでは現状維持（Phase Cで差替え） |
| A-08 | `window.VG` に `Tl`（読み取りと`_setT(t)`テストフック）と `Assets` を追加公開する |

## 3. 技術設計

### 3.1 Assets 抽出（A-01/02）

- 現在 AsteroidRun IIFE 内にある `deformRock` / `makeRockTex` / `mergeGeo` を
  IIFEの**外**（SoundEngine直後）へ移動し `const Assets = {...}` に集約
- 新規 `buildCore()`: 現在 build() 内のコア生成（八面体+halo+ring1+ring2、userData.ring1/2付き）を関数化
- 新規 `buildShip()`: 機体一式（nose/wing/fin/eng + ノズル/排気/翼端灯）を `{group, fx:{exhaust,tips,...}}` で返す
- AsteroidRun.build() は `Assets.deformRock(...)` 等を呼ぶだけに変更。**引数・戻り値・乱数消費順を変えない**
  （乱数順が変わると岩の見た目が変わる — 許容するが、テストは形状同一性でなく構造で判定しているため影響なし）
- starTex はモジュールスコープ既存のため Assets から参照可

### 3.2 Tl / CHAPTERS（A-03/04）

```js
const Tl = (()=>{
  let T = 0, smoothT = 0;
  const chapters = [];
  function sample(){ const h = document.documentElement;
    T = h.scrollHeight > innerHeight ? scrollY/(h.scrollHeight-innerHeight) : 0; }
  function update(dt){                       // ページRAF(既存loop())から毎フレーム
    smoothT += (T - smoothT)*Math.min(1, dt*4);
    for(const c of chapters){
      const tl = Math.min(1, Math.max(0, (smoothT - c.t0)/(c.t1 - c.t0)));
      c.update(tl);                          // 純関数: 同じtlなら同じ見た目(SCR-05)
    }
  }
  return {register: c=>chapters.push(c), sample, update,
          get t(){return smoothT}, _setT(v){T = v; smoothT = v;}};
})();
addEventListener('scroll', Tl.sample, {passive:true});
```

- 既存 `loop()`（ページ側RAF）に `Tl.update(dt)` を1行追加。dtは既存計測を流用
- 本フェーズでは CHAPTERS は空〜ダミー1件（カメラのみ）。章実体はPhase B

### 3.3 カメラパス（A-05）

```js
const CAM = [
  {t:0,   z:0,    y:0,  fov:60},     // GATE
  {t:.14, z:-90,  y:0,  fov:60},     // BRIEFING
  {t:.30, z:-210, y:-2, fov:62},     // FLIGHT(岩帯)
  ...                                 // Phase Bで章確定後に本数を確定
  {t:1,   z:-760, y:0,  fov:66}];    // LAUNCH DECK
function camAt(t){ /* 区間線形補間 + smoothstepイージング */ }
```

- 現行実装（`camera.position.z = -T*k` 相当）はキーフレーム2点で等価再現できるため、
  Phase A完了時点の見た目は現状とほぼ同一（差分はイージングのみ）
- パララックス（マウス微動）・クリックパルスは現行のまま加算合成

### 3.4 ページ側ブルーム（A-06）

- `pageComposer = EffectComposer(renderer)` + RenderPass + （PCのみ）UnrealBloomPass(半解像度, .5/.6/.62)
- 既存の `renderer.render(scene, camera)` 呼び出しを `pageComposer.render()` に置換
- ゲーム起動中はページRAFが停止する現行仕様のため、ゲームとの二重負荷なし
- フレーム予算超過（3秒移動平均>12ms）でページブルームを恒久OFF（Qualityとは独立の軽量判定）

## 4. 受け入れ基準

| AC | 内容 |
|---|---|
| AC-01 | tests/phase1〜4 全70項目がグリーン（Assets抽出の回帰、A-02） |
| AC-02 | `VG.Assets` の各ファクトリが機能し、ゲーム内の岩/コア/機体がAssets経由で生成されている |
| AC-03 | `VG.Tl._setT(x)` で任意進行度を注入でき、同一tに対しカメラ位置が決定的（往復しても同値） |
| AC-04 | カメラがキーフレーム通りに補間される（t=0/中間/1の3点で位置検証） |
| AC-05 | PCでページ側ブルームパスが有効、SP相当では素通し |
| AC-06 | ページスクロールのフレーム時間がPC<12ms（RAF計測） |
| AC-07 | コンソールエラー0・外部リクエスト0 |

## 5. テスト計画（tests/phaseA.js）

- Assets API表面 / ゲーム起動後に asts[0].geometry が Assets 生成物か（uuid照合用のタグ付け）
- `_setT` 決定性: t=.3→.7→.3 でカメラ座標が一致
- CAM補間: 3点スナップショット
- ページcomposerのパス構成（PC: Render+Bloom / touch: Renderのみ）
- 回帰: phase1〜4 を連続実行
