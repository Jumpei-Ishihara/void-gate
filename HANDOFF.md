# VOID GATE — オフライン化 完了報告

> **注**: 本書は2026-06-12時点のスナップショット。その後の素材クオリティ向上（QUALITY_PLAN Phase 1〜4）で
> ブルーム用アドオン2ファイル（UnrealBloomPass / LuminosityHighPassShader、約20KB）が `libs/addons/` に
> 追加され、現在のアドオンは10ファイル・配布物合計は約1.7MB。オフライン動作（外部リクエスト0）は維持されている。

ステータス: **全タスク完了**（2026-06-12 検証済み）

## 実施内容

| タスク | 結果 |
|---|---|
| A. Three.js参照のローカル化 | 完了 — importmapを `./libs/` に書き換え。本体r160＋アドオン8ファイル同梱 |
| B-1. Orbitron | 完了 — 可変フォント(wght 400-900)のサブセットwoff2を1ファイル同梱(9KB) |
| B-2. Noto Sans JP | 完了 — `text=`エンドポイントはbot対策で取得不能だったため、google/fontsリポジトリの可変TTF(9.6MB)を取得し、fonttoolsで使用文字(約500字)にローカルサブセット化 → 222KBのwoff2(wght 100-900) |
| C. 検証 | 完了 — 下記参照 |

## 検証結果（プレビューブラウザで確認）

- ネットワーク: 全リクエストが localhost のみ。googleapis / gstatic / jsdelivr への通信ゼロ、失敗リクエストゼロ
- フォント: `document.fonts` で Orbitron(400-900)・Noto Sans JP(100-900) とも `loaded`。
  ウェイト300/600/800のチェックすべて合格
- 動作: 背景3D描画、ASTEROID RUN起動、残像モーションブラー（ローカルAfterimagePass）、
  コックピット計器のOrbitron表示まで正常。コンソールエラー/警告ゼロ
- 配布物合計: 約1.6MB

## 備考

- Noto Sans JPサブセットに `▸`(U+25B8) は含まれない（Noto自体が非収録）。
  従来どおりシステムフォントのフォールバックで描画される（オフラインでも問題なし）。
- 新しい文言を index.html に追加した場合、使用漢字が増えるとNotoサブセットに無い字が
  システムフォント描画になる。気になる場合は fonttools で再サブセット化すること
  （手順: google/fonts の NotoSansJP[wght].ttf → `pyftsubset --text-file=使用文字 --flavor=woff2`）。
- ESモジュール使用のため file:// 直開き不可。`python3 -m http.server` 等のHTTPサーバ経由で開くこと。
