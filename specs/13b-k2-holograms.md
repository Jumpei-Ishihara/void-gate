# SPEC 13b — K2: ホログラム・状態色・警告・DOM HUD の一本化

状態: **Draft** ／ 親: [SPEC-13](13-cockpit-holo.md) ／ 前提: K1（[13a](13a-k1-cockpit-hardware.md)）Verified ／ テスト: `tests/phaseK2.js`

## 1. 範囲

- キャノピー面のホログラム（シールド・武装・上帯）、状態色、危険時の警告（中央の文字・視界の縁）
- 操縦席視点での DOM HUD 数値行の非表示、加点ポップの位置確認
- 対象要件: K-R01（ホログラム）/ K-R06 / K-R07 / K-R08 / K-R11（PC）/ K-R14 / K-R15

## 2. 共通部品 `holoPanel`

```js
// w,h: ワールド寸法 / cw,ch: キャンバス寸法(SP は ×CANVAS_Q) / draw(ctx, cw, ch) / key(): 再描画判定の文字列
function holoPanel({w, h, cw, ch, draw, key, fonts, additive = true}){
  → {mesh, ctx, tex, redraw(force), lastKey, fonts, redraws, bootAt}
}
const CANVAS_Q = IS_TOUCH ? .6 : 1;   // SP はキャンバス解像度を下げる(K-R15)
```

- 材質: `MeshBasicMaterial({map, transparent, blending: Additive, depthWrite: false, toneMapped: true})`
- `redraw(force)`: `key()` が前回と同じなら何もしない。変わった時だけ `ctx.clearRect → draw → tex.needsUpdate`
- 走査線とちらつき: 描画後に 3px 間隔の横線（α .06）を重ねる。ちらつきは `material.opacity = .92 + .08*sin(now/53+ph)`（`REDUCED` 時は 1 固定）
- **HDR 上限**: ホログラムの文字色は `gain ≤ 1.6`（白でも ACES 後 .88 程度）。白飛び判定（Y > .98）に掛からない
- `fonts`: `{digits: px, numbers: px, labels: px}`（文字の実寸テスト K3-T05 に使う）

## 3. 状態色

```js
const STATE_COL = ['#00f0ff', '#ffb347', '#ff3b5c'];   // 通常 / シールド1 / シールド0
const stateIdx = ()=>st.shields <= 0 ? 2 : st.shields === 1 ? 1 : 0;
```

`updateCockpit` で `stateIdx` が変わった時に: 計器台の発光線・根元リング・ハットスイッチの `mGlow.color = 状態色×glowK`、全パネルの `redraw(true)`。
コンボ倍率の色はマゼンタ `#ff2ec4`、`NO CORE` は赤 `#ff3b5c`（状態に関わらず）。

## 4. パネル仕様

| パネル | 位置（カメラ座標）・寸法 | キャンバス | 内容 | キー | フォント |
|---|---|---|---|---|---|
| シールド | (-.8,-.1,-2.3)・y 回転 .22・.62×.62 | 300×300 | 3 分割の弧（残り枚数ぶん状態色・他は白 .08）、中央に `SHIELD` / `CRITICAL` | `shields|state` | labels 26 |
| 武装 | (.8,-.1,-2.3)・y 回転 -.22・.62×.62 | 300×300 | 枠付きウィンドウ（見出し帯 `ARM`）、`◆ n`（残コア）、`CORE`、`NO CORE`（撃てない 0.6 秒間）、`×n.n`（倍率 >1）、`AUTO LOCK` / `MANUAL` | `cores|noCore|mult|lockMode|state` | numbers 34・labels 26 |
| 上帯 | (0,.66,-2.3)・1.5×.18 | 900×108 | 流れる目盛り、`Snn · セクター名`（中央）、スコア（右）、距離 `nnn Mkm`（左） | `sector|score|floor(dist)|state`（目盛りは 4 フレームごとに流す） | numbers 36・labels 30 |
| 警告文字 | (0,.3,-2.3)・1.6×.2 | 800×100 | `⚠  SHIELD CRITICAL`（40px・赤） | 静的（1 回だけ描く） | labels 40 |
| 視界の縁 | (0,0,-2.6)・7.2×4.1 | 360×205 | 放射グラデーション（中心透明 → 縁 赤） | 静的（1 回だけ描く） | — |

