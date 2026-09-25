# SPEC 13a — K1: 操縦席の物理部品（計器台・キャノピー・操縦桿・スピードメーター・投影レーダー）

状態: **Verified（2026-09-26 phaseK1 12/12・run-all 22スイート344テスト ALL GREEN）** ／ 親: [SPEC-13](13-cockpit-holo.md) ／ 計画: [13-implementation-plan.md](13-implementation-plan.md) ／ テスト: `tests/phaseK1.js`

## 1. 範囲

- 旧操縦席（ダッシュ・トリム・右寄せの操縦桿・スロットルレバー・計器 3 面・ベゼル・`drawDash()`）を撤去し、物理部品に置き換える
- 対象要件: K-R01（物理部品）/ K-R02 / K-R03 / K-R04 / K-R05 / K-R13 / K-R14 / K-R15 / K-R16
- **K1 の間は左上の DOM HUD を従来どおり表示する**（シールド・コア等の表示先であった右の計器がなくなるため。K2 でホログラムに移してから隠す）

## 2. 現状の実測（2026-09-26・PC 1280 幅・操縦席視点）

| 指標 | 値 |
|---|---|
| 全体の draw call | 104（上限 155 = PC L0 の影込み） |
| 操縦席のメッシュ / 三角形 | 20 / 7,236 |
| 操縦席の不透明部品の占有率（16:9・FOV 72°） | **21.6%** |
| 中央域（NDC x∈[-.55,.55], y∈[-.35,.75]）の不透明部品 | 0 画素 |
| 輝度プローブ（操縦席） | mean .0643 / blown 0% / rockMean .3238 / rockCrushed 3.91%（基準 mean .0827・rockMean .214） |

## 3. 定数（`AsteroidRun` 内 `const CK`）

```js
const CK = {
  dash:   {r0: 1.05, r1: 1.25, h: .4, y: -.78, arc: 2.1, topY: -.58, topIn: .74},
  bow:    {r: 3.0, tube: .03, y: -1.0, z: -1.95, arc: 2.9},   // 実装時に 2.05 → 3.0(§8)
  glass:  {r: 2.3, y: -.2, phi: [Math.PI*1.5 - 1.5, 3.0], theta: [.25, 1.6], grid: [18, 9]},
  stick:  {pos: [0, -.76, -.55], scale: 1.3, kx: .45, kz: .5, trigger: .08},
  meter:  {pos: [-.44, -.51, -.9], rot: [-.35, .32, 0], scale: IS_TOUCH ? 1.0 : .8, canvas: [540, 300], plane: [.54, .3]},   // §8
  radar:  {pos: [.46, -.47, -.92], rot: [-1.0, 0, -.25], size: .36, canvas: 256},
  glowK: 1.6,   // 発光線の HDR 倍率(ブルームは掛かるが白飛びしない上限)
};
```

## 4. 部品の設計

### 4.1 材質（すべて `S.environment` の環境反射を受ける）

| 名前 | 種類 | 値 |
|---|---|---|
| `mDash` | Standard | color 0x121821・metalness .72・roughness .36・envMapIntensity .9・DoubleSide |
| `mFrame` | Standard | color 0x1a202a・metalness .85・roughness .28・envMapIntensity 1.1 |
| `mGrip` | Standard | color 0x2c333e・metalness .35・roughness .5・envMapIntensity .9 |
| `mRubber` | Standard | color 0x0d0f13・metalness .2・roughness .82 |
| `mMetal` | Standard | color 0x8d96a3・metalness .9・roughness .3・envMapIntensity 1.2 |
| `mGlow` | Basic | color = 状態色 × `CK.glowK`（K1 では常にシアン。K2 で状態色に連動） |
| `mRed` | Basic | 0xff3b5c × 1.8（発射ボタン） |
| `mGlass` | Shader | フレネル `pow(1-|n·v|, 3)*.35` ＋ 格子 `smoothstep(.49,.5,max(|fract(uv*grid)-.5|))*.05`、加算・depthWrite false・BackSide |

### 4.2 計器台（K-01）

- 側面: `CylinderGeometry(r0, r1, h, 72, 1, true, π-arc/2, arc)` を y=-.78
- 上面: `RingGeometry(topIn, r0, 72, 1, π/2-arc/2, arc)` を水平に回して y=-.58
- 発光線: `TorusGeometry(topIn+.01, .004, 6, 120, arc)` を上面の内縁に（`mGlow`）
- 装飾（CPT-01/03/04 の継承）:
  - グリーブル 12 個: 上面の外周（半径 .95〜1.02）で、角度 ±(.55〜.95) rad に左右 6 個ずつ（中央域の外）。材質ごとに `Assets.mergeGeo` で 2 メッシュに結合
  - ランプ 3 個: 上面の外周、角度 -.15 / .12 / .25 rad（非同期の位相は現行と同じ `userData.ph` 0 / 1.3 / 2.6）
  - 非常灯: 赤ランプ（メーター筐体の右下）＋ `PointLight(0xff2040, 0, 4.5, 2)` を (0,-.6,-.9)。明滅の式は現行の `stepVisual` をそのまま使う
