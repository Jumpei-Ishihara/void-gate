# SPEC 01 — サウンドエンジン / SFX（Phase 1）

状態: **Verified (2026-07-20 自動テスト17/17内AUD系全パス・実機音出しはユーザー確認待ち)** ／ 外部素材: **不要**（全音Web Audio合成。任意アップグレードはSPEC-00 §4参照）

## 1. 目的

現状無音のASTEROID RUNに射撃・爆発・被弾・報酬・環境音を付与し、
SIGNAL TUNERの既存2オシレータも含めて**単一のサウンドエンジン**に統合する。

## 2. 要件

| ID | 要件 |
|---|---|
| AUD-01 | 共通モジュール `SoundEngine` を新設し、AudioContext・マスターゲイン・ミュートを一元管理する |
| AUD-02 | 初回のユーザー操作（クリック/タップ）でAudioContextを resume し、自動再生制限下でも確実に鳴る |
| AUD-03 | 機関砲SFX: 発射ごとに再生。連射(160ms間隔)でも音切れ・クリックノイズが出ない |
| AUD-04 | 爆発SFX: 破壊対象の半径に応じて音量・低域が変わる（大きい岩ほど重い音） |
| AUD-05 | 被弾SFX: 金属衝撃音＋短い警告ブザー。シールド0(CRITICAL)突入時は専用の強い警告音 |
| AUD-06 | コア取得SFX: 上昇3音アルペジオ（C5→E5→G5系）で報酬感を出す |
| AUD-07 | エンジンドローン: ゲーム中常時再生。ピッチとフィルタが速度(110→480)に連動する |
| AUD-08 | UI音: メニュー決定・ゲームオーバー表示・カウント系に短いUI音を付与 |
| AUD-09 | ミュート: ゲームHUDにSOUNDトグルを常設（両ゲーム共通・SPコンパクトHUDにも表示）。状態はlocalStorage保持 |
| AUD-10 | SIGNAL TUNERの既存うなり音は SoundEngine 管理下に移行し、挙動は現状維持 |
| AUD-11 | ゲーム終了(closeLayer)で全音を確実に停止・解放する（ページ側に音を残さない） |
| AUD-12 | 同時発音は最大8ボイス。超過時は最古のSFXボイスを打ち切る（ドローンは対象外） |

## 3. 技術設計

### 3.1 モジュール構造

`index.html` 内、`AsteroidRun` 定義の前に配置:

```js
const SoundEngine = (()=>{
  let ctx = null, master = null, muted = localStorage.getItem('vg-mute') === '1';
  const voices = new Set();          // 再生中SFXボイス(≤8)
  function ensure(){ /* ctx生成+resume。ユーザー操作起点で呼ぶ */ }
  function out(){ /* master(GainNode)を返す。muted時 gain=0 */ }
  // --- SFX API(全て fire-and-forget) ---
  function gun(){}                   // AUD-03
  function explosion(r){}            // AUD-04 r=岩半径
  function impact(critical){}        // AUD-05
  function coreGet(){}               // AUD-06
  function ui(kind){}                // AUD-08 kind: 'select'|'over'|'sync'
  // --- 持続音 ---
  function engineStart(){} function engineSpeed(v){} function engineStop(){}   // AUD-07
  function beatOsc(){/* SIGNAL用2osc生成を提供 */}                              // AUD-10
  function setMute(m){} function toggleMute(){}
  function stopAll(){}               // AUD-11
  return {ensure, gun, explosion, impact, coreGet, ui,
          engineStart, engineSpeed, engineStop, beatOsc,
          setMute, toggleMute, get muted(){return muted}, stopAll};
})();
```

### 3.2 各SFXの合成レシピ

