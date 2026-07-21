# VOID GATE — 深宇宙への入口

宇宙 × 近未来をモチーフにしたインタラクティブWebサイト。
サイト全体が**スクロールで三次元に展開する「出撃前ブリーフィング」**になっており、
ページを下るだけでミニゲーム ASTEROID RUN の遊び方が実物の3Dオブジェクトで説明されます。
最終章のLAUNCH DECK（または冒頭のボタン）からゲームを起動できます。

**章構成**: GATE(着任) → BRIEFING(任務概要) → FLIGHT(操縦) → WEAPONS(武装) →
SURVIVAL(生存規定) → NAVIGATION(航行宙域) → LAUNCH DECK(出撃) + 通信ターミナル

**▶ プレイする: https://jumpei-ishihara.github.io/void-gate/**

- 完全オフライン設計（外部CDN・外部アセットなし、配布物合計約1.7MB）
- PC / スマートフォン両対応（SPのゲームは横画面プレイ）
- 効果音は全てWeb Audio合成、テクスチャは全てCanvas生成（音声・画像ファイル0個）

## 遊び方

### ASTEROID RUN（EXPLORE // 探査開始）

> ※かつて併設していた交信ゲーム SIGNAL TUNER は SPEC-08 で撤去済み

小惑星帯を回避飛行しながらエネルギーコア ◆ を回収する3D飛行ゲーム。

- シールドは3枚。**4発目の被弾で機体大破**（シールド0のCRITICAL中は赤色非常灯が明滅）
- 機関砲はコアを1つ消費して正面の小惑星を破壊（初期コア2個。空撃ちは消費なし）
- 速度は時間とともに上昇。スコア＝航行距離×10＋残コア×500
- 視点は起動メニューで **COCKPIT（操縦席）/ CHASE（追跡）** を選択

| 操作 | PC | スマートフォン |
|---|---|---|
| 操縦 | マウス移動 | 画面をドラッグ |
| 機関砲 | 左クリック | **左下のFIREボタン**（長押しで連射） |
| 視点切替 | `V` / HUDボタン | 起動メニューで選択 |
| 自動ロックオン切替 | `L` / HUDボタン | AUTO固定 |
| サウンドON/OFF | `M` / HUDボタン | HUDの♪ボタン |
| 終了 | `ESC` / EXITボタン | EXITボタン |

### スマートフォンでのプレイ

- ミニゲームは**横画面専用**です。縦持ちのままだと回転ガイドが表示され、ゲームは一時停止します
- 起動メニューの「フルスクリーンでプレイ」チェック（デフォルトON）で全画面プレイできます
  （対応端末では横画面に自動固定。iPhone SafariはOS制約により通常表示＋回転ガイドで動作）

## ローカルで動かす

ビルド不要。ESモジュールを使うため、HTTPサーバ経由で開いてください（file://直開き不可）。

```bash
git clone https://github.com/Jumpei-Ishihara/void-gate.git
cd void-gate
python3 -m http.server 8000
# → http://localhost:8000/ を開く
```

## ドキュメント

| ファイル | 内容 |
|---|---|
| [DESIGN.md](DESIGN.md) | デザイン仕様書（ビジュアル・インタラクション・ゲーム設計・SP対応） |
| [QUALITY_PLAN.md](QUALITY_PLAN.md) | 素材クオリティ向上の方針書（Phase 1〜4、全実装済み） |
| [specs/](specs/00-overview.md) | SDD詳細設計書 SPEC 00〜06（要件ID・受け入れ基準つき、全てVerified） |
| [HANDOFF.md](HANDOFF.md) | オフライン化完了報告（2026-06-12時点のスナップショット） |

## テスト

`tests/phase1〜4.js`(ゲーム) + `tests/phaseA〜D.js`(ガイドサイト) に受け入れテスト計129項目。`tests/run-all.js` で一括実行できます:

```js
fetch('tests/run-all.js').then(r=>r.text()).then(eval);   // 結果は window.__ALLRESULTS
```

## 使用技術・ライセンス

- [Three.js](https://threejs.org/) r160（MITライセンス） — 本体とアドオンを `libs/` に同梱
- フォント: [Orbitron](https://fonts.google.com/specimen/Orbitron) /
  [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)（いずれもSIL Open Font License 1.1、サブセット化して同梱）
- 効果音・テクスチャ・3Dモデルはすべてコードによるプロシージャル生成（外部素材なし）
