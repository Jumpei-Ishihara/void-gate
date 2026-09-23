# SPEC 09b — Phase F2: 照明・トーンマッピング・環境反射（Look モジュール）

状態: **Draft** ／ 親: [SPEC-09](09-realism-gameplay-policy.md) R1 ／ 前提: F1 Verified ／ 外部素材: 不要

## 1. 目的

「恒星1灯の硬い明暗境界 + 弱い回り込み光 + 映り込み + 露出管理」へ移行し、ゲームとサイト背景の見た目を
共通の `Look` モジュールで揃える。**画面の明るさは現行と同等に保つ**（過去FB「ゲーム中が暗い」の再発防止）。

## 2. 要件

| ID | 要件 |
|---|---|
| F2-01 | 共通モジュール `Look` を `glowTexture` の直後に新設: `spaceEnv(renderer)` / `rig(scene, opts)` / `GradeShader` / 定数 `LOOK` |
| F2-02 | 環境マップ: 恒星の輝点+ハロー+淡い星雲を持つ手続き的な空を PMREM で生成し、`scene.environment` に設定（ゲーム・サイト両方） |
| F2-03 | 照明: `AmbientLight` を撤去し、Hemisphere（空 0x2a3e66 / 地 0x0a0710）+ 主光 Directional（暖白 0xfff0dc）+ リム Directional（0x6fb8ff）に置換。強度は §3.4 の較正で確定 |
| F2-04 | トーンマッピング: ACES Filmic（three r160 と同一の式）を**ゲームは GradePass**、サイトは `renderer.toneMapping` で適用 |
| F2-05 | **CON-05**: レティクルはトーンマップの**後**に合成し、色 0x00f0ff・不透明度 .12 と、黒背景上の画素値を現行と一致（±3/255）させる |
| F2-06 | bloom を HDR 基準へ: 閾値 1.0 / 強度 .45 / 半径 .3（ゲーム）。本当に光る物（コア・排気・曳光弾・閃光・ノズル・翼端灯）は色を HDR 値（>1）へ引き上げ、bloom 対象を「発光体のみ」にする |
| F2-07 | 機体外板の emissive（0x16335f）を撤去。明るさは主光と映り込みで得る |
| F2-08 | フォグ: ゲーム `FogExp2(0x01010a, .0026)`、サイトも同系色に統一 |
| F2-09 | 明るさの保証: 固定配置の計測フレームで、平均輝度が**現行値の ±20%**、白飛び率が現行以下、黒つぶれ率が現行 +10pt 以内（ゲーム: 追跡/操縦席視点、サイト: 4章） |
| F2-10 | ヘッドライト: 既存 LIGHT-02/03（ゲーム）・LIGHT-S（サイト）の閾値を満たすよう強度のみ再較正 |
| F2-11 | 性能: ゲームの draw call 予算（≤140）と Quality の段階縮退を維持。GradePass は全画面1パスのみ追加 |

## 3. 技術設計

### 3.1 ゲームの合成パイプライン（F2-04/05）

```
現行: RenderPass(S) → Bloom → Afterimage → 画面(sRGB化)
新規: RenderPass(S) → Bloom → GradePass(ACES, 線形→線形) → RenderPass(hudS, clear=false, clearDepth=true) → Afterimage → 画面(sRGB化)
```

- **レティクルを専用シーン `hudS` に移す**。`hudRig`（Group）の matrixWorld を毎フレーム `C.matrixWorld` に一致させ、
  レティクル `ret` をその子にする（ローカル座標 (x, -.65, -3) とロック時の移動・拡縮ロジックは不変）
- hudS の描画は **ACES の後・線形空間のまま**なので、黒背景上の加算結果は現行と同一
  （現行: 線形 HalfFloat RT に .12×linear(cyan) を加算 → 最後に sRGB 化。新規も同じ順序）
- Afterimage より前に置くので、レティクルの残像の見え方も現行と同じ
- `hudRig.visible = view === 'cockpit'`（現行は cockpit.visible に従属していたのと同じ挙動）
- `R.toneMapping` は `NoToneMapping` のまま（最終コピーで二重にトーンマップしないため）
- DOM カーソル（`#cursor` / `body.no-cursor #cursor`）は WebGL の外なので影響なし

### 3.2 GradeShader（F2-04、F6 で仕上げ効果を追加する器）

```glsl
uniform sampler2D tDiffuse; uniform float exposure;
// three r160 tonemapping_pars_fragment と同一
vec3 RRTAndODTFit(vec3 v){ vec3 a = v*(v + .0245786) - .000090537; vec3 b = v*(.983729*v + .4329510) + .238081; return a/b; }
vec3 aces(vec3 c){
  const mat3 I = mat3(vec3(.59719,.07600,.02840), vec3(.35458,.90834,.13383), vec3(.04823,.01566,.83777));
  const mat3 O = mat3(vec3(1.60475,-.10208,-.00327), vec3(-.53108,1.10813,-.07276), vec3(-.07367,-.00605,1.07602));
  c *= exposure/.6; c = I*c; c = RRTAndODTFit(c); c = O*c; return clamp(c, 0., 1.);
}
void main(){ gl_FragColor = vec4(aces(texture2D(tDiffuse, vUv).rgb), 1.); }
```

- 出力は線形 0〜1。以降の hud 合成と Afterimage は現行どおり線形で行われる
- ルックデブ（labs/lookdev.html）は近似式だったため、露出は §3.4 で本番の式に対して再較正する

### 3.3 Look.spaceEnv / Look.rig（F2-01/02/03）