| SFX | 合成 | エンベロープ | 長さ |
|---|---|---|---|
| gun | ホワイトノイズ(BufferSource)→BPF(1.8kHz,Q4) ＋ square osc 220→90Hz | A0/D80ms 指数減衰 | 90ms |
| explosion | ノイズ→LPF(400→80Hzスイープ) ＋ sine サブ(55Hz) | A5/D400〜700ms | r連動0.4〜0.8s |
| impact | 金属: 三角波2本(2.7k/3.1kHz,即減衰)＋ノイズ短打。critical時+矩形波警告(660Hz断続×3) | 120ms(+警告600ms) | |
| coreGet | sine 523→659→784Hz を60ms間隔で3連 | 各A5/D120ms | 300ms |
| engine | sawtooth 2本(デチューン±4cent)→LPF。速度で freq 55→110Hz / LPF 300→1400Hz | 常時、start/stopで200msフェード | — |
| ui.select | sine 880Hz 40ms | — | 40ms |
| ui.over | 下降 sawtooth 220→80Hz | D500ms | 500ms |
| ui.sync | sine 1046Hz + 1318Hz 同時 | D300ms | 300ms |

- 全ボイスは `GainNode` を個別に持ち、`exponentialRampToValueAtTime` で減衰
  （`setValueAtTime(0)`直切りによるクリックノイズ禁止）
- ノイズは起動時に1秒分の共有 `AudioBuffer` を1つ生成して使い回す

### 3.3 フック点（統合先）

| 呼び出し | フック先（関数名検索） |
|---|---|
| `SoundEngine.ensure()` | `openLayer()` 冒頭・`applyFSChoice()`（クリック起点） |
| `gun()` | `AsteroidRun.fire()` のトレーサー生成直後 |
| `explosion(r)` | `fire()` 内の命中分岐（`boom()` 呼び出し隣） |
| `impact(st.shields<=0)` | `hit()` 冒頭 |
| `coreGet()` | ループ内コア回収判定（`st.cores++` 箇所） |
| `engineStart/Speed/Stop` | `start()` / `loop()` 内 `st.speed` 更新後 / `stop()` |
| `ui('over')` | `gameOver()` |
| `ui('sync')` | SignalGame のチャンネル確立処理 |
| `beatOsc()` 移行 | `SignalGame.ensureAudio()` を置換 |
| `stopAll()` | `closeLayer()` |

### 3.4 ミュートUI（AUD-09）

- ASTEROID RUN HUD（PC版・SPコンパクト版とも）に `SOUND: ON/OFF` を追加。
  SP版はアイコン相当の短表記（`♪` / `♪̶` 等のテキストで可）
- SignalGame既存の `g-mute` ボタンは SoundEngine.toggleMute() に接続し直す
- キー `M` でも切替（PCのみ案内表示）

## 4. 受け入れ基準（AC）

| AC | 内容 | 対応要件 |
|---|---|---|
| AC-01 | 初回タップ直後の発砲で音が鳴る(iOS/Android/PC) | AUD-02,03 |
| AC-02 | 160ms連射を10秒継続してもクリックノイズ・音割れなし | AUD-03,12 |
| AC-03 | 大小の岩の破壊で爆発音の重さが聴き分けられる | AUD-04 |
| AC-04 | 被弾4回のシーケンスで、4発目前(CRITICAL)に専用警告音が鳴る | AUD-05 |
| AC-05 | 速度110と480でエンジン音のピッチ差が明確 | AUD-07 |
| AC-06 | ミュートONで全ゲーム無音、リロード後も設定維持 | AUD-09 |
| AC-07 | EXIT後にページ側で音が一切残らない | AUD-11 |
| AC-08 | SIGNALのうなり同調挙動が従来と同一 | AUD-10 |
| AC-09 | 追加後もフレーム時間予算内(SPEC-00 §2) | — |

## 5. リスク・備考

- **iOS Safariの自動再生制限**: ensure() をタッチイベント同期内で呼ぶこと（非同期後だと失効）
- closeLayer では `stopAll()` のみ実行（実装では共有ctxのsuspendは使わず、
  SIGNALのビート音はゲイン0で停止 — ゲーム間でctxを共有するため）
- 合成音の質が想定に届かない場合の代替: CC0実録SEの同梱（SPEC-00 §4、+50〜200KB）
