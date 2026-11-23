# MINECRAFT_FEATURES — 参照データとKoruva機能の対応

参照アーカイブは `client/version.json` 上で Java Edition 26.3 (world version 5023) と記録されている。公式26.3リリースの追加内容にはDappled Forest、Poplar材、Abandoned Camp、Wool/Concreteの階段・ハーフブロック等がある。これらは比較対象であり、Koruvaに実装済みという意味ではない。

## 機能別の確認範囲
|領域|参照ZIPで確認したもの|Koruvaの現況|
|---|---|---|
|ブロック/状態|blockstate/model/textureの資産群|部分実装。独自ブロック定義と代表テクスチャ、設置/破壊があるが全状態/挙動ではない|
|アイテム|item定義・model・texture|部分実装。全アイテム挙動、耐久/装備は未完了|
|Mob/エンティティ|クラスファイルと各種リソース、spawn egg roster|部分実装。登録・自然spawn・限定AI/lootはあるが、全Mob固有AIではない|
|レシピ/loot|recipe 2,042、loot table 1,447|部分実装。現在のクラフト実装とレシピ集合は限定的|
|進捗/エンチャント|advancement 1,866、enchantment 43|未実装または限定的。参照データ数だけでは実装と見なさない|
|バイオーム/地形|worldgenデータ1,144|部分実装。Koruva地形生成と限定バイオーム。完全なJava互換ではない|
|構造物|structure 1,511|未実装/部分的。全構造物の生成を確認していない|
|ディメンション|参照version metadataにOverworld/Nether/End|部分実装。次元分離・一部生成/スポーンは存在するが、完全なportal loopではない|
|音/粒子/GUI|粒子定義115、画像/GUIなどの資産|粒子/UIは限定的。全音響・アニメーション・GUI挙動は未調査/未実装|
|データ・管理|各種data json, tags, command-related classes|Koruva独自サーバーコードはあるが全コマンド/セキュリティ要件未完了|

## 26.3比較用の確認点
- 新規バイオーム、Poplar木材セット、Abandoned Campなどのワールド生成。
- Wool/Concrete stairs and slabs等のブロックファミリー。
- 透過物の描画改善や関連する設定の互換性。
- エンティティ、アイテム、ワールドデータの細かな仕様変更。

本書は機能棚卸しであり、Minecraft実装コードを移植する指示ではない。データ資産の存在とゲーム挙動の実装を分離して追跡する。

## 統合作業 2026-11-21

- サイクル6のモバイル操作・描画設定・自動最適化と Inventory Stage 2 のアイテム／インベントリ処理を統合。A側の性能UI・モバイル操作を残し、B側のインベントリUIとデータ処理を合流。
- サーバーの versioned player save（位置・体力・所持品）を維持し、装備スロットも保存対象に追加。
- Minecraftクライアント由来のシェーダー／リソース素材は成果物へコピーしていない。`client.zip` は構造調査のみで全ファイル解析ではなく、素材の完全ライセンス調査も未了。
- アイテムIDカタログ件数は、各アイテムの完全な挙動・レシピ・テクスチャ実装件数を意味しない。



## Overworld world generation v4 (2026-11-23)

- New worlds now use v4; saved v1-v3 worlds keep their prior terrain generator.
- Added connected cave density fields, spaghetti/noodle tunnels and larger cavern spaces.
- Added localized underground water/lava aquifers and cave-biome decoration for lush caves, dripstone caves, deep dark and sulfur caves.
- Added coal, iron, copper, gold, redstone, diamond, lapis and emerald ore vein profiles, including deepslate variants and mountain-only emeralds.
- Added tuff/granite/diorite/andesite geology and stable neighbour-chunk vein origins to avoid ore seams at chunk borders.
- This is a deterministic adaptation to Koruva's 128-block world and sea level 22; it is not an exact copy of vanilla's 384-block-high Java 26.3 terrain.
