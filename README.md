# VOID GATE — 深宇宙への入口

宇宙 × 近未来をモチーフにしたインタラクティブWebサイト。
Three.js (WebGL) によるフル3D背景の上で、スクロール＝ワープ航行、カーソル＝観測装置として
ページ操作のすべてが宇宙空間に反映されます。HEROの2つのボタンからミニゲームを起動できます。

**▶ プレイする: https://jumpei-ishihara.github.io/void-gate/**

- 完全オフライン設計（外部CDN・外部アセットなし、配布物合計約1.7MB）
- PC / スマートフォン両対応（SPのゲームは横画面プレイ）
- 効果音は全てWeb Audio合成、テクスチャは全てCanvas生成（音声・画像ファイル0個）

## 遊び方

### ASTEROID RUN（EXPLORE // 探査開始）

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

### SIGNAL TUNER（CONTACT // 交信）

深宇宙からの信号に周波数を合わせるチューニングゲーム。

- マウス/指の **横移動＝周波数、縦移動＝振幅**。シアンの自機波形をマゼンタの目標波形に重ねる
- 同調を1.3秒維持でチャンネル確立。**制限時間60秒で5チャンネル**同調すると
  メッセージが解読される。2オシレータの「うなり」で耳でも同調度がわかる
- スコア＝チャンネル×1000＋残り時間×20

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

`tests/phase1.js`〜`phase4.js` に受け入れテスト全70項目。ゲームページのコンソールで実行します:

```js
fetch('tests/phase1.js').then(r=>r.text()).then(eval);   // 結果は window.__P1RESULTS
```

## 使用技術・ライセンス

- [Three.js](https://threejs.org/) r160（MITライセンス） — 本体とアドオンを `libs/` に同梱
- フォント: [Orbitron](https://fonts.google.com/specimen/Orbitron) /
  [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)（いずれもSIL Open Font License 1.1、サブセット化して同梱）
- 効果音・テクスチャ・3Dモデルはすべてコードによるプロシージャル生成（外部素材なし）