- **警告の明滅**: シールド 0 の間だけ `visible = true`。文字は `opacity = .55 + .45*sin(now/111)`、縁は `opacity = .16 + .12*sin(now/111)`（1.2 秒周期より速い警告のリズム）。
  `REDUCED` 時は文字 1・縁 .22 の常時表示（CON-06）。明滅はキャンバスを描き直さず `opacity` だけで行う（K-R15）
- 被弾グリッチ（FX-06）: 全ホログラムにも K1 と同じ帯ノイズ（`redraw(true)` の後に重ねる）

## 5. DOM HUD の一本化

- CSS 追加: `#game-layer.cockpit #game-hud .ghud-row{display:none}`（`hud()` は変更しない。テキストは生成され続けるため F5-T08・F3-T09 は不変）
- ボタン（VIEW / LOCK / SOUND、SP の ♪）は表示を続ける。位置は左上のまま（数値行がなくなりボタンだけが縦に並ぶ）
- 加点ポップ `#g-pop`: 操縦席の `bottom: 36%` のままとし、メーター上端（NDC 約 -.45 = 下から 27.5%）より上にあることをテストで確認

## 6. 情報の対応表（K-R06）

| 情報 | 表示先 |
|---|---|
| 速度 | メーター（K1） |
| シールド | シールドパネル（＋危険時の警告） |
| 残コア・NO CORE | 武装パネル |
| コンボ倍率 | 武装パネル |
| ロック状態 | 武装パネル（AUTO LOCK / MANUAL）＋ ロック札（K3） |
| セクター・スコア・距離 | 上帯 |

## 7. デバッグ API（`debug().ck` に追加）

```js
holos: {shield, arm, top, alert, edge},       // holoPanel
keys: ()=>({shield, arm, top, meter}),         // 各パネルの最新キー(= 描いた内容)
texts: ()=>({shield, arm, top}),               // 描いた文字列の配列(検証用に draw 内で記録)
stateColor: ()=>'#rrggbb',
```

## 8. 受け入れテスト（tests/phaseK2.js）

| ID | 手順 | 合格条件 |
|---|---|---|
| K2-T01 | 起動 → `ck.holos` | 5 パネルが存在し、すべて加算合成・depthWrite false・レティクルの材質（`retMat`）と別物 |
| K2-T02 | セクター 3・スコア 12,345・距離 678・コア 2・シールド 2・倍率 1.5・LOCK AUTO に設定し `redraw` | `texts()` に `S03`・セクター名・`12,345`・`678 Mkm`・`◆ 2`・`×1.5`・`AUTO LOCK`・`SHIELD` が含まれる（速度は K1-T07） |
| K2-T03 | 操縦席視点で `hud()` | `.ghud-row` の computed `display === 'none'`、`#g-view` 等のボタンは表示。追跡視点へ切替で `.ghud-row` 表示 |
| K2-T04 | シールド 3 / 1 / 0 | `stateColor()` と発光線の色が シアン / 琥珀 / 赤。各パネルのキーに状態が入り再描画される |
| K2-T05 | シールド 3 → 0 → 3 | 警告の文字・縁が 0 の時だけ visible |
| K2-T06 | `REDUCED` を擬似的に true にして 2 時刻で比較 | 警告の opacity が一定（明滅しない） |
| K2-T07 | 値を変えずに 60 フレーム | シールド・武装・上帯の `redraws` が増えない（上帯の目盛りは 4 フレームごとの流し分のみ） |
| K2-T08 | `lookProbe('cockpit')`（シールド 0 の警告表示中も） | blown ≤ .1%・rockMean ≥ .214×.9・mean ≥ .0827×.5 |
| K2-T09 | 加点ポップの矩形とメーターの投影矩形 | 交差しない（1280×720） |

## 9. 既存テストへの影響

- なし（DOM HUD はテキストが残る。輝度・予算・CON-05 は K1 と同じ条件で再確認）
- draw call: +5 パネル（K1 と合わせ操縦席 ≤ 30）
