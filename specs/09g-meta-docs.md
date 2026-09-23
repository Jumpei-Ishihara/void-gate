# SPEC 09g — Phase F7: 称号・デイリーシード・戦績共有・ドキュメント整合

状態: **Draft** ／ 親: [SPEC-09](09-realism-gameplay-policy.md) G5 ／ 前提: F3（シード付き生成・セクター）・F5（スコア内訳）Verified ／ 外部素材: 不要

## 1. 目的

2 回目・3 回目を遊ぶ理由を作る。オンラインサーバを使わず（オフライン方針）、端末内の記録と共有文面で成立させる。
最後に、F1〜F6 で変わった仕様をサイトの説明・README・DESIGN・specs に一括で揃える。

## 2. 要件

| ID | 要件 |
|---|---|
| F7-01 | **称号**: その回に到達したセクターで決定 — 1: CADET / 2–3: PILOT / 4: ACE / 5+: VOID RUNNER。結果画面に表示し、最高の称号を `vg-ast-rank` に保存 |
| F7-02 | LAUNCH DECK の BEST 表示に称号を併記（例: `BEST 12,340 · ACE`）。記録なしは現行どおり `NO RECORD` |
| F7-03 | **デイリーシード**: 起動メニューにコース選択 `RANDOM // 通常` / `DAILY // 本日のコース` を追加。DAILY のシード = 日付文字列（端末のローカル日付 YYYY-MM-DD）のハッシュ。同じ日付なら全員同じ配置 |
| F7-04 | DAILY の自己ベストは日付ごとに保存（`vg-ast-daily-YYYYMMDD`）。7 日より古いキーは起動時に削除 |
| F7-05 | 戦績履歴: 上位 5 件（スコア・称号・セクター・日付・コース種別）を `vg-ast-hist` に JSON で保存し、結果画面に表示 |
| F7-06 | **共有**: 結果画面の `SHARE` ボタン → 共有文面を作り、`navigator.share` があればそれで、無ければクリップボードへコピーして `COPIED` と表示。**自動送信はしない**（ユーザーの操作でのみ） |
| F7-07 | 共有文面: `VOID GATE // ASTEROID RUN — SCORE 12,340 / SECTOR 04 / ACE (DAILY 2026-09-23) https://jumpei-ishihara.github.io/void-gate/ #VOIDGATE` |
| F7-08 | SP の結果画面は横画面内に収まり、スクロールで全ボタンに届く（過去FBの SP モーダルの要件を継承） |
| F7-09 | **ドキュメント整合**: サイトの章（FLIGHT/WEAPONS/SURVIVAL/LAUNCH DECK）・ゲーム開始メニュー・README・DESIGN・specs/00 の要件表を、F1〜F7 の仕様に揃える。SPEC-09 系の状態を Verified に更新 |
| F7-10 | SEO: JSON-LD（VideoGame）の説明文をセクター制・スコア体系に合わせて更新（title/description は変更しない） |

## 3. 技術設計

```js
function dailySeed(d = new Date()){
  const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  let h = 2166136261; for(const ch of s){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }   // FNV-1a
  return {seed: h >>> 0, label: s};
}
const RANKS = [[5, 'VOID RUNNER'], [4, 'ACE'], [2, 'PILOT'], [1, 'CADET']];
const rankOf = sector => RANKS.find(([n])=>sector >= n)[1];
```

- localStorage の読み書きはすべて try/catch（プライベートモード等で例外になっても遊べる）
- 共有はユーザーのクリック時にのみ実行。文面に個人情報は含めない

## 4. 受け入れテスト（tests/phaseF7.js）

| テストID | 検証内容 |
|---|---|
| F7-T01 | `rankOf`: 1→CADET, 3→PILOT, 4→ACE, 6→VOID RUNNER |
| F7-T02 | 結果画面に称号、最高称号が保存され LAUNCH DECK に併記 |
| F7-T03 | `dailySeed` が同じ日付で同じ値・異なる日付で異なる値。DAILY で開始した 2 回のゲームの最初の 20 パターンが一致 |
| F7-T04 | DAILY のベストが日付キーで保存、8 日前のキーが起動時に削除 |
| F7-T05 | 履歴が 5 件を超えない・スコア降順 |
| F7-T06 | SHARE: `navigator.share` スタブあり → 呼ばれる / なし → クリップボードスタブに文面、`COPIED` 表示 |
| F7-T07 | 共有文面の書式（スコア・セクター・称号・URL を含む） |
| F7-T08 | localStorage が例外を投げる環境（スタブ）でもゲームが開始・終了できる |
| F7-T09 | SP 横画面（例: 812×375）で結果画面の全ボタンにスクロールで到達できる |
| F7-T10 | サイト本文・開始メニュー・README に旧仕様の文言（「速度は時間とともに上昇」のみの説明、旧スコア式）が残っていない |
| F7-T11 | JSON-LD の説明文にセクター制・スコア体系が記載され、既存の SEO テストが全合格 |

## 5. 完了条件（SPEC-09 全体）

- run-all 全スイート（既存 12 + F1〜F7 の 7 = 19 スイート）が全グリーン
- 本番（GitHub Pages）で PC / SP 横画面の通しプレイ確認
- `labs/lookdev.html` を最終状態の比較（F0 = 開始前 / F7 = 完了後）に更新し、before/after を残す
