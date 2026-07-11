/**
 * オンボーディング用の自治体リスト（主要市区町村）
 * チェック基準の選択に使用。完全な全国リストは将来拡張。
 */
export type MunicipalityOption = {
  prefecture: string
  name: string
  label: string
}

export const MUNICIPALITIES: MunicipalityOption[] = [
  { prefecture: "北海道", name: "札幌市", label: "北海道 札幌市" },
  { prefecture: "宮城県", name: "仙台市", label: "宮城県 仙台市" },
  { prefecture: "東京都", name: "千代田区", label: "東京都 千代田区" },
  { prefecture: "東京都", name: "中央区", label: "東京都 中央区" },
  { prefecture: "東京都", name: "港区", label: "東京都 港区" },
  { prefecture: "東京都", name: "新宿区", label: "東京都 新宿区" },
  { prefecture: "東京都", name: "文京区", label: "東京都 文京区" },
  { prefecture: "東京都", name: "台東区", label: "東京都 台東区" },
  { prefecture: "東京都", name: "墨田区", label: "東京都 墨田区" },
  { prefecture: "東京都", name: "江東区", label: "東京都 江東区" },
  { prefecture: "東京都", name: "品川区", label: "東京都 品川区" },
  { prefecture: "東京都", name: "目黒区", label: "東京都 目黒区" },
  { prefecture: "東京都", name: "大田区", label: "東京都 大田区" },
  { prefecture: "東京都", name: "世田谷区", label: "東京都 世田谷区" },
  { prefecture: "東京都", name: "渋谷区", label: "東京都 渋谷区" },
  { prefecture: "東京都", name: "中野区", label: "東京都 中野区" },
  { prefecture: "東京都", name: "杉並区", label: "東京都 杉並区" },
  { prefecture: "東京都", name: "豊島区", label: "東京都 豊島区" },
  { prefecture: "東京都", name: "北区", label: "東京都 北区" },
  { prefecture: "東京都", name: "荒川区", label: "東京都 荒川区" },
  { prefecture: "東京都", name: "板橋区", label: "東京都 板橋区" },
  { prefecture: "東京都", name: "練馬区", label: "東京都 練馬区" },
  { prefecture: "東京都", name: "足立区", label: "東京都 足立区" },
  { prefecture: "東京都", name: "葛飾区", label: "東京都 葛飾区" },
  { prefecture: "東京都", name: "江戸川区", label: "東京都 江戸川区" },
  { prefecture: "東京都", name: "八王子市", label: "東京都 八王子市" },
  { prefecture: "東京都", name: "町田市", label: "東京都 町田市" },
  { prefecture: "神奈川県", name: "横浜市", label: "神奈川県 横浜市" },
  { prefecture: "神奈川県", name: "川崎市", label: "神奈川県 川崎市" },
  { prefecture: "神奈川県", name: "相模原市", label: "神奈川県 相模原市" },
  { prefecture: "神奈川県", name: "藤沢市", label: "神奈川県 藤沢市" },
  { prefecture: "埼玉県", name: "さいたま市", label: "埼玉県 さいたま市" },
  { prefecture: "埼玉県", name: "川口市", label: "埼玉県 川口市" },
  { prefecture: "千葉県", name: "千葉市", label: "千葉県 千葉市" },
  { prefecture: "千葉県", name: "船橋市", label: "千葉県 船橋市" },
  { prefecture: "愛知県", name: "名古屋市", label: "愛知県 名古屋市" },
  { prefecture: "京都府", name: "京都市", label: "京都府 京都市" },
  { prefecture: "大阪府", name: "大阪市", label: "大阪府 大阪市" },
  { prefecture: "大阪府", name: "堺市", label: "大阪府 堺市" },
  { prefecture: "兵庫県", name: "神戸市", label: "兵庫県 神戸市" },
  { prefecture: "兵庫県", name: "姫路市", label: "兵庫県 姫路市" },
  { prefecture: "広島県", name: "広島市", label: "広島県 広島市" },
  { prefecture: "福岡県", name: "福岡市", label: "福岡県 福岡市" },
  { prefecture: "福岡県", name: "北九州市", label: "福岡県 北九州市" },
  { prefecture: "沖縄県", name: "那覇市", label: "沖縄県 那覇市" },
]

/** オンボーディングで保存した市区町村名から都道府県を解決する */
export function findMunicipalityByName(
  name: string | null | undefined
): MunicipalityOption | undefined {
  if (!name?.trim()) return undefined
  const trimmed = name.trim()
  return (
    MUNICIPALITIES.find((m) => m.name === trimmed) ??
    MUNICIPALITIES.find((m) => m.label === trimmed) ??
    MUNICIPALITIES.find((m) => trimmed.endsWith(m.name))
  )
}

export function prefectureFromMunicipality(
  municipality: string | null | undefined
): string {
  return findMunicipalityByName(municipality)?.prefecture ?? ""
}

export const SERVICE_TYPE_OPTIONS = [
  {
    value: "訪問介護" as const,
    title: "訪問介護",
    description: "ご自宅へ伺って介護サービスを提供する事業所向け",
    icon: "Home",
  },
  {
    value: "通所介護" as const,
    title: "通所介護（デイサービス）",
    description: "施設に通っていただく介護サービス向け",
    icon: "Users",
  },
  {
    value: "その他" as const,
    title: "その他",
    description: "上記以外のサービス種別の事業所向け",
    icon: "Building2",
  },
]
