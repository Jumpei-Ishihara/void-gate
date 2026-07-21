# SPEC 08b — Phase E2: Sortieレイヤー＋タイムワープ＋フリーズビート章（02〜04）

状態: **Verified (2026-07-20 phaseE2 14/14・run-all 139テスト ALL GREEN。凍結中はgT()でカメラ/機体のグローバル時間も平坦化する設計に発展)** ／ 親: [SPEC-08](08-action-sequence.md) ／ 前提: 08a Verified ／ 外部素材: 不要

## 1. 目的

連続飛行の主役機体（Sortieレイヤー）とフリーズ機構（warp写像）を導入し、
FLIGHT/WEAPONS/SURVIVALの3章を「アクション→凍結→説明→解除→結末」の5拍構成に置換する。

## 2. 要件

| ID | 要件 |
|---|---|
| E2-01 | `warp(tl, f0, f1)` / `freeze(tl, f0, f1)` / `fzDepth(tl, f0, f1)`（端でイーズする凍結深度0〜1）をGuideに実装し、単体で数値検証可能にする |
| E2-02 | Sortieレイヤー: 機体1機（Assets.buildShip）+共通岩帯（岩26個をワールド固定配置で回廊状に）+速度連動排気。機体位置はグローバルtの純関数 `shipAt(t)`（キーフレーム`SHIP[]`補間） |
| E2-03 | 機体はGATE〜LAUNCH DECKまで連続表示（章境界で消えない）。旧章別機体/岩は廃止 |
| E2-04 | 章02/03/04を5拍構成に置換。イベント道具（大岩・コア・標的岩・トレーサー・爆発・シールド膜・火花）は各章の`SHIP`イベント点に相対配置し、taの純関数で駆動 |
| E2-05 | フリーズ演出: `#space`のCSS filter減彩(fz連動)・`⏸ TIME HOLD`バッジ・hold/解除音のエッジ発音 |
| E2-06 | テキスト行のdata-on閾値をFZ区間内に再割当（凍結中に読み切れる） |
| E2-07 | カメラ: フリーズ中はイベント注視アングルへfz補間で寄る（CAM基準+オフセット）。逆スクロールで完全逆再生 |
| E2-08 | 旧briefing章はSORTIE章のプレースホルダに改称（本実装はE3。ホログラムは廃止し岩帯遠景のみ） |
| E2-09 | ゲーム回帰全グリーン+新規テスト（§4） |

## 3. 技術設計

### 3.1 warp / 凍結深度（E2-01）

```js
function warp(tl, f0, f1){
  if(tl <= f0) return tl;
  if(tl <= f1) return f0;
  return f0 + (tl - f1)/(1 - f1)*(1 - f0);
}
const freeze  = (tl, f0, f1)=>tl > f0 && tl < f1;
function fzDepth(tl, f0, f1){                       // 凍結深度: 端0.06幅でイーズ
  if(tl <= f0 || tl >= f1) return 0;
  const inE = Math.min(1, (tl - f0)/.06), outE = Math.min(1, (f1 - tl)/.06);
  return Math.min(inE, outE);
}
```

章パラメータ（08-D絵コンテ準拠）: FLIGHT{f0:.42,f1:.78} / WEAPONS{f0:.50,f1:.80} / SURVIVAL{f0:.45,f1:.80}

### 3.2 Sortieレイヤー（E2-02/03）

```js
// キーフレーム: 機体のカメラ相対オフセット+姿勢(グローバルt)
const SHIP = [
  {t:0,   x:0,   y:-1.2, dz:-14, roll:0,  vis:0},    // GATE: シルエット(E3で使用)
  {t:t01, x:0,   y:-1.0, dz:-16, roll:0,  vis:1},    // SORTIE射出
  {t:tF-, x:1.8, y:-.6,  dz:-15, roll:-.7},          // FLIGHT回避バンク(イベント点)
  {t:tW-, x:0,   y:-.9,  dz:-14, roll:0},            // WEAPONS照準
  {t:tS-, x:-.6, y:-.7,  dz:-12, roll:.3},           // SURVIVAL接触
  {t:1,   x:0,   y:-1.1, dz:-16, roll:0}];
// 実t値は章のDOM実測(t0/t1)から毎measure時に再計算して埋める(イベント点=章のf0位置)
function shipAt(t){ /* CAM同様の区間補間。位置=camAt(t)+オフセット */ }
```

- 岩帯: 26個をカメラ回廊（z: GATE〜DECKのcam範囲+前後余白）に乱数固定配置(seed付き)。
  各岩は自転のみtl非依存の…ではなく **回転もグローバルtの純関数**（rot = base + t*spin）
- 機体の微追従（ACT-06）: `x += mouse.x*.8` を加算（フリーズ中は係数*(1-fz)で凍結）

### 3.3 章イベントの構成（E2-04 — 代表: SURVIVAL）

```js
// イベント点 P = shipAt(tEvent).worldPos を基準に配置
crashRock:  P前方2.2に大岩(接触姿勢で固定)
shieldFilm: 機体前面の青い光膜(PlaneGeometry湾曲+加算) — ta<.45透明, 接触で発光
sparks:     接触点の火花8粒 — 凍結フレームでは初速方向に短く伸びて静止(ta停止で自動)
cracks:     光膜上の亀裂ライン3本 — ta .43〜.45で伸長、凍結中は静止
結末(ta .8〜1): 光膜が砕片化して散り、#ch4-vign赤警告→点滅→復帰
```

WEAPONS: トレーサー先端位置 = f(ta)、閃光スプライトはta .49で発生し凍結（scale固定）。
解除後 ta .8〜1で三層爆発（07b実装を転用し、時間軸をtaに差替え）。
FLIGHT: 大岩の接近スケール = f(ta)、交差点で凍結（岩が画面左半分を占める配置を数値指定）。

### 3.4 フリーズ演出の集約（E2-05）

- `Guide.update`で全章の `fz` を集計し最大値を採用 → `#space.style.filter` と
  `#time-hold` バッジ表示を1箇所で駆動（章間の競合を防ぐ）
- hold音: `SoundEngine.ui('hold')` 新設（220Hz sine 300ms, gain .25）
- エッジ検出: f0上向き=hold音 / f1上向き=sync音+結末SE（既存B-06パターン）

## 4. テスト計画（tests/phaseE2.js）

- warp/fzDepth単体: 代表6点の期待値表
- 機体連続性: t=.1/.3/.5/.7/.9 すべてでSortie機体がvisible・単一インスタンス
- 各章: 凍結中(ta停止)の静止検証 — FZ内の2点でイベント道具の座標が完全一致
- 凍結中の行点灯 / FZ外で未点灯
- f0/f1エッジ音（hold→sync）が上向きのみ発音
- 逆スクロール決定性（凍結跨ぎで往復）
- 減彩フィルタ: FZ中 `#space` filterにsaturateが入る / FZ外は空
- 回帰: ゲームphase1〜4 + phaseA（Tl/Assets）+ 改訂後B/C/D

## 5. リスク

- 機体がカメラ相対で常時前方にいるため、章イベント道具との位置合わせはmeasure()時に
  イベントtを再計算して従属配置する（レイアウト変更に自動追従 — 07bと同じ思想）
- FLIGHT章の「岩が画面左半分」はFOV依存 → 実機レビューで数値調整前提の定数化
