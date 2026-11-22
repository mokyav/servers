# Koruva 26.3 – Stage 4 Vanilla Visuals / 16×16 Texture Patch

## この段階で変更したこと

- ブロック用アトラスの出力タイルサイズを16×16ピクセルに固定。32×32／64×64のクライアント素材もスムージングなしで16×16へ縮小。
- 縦・横のアニメーションシートは`.mcmeta`のフレーム幅・高さ・順番・tick時間を読み、画像全体を縮小せず1フレームずつ切り出すよう変更。
- `interpolate=true`のアニメーションは隣接フレームをブレンドし、Prismarine、水・溶岩・炎などの公式アニメーション定義に対応。
- UVを半テクセル内側に寄せ、隣の16×16タイルの色が混ざりにくいように修正。
- 透明色・アルファを保持し、NearestFilter／mipmapなし／sRGBで描画。
- 色付きガラス、ガラス板、リピーター、コンパレーターなど、37種類の汎用・誤割り当てをJava 26.3のモデルデータで修正。
- Barrier、Light、Structure Voidはアイテム画像をワールド面に貼らず、非表示タイルとして扱う。
- grass block sideを透明オーバーレイ単体ではなく、通常の側面素材に戻す。
- ハート、空腹、アーマー、クロスヘア、ホットバー、経験値バー、攻撃インジケーターにJava 26.3のHUDスプライトを使用。
- メインメニューとボタン／入力欄にJava GUIスプライトを適用。作業台の3×3画面も公式`crafting_table.png`を背景に使用。
- モブテクスチャもsRGB／NearestFilterで表示するよう統一。

## 確認したデータ

- Java 26.3 block texture PNG: 1,300枚
- 登録ブロックテクスチャマッピング: 1,288種類
- 登録アイテムテクスチャマッピング: 1,658種類
- すべてのワールドアトラスタイル: 16×16
- 変更前に確認したブロック素材PNGは、送付された`client.zip`内の素材とバイト単位で一致。

## まだJava版と同じではない部分

- 全ブロックのモデル要素・複数パーツ・UV回転・tintindex・multipartを完全描画する機能。
- 草・葉・水・バイオームの色調（バイオーム別tint）。
- ベッド、旗、チェスト、看板、レッドストーン機器、植物など立方体以外の全モデルの正確な形状。
- 全Javaメニュー／全GUI／全アイテムアニメーションの完全再現。
- ライブブラウザでの見た目確認と本番ビルド確認。

## テスト

`node --test test/*.test.mjs`を実行。Stage 4の16×16タイル・.mcmetaアニメーション・公式テクスチャ割り当てテストを追加。

## 最終確認

- `node --test test/*.test.mjs`: 195 tests passed.
- TypeScript transpile syntax check: 39 source files, 0 syntax errors.
- TypeScript import/declaration check: no missing-export or declaration-import mismatch diagnostics. Full project typecheck remains unavailable because the package/type environment (including `vite/client`) is not installed in this runtime.
- `client.zip`とのブロック画像比較: 1,300枚、欠落0、余分0、バイト不一致0。
- ZIPアーカイブ検査は配布ファイル作成後に実施。

## 補足

本ステージは、既存のKoruvaレンダラーを維持しながら16×16のバニラ素材と主要HUDを反映する互換レイヤーです。Java版の完全なブロックモデルエンジンや全GUI実装を置き換えるものではありません。実ブラウザ表示・本番ビルドは未検証です。
