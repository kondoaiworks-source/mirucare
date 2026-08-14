import { describe, expect, it } from "vitest"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import {
  collectRulebookSourceLinks,
  groupRulebookSourceLinks,
  sourceListPath,
} from "@/lib/rule-engine/rulebook-source-links"

describe("rulebook-source-links", () => {
  it("collects unique 国・県・市 URLs", () => {
    const data = {
      city: { name: "横浜市", prefectureName: "神奈川県" },
      sources: [
        {
          id: "s-n",
          layer: "national",
          title: "国の通知",
          official_url: "https://example.com/national",
          direct_file_url: null,
          parent_page_url: null,
        },
        {
          id: "s-p",
          layer: "prefecture",
          title: "県の手引き",
          official_url: "https://example.com/pref",
          direct_file_url: null,
          parent_page_url: null,
        },
      ],
      documents: [
        {
          id: "d-c",
          layer: "city",
          title: "市の様式",
          source_url: "https://example.com/city",
        },
        {
          id: "d-dup",
          layer: "national",
          title: "重複",
          source_url: "https://example.com/national",
        },
      ],
    } as unknown as CityRulebookData

    const links = collectRulebookSourceLinks(data)
    expect(links.map((l) => l.layer)).toEqual([
      "national",
      "prefecture",
      "city",
    ])
    const grouped = groupRulebookSourceLinks(data, links)
    expect(grouped[0]?.items).toHaveLength(1)
    expect(grouped[1]?.label).toBe("神奈川県")
    expect(grouped[2]?.label).toBe("横浜市")
  })

  it("builds the sources path with city", () => {
    expect(sourceListPath("homecare", "yokohama")).toBe(
      "/admin/rules/services/homecare/sources?city=yokohama"
    )
  })
})