- 室内灯: 現行の `PointLight(0x00f0ff, 3, 5, 2)` を (0,-.4,-1) に残す

### 4.3 キャノピー（K-02）

- 枠: `TorusGeometry(2.05, .03, 10, 96, 2.9)` を z 軸回りに `π/2-1.45` 回して (0,-1,-1.95)（`mFrame`）
- ガラス: `SphereGeometry(2.3, 48, 32, phi0, phiLen, theta0, thetaLen)` を y=-.2（`mGlass`）

### 4.4 操縦桿（K-03）

- 構成（支点グループ `stickPivot` → 本体 `stickBody`（倍率 1.3））:
  - ブーツ: `CylinderGeometry(.04, .09, .1)`（`mRubber`）・シャフト: `CylinderGeometry(.013, .017, .1)`（`mMetal`）・根元リング（`mGlow`）
  - グリップ: `LatheGeometry`（輪郭 14 点: 指のくびれ 3 つ・上部の台座）を z 方向 1.25 倍、前傾 -.18 rad（`mGrip`）
  - 親指台座: 横向きカプセル・ハットスイッチ（金属＋`mGlow` の先端）・発射ボタン（`mRed`）・トリガー（`mMetal`）
  - **メッシュは材質ごとに結合し 6 個以内**（トリガーだけは動かすため別メッシュ）
- 傾き（毎フレーム・操縦席視点）: `stickPivot.rotation.x = sm.y*CK.stick.kx`、`stickPivot.rotation.z = -sm.x*CK.stick.kz`（現行と同じ対応・同じ慣性 `sm`）
- トリガー: `fire()` で `cptFx.triggerT = CK.stick.trigger`。ループで `trigger.rotation.x = base + (triggerT > 0 ? .35 : 0)`、`triggerT -= dt`

### 4.5 スピードメーター（K-04）

- 筐体: アーチ形 `Shape`（幅 .6・半円の上端）を `ExtrudeGeometry(depth .05, bevel .012)`（`mFrame`）
- 画面: キャンバス 540×300 の板 .54×.3（`MeshBasicMaterial`・toneMapped・加算しない）＋前面ガラス（Standard・metalness .9・roughness .05・opacity .12）
- 描画 `drawMeter(ctx)`（`k = min(1, speed/SPD_MAX)`・`max = speed >= SPD_MAX`）:

| 要素 | 仕様 |
|---|---|
| 背景 | 半円 `#02070c` |
| 弧 | 中心 (270, 278)・半径 218・開始 1.08π・振り 0.84π。背景トラック（白 .07）→ レッドゾーン（上位 14%・赤 .45）→ 進捗（状態色・`max` 時は `#ff2ec4`） |
| 目盛り | 13 本（3 本ごとに長い） |
| 指針 | 半径 123〜214 の短い線（数字に掛からない） |
| デジタル値 | `max` なら `MAX`、それ以外 `floor(speed*4)`。**58px**・白・中心 (270, 214) |
| ラベル | `km/s`（**30px**・状態色）・`THR nn%`（**30px**・琥珀、`nn = round(speed/SPD_MAX*100)`） |

- 再描画: 2 フレームごと、キー `${digits}|${stateIdx}|${glitch}` が変わった時だけ（K-R15）

### 4.6 投影レーダー（K-05）

- 板 .36×.36・キャンバス 256×256・加算合成・depthWrite false。投影器（小さな金属の台座・`mFrame`）を板の下に置く
- 描画: 扇形（中心下端・半径 3 本）、岩は `dz > -170` で状態色の強調色（通常はマゼンタ `#ff2ec4`、現行と同じ）、それ以外は薄い白、コアは `#7dffec`。
  スケールは現行の `dx/130`・`dz/520` を扇形に写す。4 フレームごとに再描画（位置は毎回変わるためキー判定なし）

### 4.7 撤去と置き換え

- 削除: `stick`（旧）・`lever`・`dcv/dctx/dtex`・`panelBase()`・`drawDash()`・旧グリーブル座標表・ベゼル
- ループの `stick.rotation... / lever.rotation...` と `if(view === 'cockpit' && frame%4 === 0) drawDash()` を `updateCockpit(dt, now)` に置き換え
- 被弾グリッチ（FX-06）: `updateCockpit` 内で `now < glitchUntil` の間、メーター・レーダーのキャンバスに現行と同じ帯ノイズを加える（CRITICAL 時は赤系）

### 4.8 デバッグ API（`debug().ck`）

```js
ck: {
  parts: {dash, bow, glass, stickPivot, trigger, meter, radar},   // 存在確認用
  legacy: {lever: !!lever, panels: dtex ? dtex.length : 0},        // 旧部品の不在確認
  stick: ()=>({x: stickPivot.rotation.x, z: stickPivot.rotation.z, trigger: triggerT}),
  meter: ()=>({text, frac, thr, max}),                             // 最後に描いた内容
  mask: (fov = 72, w = 1024, h = 576)=>({coverPct, centerPx, stickNdcX}),   // 不透明部品のマスク
  redraws: {meter: 0, radar: 0},
}
```

