# SPEC 06 — 背景・SIGNAL演出・性能自動調整（Phase 4）

状態: **Verified (2026-07-20 テスト19/19・Phase1〜3回帰全グリーン・SIGNAL演出目視確認)** ／ 外部素材: **不要**

## 1. 目的

ゲーム空間の奥行き（遠景）と SIGNAL TUNER の演出を仕上げ、
全SPECの負荷を束ねる性能自動調整(adaptive quality)で品質と安定性を両立する。

## 2. 要件

### ASTEROID RUN 背景
| ID | 要件 |
|---|---|
| BG-01 | 遠景に大型惑星(半球見え、リング付き)を1基配置し、進行方向のランドマークにする |
| BG-02 | 微細な塵レイヤー(Points 600粒)を追加し、速度に応じて流れて速度感を強調する |
| BG-03 | 背景要素は霧(FogExp2)と整合し、既存スピードラインと視覚的に喧嘩しない |
| BG-04 | 背景の追加 draw call は +4 以内 |

### SIGNAL TUNER
| ID | 要件 |
|---|---|
| SIG-01 | 波形の発光表現を強化する(既存shadowBlurの多層化 or オフスクリーン合成) |
| SIG-02 | チャンネル確立の瞬間、画面全体に同心円パルス+一瞬の色反転を出す(祝祭感) |
| SIG-03 | 背景に微細なCRT走査線と周辺減光を加える(判読性は維持) |
| SIG-04 | 5ch達成時の解読完了演出を強化する(文字が1文字ずつ確定するデコード表示) |
| SIG-05 | reduced-motion時はパルス/色反転を省略する(CON-06) |

### 性能自動調整（全SPEC横断）
| ID | 要件 |
|---|---|
| PRF-01 | ゲーム中のフレーム時間を移動平均(60frame)で常時計測する |
| PRF-02 | 予算超過(PC>12ms/SP>20msが3秒継続)で品質を1段階下げる。段階: ①ブルーム解像度↓ ②破片/塵50%↓ ③ブルームOFF |
| PRF-03 | 品質段階の変更はプレイ中に視覚的ショックなく適用する(フレード等は不要、即時でよいが1段階/3秒まで) |
| PRF-04 | 現在の品質段階をコンソールログで確認できる(デバッグ用、UIには出さない) |
| PRF-05 | 一度下げた品質はそのゲームセッション中は戻さない(振動防止) |

## 3. 技術設計

### 3.1 遠景惑星（BG-01、`build()`）

- `SphereGeometry(140, 24, 24)` を z=-1400, y=-60 に固定配置(カメラ非追従・fog対象外に
  `material.fog=false`)。メインページの惑星マテリアル思想(フレネル大気)を簡略移植
- リング: `RingGeometry(180, 260)` 半透明。ゲーム進行で `rotation.z` を極低速回転
- 色はテーマのバイオレット系(#7b5cff基調)でHUDシアンと差別化(BG-03)

### 3.2 塵レイヤー（BG-02、`loop()`）

- `BufferGeometry` 600頂点、size 0.6、opacity .35。z範囲[-50,-900]をラップ移動
  (`z += speed*dt*0.6; z>0 で -900へ`)。既存スピードライン(280本)より遅い層速度で視差を作る
- SPは300粒(PRF連携で150まで縮退可)

### 3.3 SIGNAL演出（SIG-01〜04、SignalGameの`loop()`/`end()`）

- 発光強化: 波形を2回描画(1回目: lineWidth 6, alpha .25 / 2回目: 既存)。shadowBlur依存を減らし負荷安定
- パルス(SIG-02): チャンネル確立時 `pulses.push({t0})`、以降0.6秒間、確立点中心の
  同心円3本をalpha減衰で描画。同フレームで `ctx.filter='invert(1)'` は使わず、
  全画面に白の低alpha矩形1フレーム(擬似フラッシュ)で代替(負荷とSafari互換のため)
- CRT(SIG-03): 事前生成の走査線パターンCanvas(4px縦周期)を `createPattern` で全面alpha .05描画
  + 周辺減光は radialGradient を1枚重ね
- デコード表示(SIG-04): `end(win)` の全文表示を、1文字20ms間隔でランダム文字→確定文字に
  遷移するタイプライタ演出に置換(既存の断片演出と整合)

### 3.4 adaptive quality（PRF-01〜05）

```js
const Quality = (()=>{
  let level = 0;               // 0=full,1=bloomHalf,2=fxHalf,3=bloomOff
  let acc = 0, over = 0;
  function frame(ms){ /* 移動平均+超過秒数カウント→degrade() */ }
  function degrade(){ level++; apply(); console.info('[Quality] level', level); }
  function apply(){ /* SPEC-02のRES/strength, SPEC-04の破片数, BG-02の塵数へ反映 */ }
  function reset(){ level = IS_TOUCH ? 1 : 0; }   // SPは1始まり(既定で半解像度)
  return {frame, reset, get level(){return level}};
})();
```
- `AsteroidRun.loop()` 冒頭で `Quality.frame(frameMs)`。`start()` で `reset()`(PRF-05は
  セッション内不可逆、リトライで再評価)

## 4. 受け入れ基準（AC）

| AC | 内容 | 対応要件 |
|---|---|---|
| AC-01 | 遠景惑星が進行方向に見え、近景の回避プレイを妨げない | BG-01,03 |
| AC-02 | 低速と最高速で塵の流速差により速度感が増して感じられる(主観確認+動画) | BG-02 |
| AC-03 | チャンネル確立の瞬間が「決まった」と分かる演出になっている | SIG-02 |
| AC-04 | 5ch達成時にデコード演出が再生され、既読性を損なわない | SIG-04 |
| AC-05 | 人工的にCPU負荷をかける(DevTools throttle)と品質段階が下がりfpsが回復、コンソールに段階ログ | PRF-01〜04 |
| AC-06 | 同一セッション中に品質が上下に振動しない | PRF-05 |
| AC-07 | reduced-motionでパルス/色反転が出ない | SIG-05 |

## 5. リスク・備考

- 2D Canvas側(SIGNAL)の shadowBlur はSafariで高負荷 → SIG-01の二重描画方式を既定にし、
  shadowBlurは半減方向で調整
- 遠景惑星はAfterimage残像で尾を引く可能性 → 固定配置(画面内移動が小さい)のため実害は
  軽微と想定。目立つ場合は惑星のみ残像対象外にする構成(別シーン合成)を検討
