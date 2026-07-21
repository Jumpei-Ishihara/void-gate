# SPEC 08a — Phase E1: SIGNAL TUNER撤去＋テスト/文書改訂

状態: **Verified (2026-07-20 phaseE1 14/14・run-all 136テスト ALL GREEN・残存参照ゼロをビルド時assert検証)** ／ 親: [SPEC-08](08-action-sequence.md) ／ 外部素材: 不要

## 1. 目的

ゲーム・導線・ガイド章・テスト・文書からSIGNAL TUNERを一貫して取り除き、
「ASTEROID RUN一本のサイト」として全テストグリーンの状態を作る（構成変更はE2以降）。

## 2. 削除対象の完全リスト

### index.html — コード
| 識別子 | 種別 | 処置 |
|---|---|---|
| `const SignalGame = (()=>{...})()` | IIFE全体 | 削除 |
| `SoundEngine.beatOsc` | 関数+API表面 | 削除（`ui('sync')`は解除音として存置） |
| `openLayer('signal')` 分岐 / `activeGame === 'signal'` 参照(input/touch/resize/closeLayer) | 分岐 | asteroid専用へ単純化 |
| `wave-canvas` 要素 + `#wave-canvas` CSS + `waveCv` 変数 | DOM/CSS/JS | 削除 |
| `#game-layer.glock` CSS + `glock` 付与コード | 演出 | 削除（SIGNAL専用） |
| `btn-contact`(hero) / `deck-contact`(LAUNCH DECK) + 配線 | CTA | 削除。heroはEXPLORE単独ボタンに |
| `CONTROLS.signal` + 早見表SIGNALカード | 早見表 | 削除（カード1枚に） |
| `vg-sig-best` 参照 / `#best-sig` 表示 | スコア | 削除 |
| Guide `comm` 章(COPY/builder/DOM `#ch-comm`) | ガイド章 | 削除（存在しないゲームの説明のため） |
| `#contact`セクション | フォーム | LAUNCH DECK直後へ移設し「通信ターミナル」に改題（REM-04） |
| HUD `SECTORS` のch-comm行 / navのCOMMリンク | ナビ/HUD | 削除・詰め（章番号はE3で最終化するため、本フェーズは行削除のみ） |

### テスト改訂
| ファイル | 改訂 |
|---|---|
| tests/phase1.js | AUD-01のAPI表面から`beatOsc`除去。AUD-08(sync音)はガイド転用のため存置 |
| tests/phase4.js | SIG-02/02b/03/04/04b の5件を削除（BG/PRF/REG系は維持） |
| tests/phaseB.js | COMM章のC-01/C-02系を削除。章数チェックは4→3+briefing に追従 |
| tests/phaseC.js | 実通信位置チェックを「LAUNCH DECK直後」へ変更、deck-contact系を削除 |
| tests/phaseD.js | 変更なし（構造チェックのみ） |
| tests/run-all.js | 変更なし（各ファイルの内部改訂で吸収） |

### 文書改訂
- README: SIGNAL TUNERの節・操作表・章構成行を削除、ASTEROID RUN単独に
- DESIGN.md: §5-2冒頭に「**撤去済み(2026-07-20 SPEC-08)**」注記（本文はスナップショット残置）
- specs/00: SPEC-06等に撤去注記、状態表更新

## 3. 受け入れ基準

| AC | 内容 |
|---|---|
| AC-01 | `SignalGame`・`beatOsc`・`wave-canvas`・SIGNAL系CTA/文言がindex.htmlに存在しない（grep検証） |
| AC-02 | heroがEXPLORE単独CTA、LAUNCH DECKがASTEROID RUN単独ベイ+早見表1枚 |
| AC-03 | 通信ターミナル(フォーム)がLAUNCH DECK直後で機能する（送信演出含む） |
| AC-04 | 改訂後の run-all が全グリーン（ASTEROID RUN系テストは全件無変更で維持） |
| AC-05 | コンソールエラー0・configの参照切れ(未定義変数)なし |

## 4. リスク

- `closeLayer`等の共通基盤は両ゲーム前提の分岐を含む — 削除は「signal分岐の除去」に留め、
  レイヤー機構自体は温存（将来ゲーム追加の余地）
- FRAGS等SIGNAL専用定数の削除漏れ → AC-01のgrepリスト（signal|Signal|SIGNAL|beatOsc|wave-canvas|glock|FRAGS|vg-sig|tf, ta参照）で機械検証
