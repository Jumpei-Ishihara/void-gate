# SPEC 07c — Phase C: 導入章・NAVIGATION・LAUNCH DECK・HUD/コピー全面差替え

状態: **Draft** ／ 親: [SPEC-07](07-scroll-guide.md) ／ 前提: 07b Verified ／ 外部素材: 不要

## 1. 目的

物語の入口（GATE/BRIEFING）と出口（NAVIGATION/LAUNCH DECK）を実装し、
HUD・ナビゲーション・ページ全体のコピーをブリーフィング体裁に統一して1本の体験に結合する。

## 2. 要件

| ID | 要件 |
|---|---|
| C-01 | 章00 GATE: 現行HEROを継承しつつ、コピーを着任通知に差替え。CTAボタンは撤去せず「▼ 発進シークエンス開始」のスクロールキューを主導線にする（ボタンは残置=ショートカット） |
| C-02 | 章01 BRIEFING: 2つの任務ホログラム（小型岩塊 / 波形リング）が左右に浮かび、任務概要2行を表示 |
| C-03 | 章06 NAVIGATION: 既存の惑星セレクタとその3D連動を存置し、コピーを「航行宙域の選択」訓練として差替え（MIG-01） |
| C-04 | 章07 LAUNCH DECK: ①EXPLORE/CONTACT の2CTA（既存ボタン移設・機能不変） ②`vg-ast-best`/`vg-sig-best` のベストスコア表示（未プレイ時は `NO RECORD`） ③操作早見表（PC/SP出し分け）を3Dチルトカード意匠で常設 |
| C-05 | HUD: セクター表示を `BRIEFING 00〜07/07` 表記に変更し、右端プログレスバーは維持。四隅フレーム・スキャンライン維持 |
| C-06 | ナビ(PC): 章アンカーへのスムーズスクロールリンクに差替え（GATE/FLIGHT/WEAPONS/SURVIVAL/COMM/LAUNCH） |
| C-07 | 旧 TECHNOLOGY セクションは廃止（3Dチルトカード機構はC-04の早見表に転用）。旧MISSION本文はBRIEFINGに吸収（B-07と整合） |
| C-08 | `<title>`・OGP相当のmeta description・READMEの構成説明を新構成に合わせて更新 |
| C-09 | ページ内の全コピーがブリーフィング文体（07bの文体基準）で統一されている |

## 3. 技術設計

### 3.1 GATE / BRIEFING（C-01/02）

- GATE: 既存HERO DOMを流用。タイピング行を「新任オペレーター、着任を確認。」系に差替え。
  スクロールキューを大型化し `▼ 発進シークエンス開始` のラベル+明滅
- BRIEFINGホログラム: `Assets.buildRock()`（scale 0.5・ワイヤーフレーム風half-opacity）と
  波形トーラス（TorusGeometry+シアン加算）をカメラ相対 x=±5 に配置、tlで浮遊+自転。
  「ホログラム」表現は加算合成+走査線シェーダ無しの簡易表現（opacity .5 + 微グリッチ点滅）で足りる

### 3.2 LAUNCH DECK（C-04）

- 発進口: 2CTAを大型パネル化（既存 .btn 意匠を拡大、EXPLORE=シアン/CONTACT=マゼンタ）。
  クリック挙動は既存 `btn-explore/btn-contact` のリスナーをそのまま移設
- ベストスコア: `localStorage.getItem('vg-ast-best'|'vg-sig-best')`。表示はOrbitron数字+`BEST`ラベル。
  ゲームEXIT後にページへ戻った際も最新化（closeLayer後に再描画フック）
- 操作早見表: 2枚のチルトカード（ASTEROID RUN / SIGNAL TUNER）。中身はREADMEの操作表と同一内容を
  IS_TOUCHで出し分け。README・ゲーム内メニュー・早見表の三者で文言を一致させる（単一ソース化:
  JSの `CONTROLS` 定数から3箇所へ供給）

### 3.3 HUD・ナビ（C-05/06）

- 既存 `#hud-status` の文言テーブルを章対応に差替え: `BRIEFING 02/07 — FLIGHT // 操縦訓練` 等
- 章判定は Tl.smoothT と CHAPTERS の t0/t1 から導出（スクロール位置判定の既存checkReveals併用）
- ナビリンクは `scrollIntoView({behavior:'smooth'})`。reduced-motion時は `auto`

### 3.4 旧コンテンツの整理（C-07）

| 旧 | 処置 |
|---|---|
| MISSION 本文 | BRIEFING 01 の任務概要2行に圧縮吸収 |
| TECHNOLOGY カード3枚 | セクション廃止。チルト機構コードは早見表カードで続投 |
| PLANETS | NAVIGATION 章として存置（コピーのみ差替え） |
| CONTACT フォーム | 章05 COMM 末尾へ移設済み（07b）。旧セクションの殻を除去 |

## 4. 受け入れ基準

| AC | 内容 |
|---|---|
| AC-01 | 全8章がスクロール1本で連続し、HUDの章表記・プログレスが同期する |
| AC-02 | LAUNCH DECKの2CTAからゲームが起動し、EXIT後ベストスコアが更新表示される |
| AC-03 | 早見表・README・ゲーム内メニューの操作文言が一致（CONTROLS単一ソース） |
| AC-04 | ナビリンクで各章へスムーズスクロールできる |
| AC-05 | 旧TECHNOLOGY/旧CONTACT殻がDOMから消え、被リンク切れ・未参照CSSが残らない |
| AC-06 | tests/phase1〜4 + phaseA/B 回帰グリーン |

## 5. リスク

- CTAをページ末尾に移すことで「すぐ遊びたい」ユーザーの導線が長くなる → GATE章のボタン残置（C-01）と
  ナビの `LAUNCH` 直行リンクで救済
- ベストスコア表示は端末ローカル値であることを小書きで明示（誤解防止）