```js
const Look = (()=>{
  const LOOK = {keyDir: new THREE.Vector3(-60, 35, 40), keyColor: 0xfff0dc, keyI: 7.5,
                hemiSky: 0x2a3e66, hemiGround: 0x0a0710, hemiI: .9,
                rimDir: new THREE.Vector3(40, 18, -70), rimColor: 0x6fb8ff, rimI: 2.4,
                exposure: 1.0, fog: 0x01010a};
  function spaceEnv(renderer){ /* ルックデブの buildSpaceEnv を移植。PMREM は生成後 dispose */ }
  function rig(scene, o = {}){ /* hemi + key + rim を追加して {hemi, key, rim} を返す */ }
  const GradeShader = {...};
  return {LOOK, spaceEnv, rig, GradeShader};
})();
```

- 主光の向き: カメラ後方・左上から（接近する岩の**こちら向きの面が照らされる** = 回避の視認性を確保）
- サイト: `AmbientLight(0x223355,1.6)` と `sun PointLight(0x88bbff,2800)` を `Look.rig` に置換。惑星（aqua）は主光で昼夜の境界が出る。
  サイトは主光の方向だけ章の構図に合わせて `opts.keyDir` で上書きできる
- サイトのトーンマップ: `renderer.toneMapping = ACESFilmicToneMapping`（PC はブルームの最終コピー、SP は各マテリアルで適用される。SP は合成パスを増やさない）

### 3.4 較正手順（F2-09/10）— テスト先行

1. **RED の前に**現行コードで計測プローブを実行し、基準値をテストファイルに定数として記録する
2. 実装後、同じプローブで ±20% に入るまで `LOOK.keyI` / `exposure` のみを調整する（他の値は固定）

計測プローブ `AsteroidRun.debug().lookProbe(view)`:
- 岩をルックデブと同じ固定配置（シード 7 の LAYOUT）へ一時移動、機体を原点、カメラを定位置、Afterimage の damp を 0
- `composer.render()` → `readPixels` → `{mean, rms, blownPct, crushedPct}` を返し、状態を復元
- サイト側は `VG.pageFx.lookProbe(chapterId, k)`（GATE / FLIGHT凍結 / SURVIVAL凍結 / LAUNCH DECK）

### 3.5 HDR 発光体（F2-06）

| 対象 | 現行 | 新規（線形値） |
|---|---|---|
| コア本体 / リング | 0x00f0ff | ×2.2 |
| 排気・エンジン光 | 0x66e8ff / 0x00f0ff | ×1.6 |
| ノズル光 | 0x7df1ff | ×1.8 |
| 曳光弾・閃光 | 各色 | ×3.0 / ×4.0 |
| 翼端灯 | 赤/緑 | ×1.5 |

`material.color.multiplyScalar(k)`（HalfFloat RT なので 1 を超える値を保持できる）。
被弾時の一時的なブルーム強化（FX-07）は「基準強度 × 1.6」へ相対化する。

## 4. 受け入れテスト（tests/phaseF2.js）

| テストID | 検証内容 |
|---|---|
| F2-T01 | `VG.Look` が存在し、ゲーム S / サイト scene の `environment` が PMREM テクスチャ |
| F2-T02 | ゲーム・サイトとも AmbientLight が 0 個、Hemisphere 1 / Directional ≥2 |
| F2-T03 | ゲームのパス順: Render → Bloom → Grade → Render(hud) → Afterimage |
| F2-T04 | サイト `renderer.toneMapping === ACESFilmicToneMapping`、ゲーム `R.toneMapping === NoToneMapping`（二重適用なし） |
| F2-T05 | **CON-05**: retMat の color=0x00f0ff / opacity=.12 / AdditiveBlending が不変 |
| F2-T06 | **CON-05**: メインシーンを黒にした状態でレティクル中心の画素が `sRGB(.12×linear(0x00f0ff))` と ±3/255 で一致 |
| F2-T07 | GradePass の出力にレティクルが含まれない（hud パスが Grade の後） |
| F2-T08 | 明るさ（追跡/操縦席）: mean が基準 ±20%、blown ≤ 基準、crushed ≤ 基準+10pt |
| F2-T09 | 明るさ（サイト4章）: 同上 |
| F2-T10 | bloom 閾値 1.0 / 強度 .45、コアの material.color の最大成分 > 1 |
| F2-T11 | 機体外板の emissive が 0 |
| F2-T12 | draw call ≤ 140（PC L0） |

## 5. 既存テストの改訂（意図的な仕様変更）

| 既存 | 改訂内容 | 理由 |
|---|---|---|
| phase1 BLM-01/02 パス順 `R=0,B=1,A=2` | 相対順序 `R < B < Grade < Hud < A` | Grade/Hud パス追加 |
| phase1 BLM-03 閾値 .4〜.8 | .9〜1.1 | HDR 基準へ移行 |
| phase2 FX-07/07b 強度 .85 基準 | `基準強度×1.6` / 基準へ復帰 | 基準強度 .45 へ変更 |
| phase3 LIGHT-02 の岩の抽出 `material.bumpMap` | `userData.isRock` | F4 で bump を廃止するため先行して識別子を追加 |

## 6. リスク

| リスク | 対策 |
|---|---|
| 画面が暗くなる | F2-T08/09 の輝度テストで機械的に阻止。調整は主光強度と露出の2値のみ |
| 計器パネル（Canvas 表示）が ACES で沈む | パネル素材を HDR 化（×1.25）し、文字のコントラスト比 ≥ 4.5 をテスト（F2-T08 の操縦席視点で追加計測） |
| SP のサイトは per-material トーンマップで PC と見た目がわずかに違う | 許容（輝度テストは PC/SP 両方の値で判定） |
