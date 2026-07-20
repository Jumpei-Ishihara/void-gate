# SPEC 02 — ブルーム(発光)ポストプロセス（Phase 1）

状態: **Verified (2026-07-20 パス順序/閾値/解像度係数テスト合格・発光と可読性を目視確認)** ／ 外部素材: **不要**（Three.js公式アドオンをローカル同梱 — 取得手順は§3.1）

## 1. 目的

発光素材（コア・トレーサー・ネオントリム・爆発・計器）に物理的な「にじみ光」を与え、
ネオンSFの世界観を成立させる。既存の残像(Afterimage)と直列合成する。

## 2. 要件

| ID | 要件 |
|---|---|
| BLM-01 | `UnrealBloomPass` を導入し、ASTEROID RUNの3Dシーンに適用する |
| BLM-02 | パス順序は Render → **Bloom** → Afterimage とする（残像がブルーム光も引き伸ばす） |
| BLM-03 | 発光すべき素材（emissive/AdditiveBlending系）だけが目立って光り、岩や暗部が白飛びしない |
| BLM-04 | SPではブルーム解像度を1/2にし、性能予算(SPEC-00 §2)を守る |
| BLM-05 | 被弾時のダメージ演出・CRITICAL非常灯(SPEC-05)と干渉せず加算的に機能する |
| BLM-06 | メインページ背景の3Dシーンには適用しない（ゲーム専用。ページ側の負荷を増やさない） |
| BLM-07 | 必要アドオンはすべて `libs/addons/` に同梱し、オフライン動作を維持する |

## 3. 技術設計

### 3.1 同梱ファイル（要追加）

three r160 の GitHubリリース（`three@0.160.0/examples/jsm/`）から以下をコピーして同梱:

```
libs/addons/postprocessing/UnrealBloomPass.js
libs/addons/shaders/LuminosityHighPassShader.js
```

- 依存確認: UnrealBloomPass は `Pass.js` `CopyShader.js`（同梱済）と上記HighPassのみに依存
- 取得元: https://github.com/mrdoob/three.js/tree/r160/examples/jsm （MITライセンス、追加表記不要）
- 追加容量: 約20KB

### 3.2 統合（`build()` 内 composer 構築部）

```js
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
// composer 構築(既存 L1018 付近)を以下の順に変更
composer.addPass(new RenderPass(S, C));
bloom = new UnrealBloomPass(
  new THREE.Vector2(innerWidth*RES, innerHeight*RES),
  BLOOM.strength, BLOOM.radius, BLOOM.threshold);
composer.addPass(bloom);
afterimage = new AfterimagePass(.8);
composer.addPass(afterimage);
```

### 3.3 パラメータ（初期値と調整範囲）

| パラメータ | 初期値 | 調整範囲 | 備考 |
|---|---|---|---|
| threshold | 0.55 | 0.4〜0.8 | 低すぎると岩まで光る(BLM-03) |
| strength | 0.85 | 0.5〜1.4 | 爆発時に一時ブースト可(SPEC-04連携) |
| radius | 0.6 | 0.3〜1.0 | 大きいほど滲む |
| RES(解像度係数) | PC:1.0 / SP:0.5 | — | BLM-04。`IS_TOUCH` で分岐 |

- resize() で `bloom.setSize(innerWidth*RES, innerHeight*RES)` を追従させる
- 白飛び抑制のため、閾値調整と併せて非発光素材の emissive を 0x000000 に保つ

### 3.4 発光させる素材の整理（threshold設計の根拠）

| 素材 | 現行 | 対応 |
|---|---|---|
| エネルギーコア | MeshBasic cyan + Additive | そのまま強く光る(狙い) |
| トレーサー/爆発 | Additive | そのまま(SPEC-04で強化) |
| コックピットトリム/レバー発光部 | MeshBasic cyan | 光量微調整(眩しすぎ注意) |
| 計器パネル(CanvasTexture) | MeshBasic map | 文字が滲みすぎる場合はパネルのみ輝度を10%落とす |
| 岩・機体ハル | Standard 非発光 | threshold未満に収まることを確認 |

## 4. 受け入れ基準（AC）

| AC | 内容 | 対応要件 |
|---|---|---|
| AC-01 | コア・トレーサー・ネオンが視認上「発光」して見える(Before/Afterスクリーンショット比較) | BLM-01,02 |
| AC-02 | 岩・宇宙背景の暗部に白飛び・面光りがない | BLM-03 |
| AC-03 | 計器の文字が判読可能なまま | BLM-03 |
| AC-04 | PC 60fps維持 / SP相当(CPU 4x throttle)でフレーム時間 <16ms | BLM-04 |
| AC-05 | メインページ側のfpsが導入前と同一 | BLM-06 |
| AC-06 | オフライン(ローカルサーバのみ)で動作、外部リクエスト0 | BLM-07 |

## 5. リスク・備考

- UnrealBloomPassは内部で複数RTを確保する→ ゲーム終了時もcomposerは使い回しのため追加解放処理は不要（既存方針踏襲）
- SPで負荷超過した場合の段階的縮退: RES 0.5→0.35 → strength 0.6 → 最終手段としてSPのみ無効化（SPEC-06の自動調整と連動）
- Afterimageとの順序を逆(Afterimage→Bloom)にすると残像まで再発光してハレーションが出るため禁止(BLM-02の根拠)