`mask()`: 操縦席の不透明メッシュ（加算以外）だけを白で、他を非表示で描き、占有率と中央域の画素数、操縦桿の見かけの中心 x を返す（`rockMask` と同じ方式）。

## 5. 受け入れテスト（tests/phaseK1.js）

| ID | 手順 | 合格条件 |
|---|---|---|
| K1-T01 | 起動 → `ck.parts` / `ck.legacy` | 7 部品が存在・`lever=false`・`panels=0` |
| K1-T02 | `ck.mask(72)` と `ck.mask(84)` | 両方で `centerPx === 0` |
| K1-T03 | `ck.mask(72)` | `coverPct <= 21.6` |
| K1-T04 | `mask().stickNdcX` | \|x\| ≤ .08 |
| K1-T05 | `mt=(1,0)` と `(0,1)` で 60 フレーム進める | `z < 0` かつ \|z\| ≈ .5±.05 / `x > 0` かつ ≈ .45±.05（`sm.y` 正=下入力。符号は現行と同じ） |
| K1-T06 | コア 1 以上で `fire()` → 40ms 後 → 120ms 後 | 40ms でトリガー角 > 基準、120ms で基準に戻る |
| K1-T07 | 速度 110 / 300 / 480 で描画 | 表示 `440`/`1200`/`MAX`、`frac` = speed/480、`thr` = 23/63/100 |
| K1-T08 | CON-05（F2-T05/T06 と同条件） | 色 0x00f0ff・不透明度 .12・加算・黒背景の画素 (0,126,134)±3 |
| K1-T09 | 材質の走査・`lookProbe('cockpit')` | 金属系の `envMapIntensity > 0` かつ metalness ≥ .7（計器台・枠・金属）／ blown ≤ .1%・rockMean ≥ .214×.9・mean ≥ .0827×.5 |
| K1-T10 | draw call・三角形・再描画 | 全体 ≤ 155（SP 140）／ 操縦席のメッシュ ≤ 24・三角形 ≤ 12,000 ／ 速度一定で 60 フレーム → `redraws.meter ≤ 1` |

## 6. 既存テストの改訂

| 既存 | 改訂 |
|---|---|
| phase3 CPT-02「ベゼル ≥3」 | `cptFx.bezels` を「筐体数」（メーター筐体・レーダー投影器・操縦桿の台座 = 3）として維持。テスト名を「CPT-02 筐体/ベゼル」に |
| phase3 CPT-01 / 03 / 04 | 変更なし（新しい計器台の上で満たす） |
| F2-T08・F4-T08・F6-T11 の操縦席の基準 | 変更なし（判定は下限・上限のみで、K1-T09 と同じ条件を満たすため）。満たさない場合は原因を直す（基準は動かさない） |

## 7. リスク

| リスク | 対策 |
|---|---|
| 計器台の発光線・ハットスイッチのブルームで白飛び | `glowK = 1.6`（ACES 後 .85 程度）。K1-T09 で確認 |
| 操縦桿が回避時に視界に入りすぎる | 傾きは現行と同じ係数。中央域の検査（K1-T02）は傾けた状態（入力 ±1）でも実施 |
| 既存の輝度・予算テストの崩れ | 旧 20 メッシュを撤去して新 ≤24。draw call は +4 以内の見込み |

## 8. 実装時の判断

- **キャノピー枠**: 半径 2.05 の弧は画面上部の中央域（K-R02）の角を横切った（FOV 72° で 9,096 画素）。
  頭上を越える半径 3.0 に広げ、枠は左右の側枠として見える形にした（FOV 84° でも中央域 0 画素）
- **スピードメーター**: 上端が FOV 84°（最高速）で中央域に入ったため、倍率 .95 → .8・高さ -.47 → -.51・傾き -.3 → -.35・奥行き -1.0 → -.9。
  筐体の下端は計器台に埋め込み、画面（文字）は筐体内で .04 上げて計器台に隠れないようにした。ラベルは 26 → 30px（実寸 10px 以上を保つため）。
  SP の倍率は 1.3 → 1.0（中央域の制約のため。文字の実寸は K3 で検証）
- **メーターの画面**: 筐体の面取りと同じ奥行き（z .012）で Z ファイティングしたため、画面 .026・ガラス .04 に
- **グリーブル**: 当初の寸法（幅 .07〜.1）は計器台の右下で平たいパネルの模様に見えたため、幅 .035〜.05・高さ .012 に縮め、角度 ±(.72〜1.07) の外側へ
- **投影レーダー**: 板の下端が計器台に食い込んだため高さ -.5 → -.47。投影器を小さく（半径 .028）
- **室内灯**: 計器台の上面が青く光りすぎたため強度 3 → 1.6
- 実測（PC 1280 幅）: 占有率 **11.1%**（旧 21.6%）・中央域 0 画素（72° / 84° / 操縦桿を最大に傾けた状態）・draw call 115〜120・操縦席のメッシュ 23・三角形 11,020・白飛び 0%
