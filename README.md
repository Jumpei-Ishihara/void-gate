# VOID GATE — 深宇宙への入口

宇宙 × 近未来をモチーフにしたインタラクティブWebサイト。
サイト全体が**スクロールで三次元に展開する「出撃前ブリーフィング」**になっており、
ページを下るだけでミニゲーム ASTEROID RUN の遊び方が実物の3Dオブジェクトで説明されます。
最終章のLAUNCH DECK（または冒頭のボタン）からゲームを起動できます。

**章構成（一本の出撃飛行）**: GATE(着任) → SORTIE(射出) → FLIGHT(回避で凍結→操縦説明) →
WEAPONS(着弾閃光で凍結→機関砲説明) → SURVIVAL(激突の瞬間で凍結→シールド説明) →
帯を抜けて惑星が視界に開け → LAUNCH DECK(出撃) + 通信ターミナル

説明は**アクションの決定的瞬間で時間が凍結する「フリーズビート」**として挿入されます。
読み終えてスクロールを進めると時間が再開し、結末（爆発の完了・シールド砕散）が再生されます。
逆スクロールではすべてが逆再生されます。

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
- **40秒ごとにセクターが変わる**（OUTER BELT → DEBRIS FIELD → DENSE CORE → COMET STREAM → VOID RUN…）。
  岩は「壁に穴」「一本道」「横切る彗星流（予兆あり）」などのパターンで現れ、どの配置にも必ず抜け道がある。速度上限もセクターごとに上がる
- スコア＝航行距離×10＋**ニアミス**（岩肌すれすれの通過 150点）＋**撃破**（100＋40×岩の大きさ）＋残コア×500。
  ニアミス・撃破・コア回収を4秒以内に続けるとコンボ倍率が上がる（5回×1.5 / 10回×2 / 20回×3 / 35回×4）。被弾でリセット
- 被弾・撃破の瞬間にヒットストップ、ニアミスで風切り音とFOVキック。SPは被弾時に振動（起動メニューでOFF可）
- 結果画面にスコアの内訳（到達セクター・距離・ニアミス・撃破・残コア・最大コンボ）、**称号**（CADET → PILOT → ACE → VOID RUNNER）、
  自己ベスト上位5件を表示。**SHARE** で戦績を共有（Web Share / 非対応端末はクリップボードへコピー）
- 起動メニューで **RANDOM（通常）/ DAILY（本日のコース）** を選択。DAILYは日付から配置が決まり、同じ日なら誰でも同じコース
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

## SEO / SNS

- `title` / `description` / `canonical` / `robots` / JSON-LD構造化データ（WebSite + VideoGame）を実装
- OGP・X(Twitter) Card は `summary_large_image`。カード画像 `assets/og.png`(1200×630) はサイトの世界観に合わせて生成
- favicon（SVG + PNG）・Apple touch icon・`site.webmanifest`（ホーム画面追加/PWA相当）を用意
- `robots.txt`（tests/ を除外）と `sitemap.xml` を配置
- 検証: `tests/phaseSEO.js`（メタ22項目 + 実ファイル到達性 + OGP画像実寸）

## ドキュメント

| ファイル | 内容 |
|---|---|
| [DESIGN.md](DESIGN.md) | デザイン仕様書（ビジュアル・インタラクション・ゲーム設計・SP対応） |
| [QUALITY_PLAN.md](QUALITY_PLAN.md) | 素材クオリティ向上の方針書（Phase 1〜4、全実装済み） |
| [specs/](specs/00-overview.md) | SDD詳細設計書 SPEC 00〜09（要件ID・受け入れ基準つき） |
| [specs/09](specs/09-realism-gameplay-policy.md) | リアル質感×ゲーム品質向上: 方針書・詳細設計 09a〜09g・[実装計画](specs/09-implementation-plan.md)（F1〜F7 全て Verified） |
| [specs/10](specs/10-ship-redesign.md) | 機体デザイン刷新（一体成形のステルス迎撃機）— Verified |
| [labs/before-after.html](labs/before-after.html) | SPEC-09 の before / after 比較（着手前のコードと本番コードを同じ配置・カメラで左右比較）。提案時のルックデブは `labs/lookdev.html` |
| [HANDOFF.md](HANDOFF.md) | オフライン化完了報告（2026-06-12時点のスナップショット） |

## テスト

`tests/phase1〜4.js`(ゲーム) + `tests/phaseA〜D・E1〜E3.js`(サイト) + `tests/phaseSEO.js` + `tests/phaseF1〜F7.js`(SPEC-09) + `tests/phaseS1.js`(SPEC-10 機体) に受け入れテスト計325項目（20スイート）。`tests/run-all.js` で一括実行できます:

```js
fetch('tests/run-all.js').then(r=>r.text()).then(eval);   // 結果は window.__ALLRESULTS
```

## 使用技術・ライセンス

- [Three.js](https://threejs.org/) r160（MITライセンス） — 本体とアドオンを `libs/` に同梱
- フォント: [Orbitron](https://fonts.google.com/specimen/Orbitron) /
  [Noto Sans JP](https://fonts.google.com/noto/specimen/Noto+Sans+JP)（いずれもSIL Open Font License 1.1、サブセット化して同梱）
- 効果音・テクスチャ・3Dモデルはすべてコードによるプロシージャル生成（外部素材なし）
