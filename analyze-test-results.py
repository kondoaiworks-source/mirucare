#!/usr/bin/env python3
"""
MiruCare シナリオ結果の差分分析スクリプト

使い方:
  python3 ~/mirucare-app/analyze-test-results.py \\
    ~/mirucare-app/test-data/scenarios-result.json

入力:
  - scenarios-result.json（npm run test:check:live の出力）
  - 差分分析定義.json（同ディレクトリ、または --definition）

出力（カレント or --outdir）:
  - analysis-report.json
  - analysis-report.html
  - improvement-suggestions.md
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Set, Tuple


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_DEFINITION = SCRIPT_DIR / "差分分析定義.json"
DEFAULT_OUTDIR = SCRIPT_DIR


# ---------------------------------------------------------------------------
# I/O
# ---------------------------------------------------------------------------

def die(message: str, code: int = 1) -> None:
    print(f"✗ エラー: {message}", file=sys.stderr)
    sys.exit(code)


def load_json(path: Path, label: str) -> Any:
    if not path.exists():
        die(f"{label} が見つかりません — {path}")
    if not path.is_file():
        die(f"{label} がファイルではありません — {path}")
    try:
        with path.open("r", encoding="utf-8") as fh:
            return json.load(fh)
    except json.JSONDecodeError as exc:
        die(
            f"{label} の JSON パースに失敗しました — {path}\n"
            f"  行 {exc.lineno}, 列 {exc.colno}: {exc.msg}"
        )
    except OSError as exc:
        die(f"{label} の読み込みに失敗しました — {exc}")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"✓ 出力: {path}")


# ---------------------------------------------------------------------------
# 正規化
# ---------------------------------------------------------------------------

def extract_cases(payload: Any) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """scenarios-result.json からメタと cases を取り出す。"""
    if isinstance(payload, list):
        return {}, payload
    if not isinstance(payload, dict):
        die("scenarios-result.json の形式が不正です（object または array を期待）")
    cases = payload.get("cases")
    if not isinstance(cases, list):
        die("scenarios-result.json に cases 配列がありません")
    return payload, cases


def case_id_of(row: Dict[str, Any]) -> Optional[str]:
    for key in ("testCaseId", "テストケースID", "id", "caseId"):
        val = row.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    # ファイル名からの推定
    name = row.get("fileName") or row.get("file_name") or ""
    if isinstance(name, str) and "テストケース_" in name:
        # テストケース_正常系01_完全一致.json → 正常系_01 形式へ寄せるのは難しいので
        # 定義側 ID との照合は後段の alias で行う
        return None
    return None


def findings_of(row: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = row.get("findings")
    if isinstance(raw, list):
        return [f for f in raw if isinstance(f, dict)]
    return []


def finding_count_of(row: Dict[str, Any]) -> int:
    if isinstance(row.get("findingCount"), int):
        return int(row["findingCount"])
    return len(findings_of(row))


def normalize_severity(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    v = value.strip().lower()
    aliases = {
        "高": "high",
        "中": "medium",
        "低": "low",
        "critical": "high",
        "error": "high",
        "warn": "medium",
        "warning": "medium",
        "info": "low",
    }
    return aliases.get(v, v)


def normalize_check_type(value: Any) -> Optional[str]:
    if not isinstance(value, str):
        return None
    v = value.strip().lower()
    aliases = {
        "整合性": "consistency",
        "alignment": "consistency",
        "ルール": "rule",
    }
    return aliases.get(v, v)


# ---------------------------------------------------------------------------
# スコアリング
# ---------------------------------------------------------------------------

def score_finding_count(
    actual: int,
    expectation: Dict[str, Any],
) -> float:
    """件数スコア 0.0〜1.0。固定値優先、なければ min/max 帯。"""
    if "expected_finding_count_min" in expectation or "expected_finding_count_max" in expectation:
        lo = expectation.get("expected_finding_count_min")
        hi = expectation.get("expected_finding_count_max")
        lo_i = int(lo) if isinstance(lo, (int, float)) else 0
        hi_i = int(hi) if isinstance(hi, (int, float)) else lo_i
        if lo_i <= actual <= hi_i:
            # 理想値があれば距離で微調整
            ideal = expectation.get("expected_finding_count")
            if isinstance(ideal, (int, float)):
                ideal_i = int(ideal)
                if actual == ideal_i:
                    return 1.0
                span = max(hi_i - lo_i, 1)
                return max(0.5, 1.0 - abs(actual - ideal_i) / span * 0.5)
            return 1.0
        # 帯外: 距離に応じて減衰
        dist = lo_i - actual if actual < lo_i else actual - hi_i
        return max(0.0, 1.0 - dist * 0.35)

    expected = expectation.get("expected_finding_count")
    if not isinstance(expected, (int, float)):
        return 1.0
    expected_i = int(expected)
    if actual == expected_i:
        return 1.0
    # 異常系で「1件以上」意図の場合の救済は min/max 側で行う
    diff = abs(actual - expected_i)
    return max(0.0, 1.0 - diff * 0.4)


def score_set_any(expected: Sequence[str], actual: Set[str]) -> float:
    """
    期待リストは「許容値のいずれか」として扱う（OR）。
    期待が空なら制約なし → 1.0。
    """
    exp = {x for x in expected if x}
    if not exp:
        return 1.0
    if actual & exp:
        return 1.0
    # 実績に別値がある場合は部分点、完全欠落は 0
    return 0.25 if actual else 0.0


def score_rule_code(
    expectation: Dict[str, Any],
    actual_codes: Set[str],
) -> float:
    codes = expectation.get("expected_rule_codes") or []
    primary = expectation.get("expected_rule_code")
    candidates: Set[str] = set()
    if isinstance(primary, str) and primary.strip():
        candidates.add(primary.strip())
    if isinstance(codes, list):
        for c in codes:
            if isinstance(c, str) and c.strip():
                candidates.add(c.strip())
    if not candidates:
        return 1.0
    if actual_codes & candidates:
        return 1.0
    # 異常系で findings はあるが ruleCode 未付与 → 部分点
    if actual_codes:
        return 0.25
    return 0.0


def verdict_from_score(score: float, pass_th: float, partial_th: float) -> str:
    if score >= pass_th:
        return "PASS"
    if score >= partial_th:
        return "PARTIAL"
    return "FAIL"


def analyze_case(
    case_id: str,
    row: Dict[str, Any],
    expectation: Dict[str, Any],
    weights: Dict[str, float],
    pass_th: float,
    partial_th: float,
) -> Dict[str, Any]:
    findings = findings_of(row)
    count = finding_count_of(row)

    actual_types = {
        t
        for t in (normalize_check_type(f.get("checkType") or f.get("check_type")) for f in findings)
        if t
    }
    actual_severities = {
        s
        for s in (normalize_severity(f.get("severity")) for f in findings)
        if s
    }
    actual_codes = {
        c.strip()
        for c in (
            (f.get("ruleCode") or f.get("rule_code") or "")
            for f in findings
        )
        if isinstance(c, str) and c.strip()
    }

    expected_types = [
        normalize_check_type(x) or str(x)
        for x in (expectation.get("expected_check_types") or [])
        if x
    ]
    expected_severities = [
        normalize_severity(x) or str(x)
        for x in (expectation.get("expected_severities") or [])
        if x
    ]

    s_count = score_finding_count(count, expectation)
    s_types = score_set_any(expected_types, actual_types)
    s_sev = score_set_any(expected_severities, actual_severities)
    s_rule = score_rule_code(expectation, actual_codes)

    w_count = float(weights.get("finding_count", 0.4))
    w_types = float(weights.get("check_types", 0.3))
    w_sev = float(weights.get("severities", 0.15))
    w_rule = float(weights.get("rule_code", 0.15))
    w_sum = w_count + w_types + w_sev + w_rule or 1.0

    score = (
        s_count * w_count
        + s_types * w_types
        + s_sev * w_sev
        + s_rule * w_rule
    ) / w_sum

    status = verdict_from_score(score, pass_th, partial_th)

    return {
        "test_case_id": case_id,
        "test_case_name": expectation.get("test_case_name")
        or row.get("testCaseName")
        or row.get("テストケース名"),
        "category": expectation.get("category"),
        "file_name": row.get("fileName") or row.get("file_name"),
        "status": status,
        "score": round(score, 4),
        "score_breakdown": {
            "finding_count": round(s_count, 4),
            "check_types": round(s_types, 4),
            "severities": round(s_sev, 4),
            "rule_code": round(s_rule, 4),
        },
        "expected": {
            "finding_count": expectation.get("expected_finding_count"),
            "finding_count_min": expectation.get("expected_finding_count_min"),
            "finding_count_max": expectation.get("expected_finding_count_max"),
            "check_types": expectation.get("expected_check_types") or [],
            "severities": expectation.get("expected_severities") or [],
            "rule_code": expectation.get("expected_rule_code"),
            "rule_codes": expectation.get("expected_rule_codes") or [],
            "notes": expectation.get("notes"),
        },
        "actual": {
            "finding_count": count,
            "check_types": sorted(actual_types),
            "severities": sorted(actual_severities),
            "rule_codes": sorted(actual_codes),
            "parse_ok": row.get("parseOk"),
            "used_fallback": row.get("usedFallback"),
            "error": row.get("error"),
            "findings": findings,
        },
        "expected_rule_hint": row.get("expectedRuleHint"),
    }


# ---------------------------------------------------------------------------
# レポート生成
# ---------------------------------------------------------------------------

def build_summary(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    counts = {"PASS": 0, "PARTIAL": 0, "FAIL": 0, "MISSING": 0}
    for r in results:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    total = len(results) or 1
    return {
        "total": len(results),
        "pass": counts.get("PASS", 0),
        "partial": counts.get("PARTIAL", 0),
        "fail": counts.get("FAIL", 0),
        "missing": counts.get("MISSING", 0),
        "pass_rate": round(counts.get("PASS", 0) / total, 4),
        "pass_or_partial_rate": round(
            (counts.get("PASS", 0) + counts.get("PARTIAL", 0)) / total, 4
        ),
    }


def build_improvement_md(
    results: List[Dict[str, Any]],
    summary: Dict[str, Any],
) -> str:
    lines: List[str] = [
        "# MiruCare シナリオ差分分析 — 改善提案",
        "",
        f"生成日時: {datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')}",
        "",
        "## サマリ",
        "",
        f"- 合計: **{summary['total']}** 件",
        f"- PASS: **{summary['pass']}** / PARTIAL: **{summary['partial']}** / FAIL: **{summary['fail']}** / MISSING: **{summary['missing']}**",
        f"- PASS 率: **{summary['pass_rate'] * 100:.1f}%**",
        "",
        "> 本レポートは Wチェック支援用の差分分析です。合否の最終判断・提出は貴施設の責任で行ってください。",
        "",
    ]

    fails = [r for r in results if r["status"] in ("FAIL", "PARTIAL", "MISSING")]
    if not fails:
        lines += [
            "## 改善提案",
            "",
            "全ケースが PASS です。追加の改善提案はありません。",
            "エッジケースの誤検出がないか、定期的に結果を目視確認することをおすすめします。",
            "",
        ]
        return "\n".join(lines)

    lines += ["## 優先対応ケース", ""]
    for r in sorted(fails, key=lambda x: (0 if x["status"] == "FAIL" else 1, x.get("score") or 0)):
        status = r["status"]
        mark = "✗" if status == "FAIL" else ("△" if status == "PARTIAL" else "!")
        lines.append(f"### {mark} {r['test_case_id']} — {r.get('test_case_name') or ''}")
        lines.append("")
        lines.append(f"- 判定: **{status}**（score={r.get('score', 0):.2f}）")
        exp = r.get("expected") or {}
        act = r.get("actual") or {}
        lines.append(
            f"- 件数: 期待 {exp.get('finding_count_min')}〜{exp.get('finding_count_max')} "
            f"（理想 {exp.get('finding_count')}） / 実績 **{act.get('finding_count')}**"
        )
        lines.append(
            f"- check_types: 期待 `{exp.get('check_types')}` / 実績 `{act.get('check_types')}`"
        )
        lines.append(
            f"- rule_codes: 期待 `{exp.get('rule_codes') or exp.get('rule_code')}` / 実績 `{act.get('rule_codes')}`"
        )
        if act.get("error"):
            lines.append(f"- 実行エラー: `{act['error']}`")
        lines.append("")
        lines.append("**提案:**")
        lines.append("")
        cat = r.get("category") or ""
        if status == "MISSING":
            lines.append("- `scenarios-result.json` に当該ケースが含まれていません。`npm run test:check:live` を再実行してください。")
        elif cat == "正常系" and (act.get("finding_count") or 0) > 0:
            lines.append("- 正常系で findings が出ています。プロンプト／ルールの過剰検出を疑い、誤検出 findings の title・ruleCode を確認してください。")
            lines.append("- Dify 側の Knowledge / 承認ルール JSON がシナリオ用に絞られているか確認してください。")
        elif cat == "異常系" and (act.get("finding_count") or 0) == 0:
            lines.append("- 異常系なのに findings が 0 です。検出漏れの可能性があります。")
            lines.append("- シナリオ文書テキスト化（`buildScenarioDocumentTextFromJson`）で問題点が落ちていないか確認してください。")
            lines.append(f"- 期待ルール `{exp.get('rule_code')}` が承認ルール一覧に含まれているか確認してください。")
        elif status == "PARTIAL":
            lines.append("- 件数は近いが checkType / ruleCode が期待とずれています。Dify 出力スキーマ（check_type / rule_code）の安定化を検討してください。")
        else:
            lines.append("- 期待値と大きく乖離しています。シナリオ JSON・プロンプト・ルールシードを突き合わせて原因を切り分けてください。")
        if exp.get("notes"):
            lines.append(f"- メモ: {exp['notes']}")
        lines.append("")

    lines += [
        "## 次のアクション（推奨順）",
        "",
        "1. FAIL ケースの `findings` を `analysis-report.json` で個別確認する",
        "2. 異常系の検出漏れなら、対応する Phase1 ルールコードと Dify プロンプトを点検する",
        "3. 正常系の過剰検出なら、該当ルールの guidance / 閾値を調整する",
        "4. 修正後に `npm run test:check:live` → 本スクリプトを再実行する",
        "",
    ]
    return "\n".join(lines)


def html_escape(text: Any) -> str:
    s = "" if text is None else str(text)
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def build_html(report: Dict[str, Any]) -> str:
    summary = report["summary"]
    rows_html: List[str] = []
    for r in report["results"]:
        status = r["status"]
        badge = {
            "PASS": ("pass", "✓ PASS"),
            "PARTIAL": ("partial", "△ PARTIAL"),
            "FAIL": ("fail", "✗ FAIL"),
            "MISSING": ("missing", "! MISSING"),
        }.get(status, ("fail", status))
        act = r.get("actual") or {}
        exp = r.get("expected") or {}
        rows_html.append(
            f"""
            <tr class="{badge[0]}">
              <td><span class="badge {badge[0]}">{html_escape(badge[1])}</span></td>
              <td>{html_escape(r.get('test_case_id'))}</td>
              <td>{html_escape(r.get('test_case_name'))}</td>
              <td class="num">{html_escape(f"{r.get('score', 0):.0%}")}</td>
              <td class="num">{html_escape(act.get('finding_count'))}</td>
              <td class="num">{html_escape(exp.get('finding_count_min'))}–{html_escape(exp.get('finding_count_max'))}</td>
              <td>{html_escape(', '.join(act.get('check_types') or []))}</td>
              <td>{html_escape(', '.join(act.get('rule_codes') or []))}</td>
            </tr>
            """
        )

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>MiruCare シナリオ差分分析レポート</title>
  <style>
    :root {{
      --primary: #0F766E;
      --primary-dark: #0B3B37;
      --accent: #B45309;
      --danger: #B42318;
      --bg: #F6F8FA;
      --card: #FFFFFF;
      --text: #1F2937;
      --muted: #6B7280;
      --border: #E5E7EB;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Noto Sans JP", "Hiragino Sans", sans-serif;
      background: var(--bg);
      color: var(--text);
      font-size: 16px;
      line-height: 1.6;
    }}
    header {{
      background: var(--primary-dark);
      color: #fff;
      padding: 28px 24px;
    }}
    header h1 {{ margin: 0 0 8px; font-size: 1.5rem; font-weight: 700; }}
    header p {{ margin: 0; opacity: 0.85; font-size: 0.95rem; }}
    main {{ max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }}
    .cards {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }}
    .card {{
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
    }}
    .card .label {{ color: var(--muted); font-size: 0.85rem; }}
    .card .value {{
      font-size: 1.75rem;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--primary-dark);
      margin-top: 4px;
    }}
    .card.fail .value {{ color: var(--danger); }}
    .card.partial .value {{ color: var(--accent); }}
    table {{
      width: 100%;
      border-collapse: collapse;
      background: var(--card);
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--border);
    }}
    th, td {{
      text-align: left;
      padding: 12px 14px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
      font-size: 0.92rem;
    }}
    th {{
      background: #ECFDF5;
      color: var(--primary-dark);
      font-weight: 600;
    }}
    tr:last-child td {{ border-bottom: none; }}
    .num {{ font-variant-numeric: tabular-nums; white-space: nowrap; }}
    .badge {{
      display: inline-block;
      padding: 2px 10px;
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 700;
    }}
    .badge.pass {{ background: #D1FAE5; color: #065F46; }}
    .badge.partial {{ background: #FEF3C7; color: #92400E; }}
    .badge.fail, .badge.missing {{ background: #FEE2E2; color: #991B1B; }}
    footer {{
      margin-top: 28px;
      color: var(--muted);
      font-size: 0.85rem;
      border-top: 1px solid var(--border);
      padding-top: 16px;
    }}
  </style>
</head>
<body>
  <header>
    <h1>MiruCare シナリオ差分分析レポート</h1>
    <p>生成: {html_escape(report.get('generated_at'))} ／ 入力: {html_escape(report.get('source_result'))}</p>
  </header>
  <main>
    <section class="cards" aria-label="サマリ">
      <div class="card"><div class="label">合計</div><div class="value">{summary['total']}</div></div>
      <div class="card"><div class="label">✓ PASS</div><div class="value">{summary['pass']}</div></div>
      <div class="card partial"><div class="label">△ PARTIAL</div><div class="value">{summary['partial']}</div></div>
      <div class="card fail"><div class="label">✗ FAIL</div><div class="value">{summary['fail']}</div></div>
      <div class="card"><div class="label">PASS率</div><div class="value">{summary['pass_rate'] * 100:.0f}%</div></div>
    </section>
    <table>
      <thead>
        <tr>
          <th>判定</th>
          <th>ID</th>
          <th>ケース名</th>
          <th>一致率</th>
          <th>実績件数</th>
          <th>期待件数</th>
          <th>check_types</th>
          <th>rule_codes</th>
        </tr>
      </thead>
      <tbody>
        {''.join(rows_html)}
      </tbody>
    </table>
    <footer>
      本サービスはWチェック支援であり、最終判断・提出は貴施設の責任で行ってください。
    </footer>
  </main>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------

def parse_args(argv: Optional[Sequence[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="MiruCare scenarios-result.json の差分分析"
    )
    parser.add_argument(
        "result_json",
        nargs="?",
        default=str(SCRIPT_DIR / "test-data" / "scenarios-result.json"),
        help="scenarios-result.json のパス",
    )
    parser.add_argument(
        "--definition",
        default=str(DEFAULT_DEFINITION),
        help="差分分析定義.json のパス",
    )
    parser.add_argument(
        "--outdir",
        default=str(DEFAULT_OUTDIR),
        help="レポート出力先ディレクトリ",
    )
    return parser.parse_args(argv)


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = parse_args(argv)
    result_path = Path(args.result_json).expanduser().resolve()
    definition_path = Path(args.definition).expanduser().resolve()
    outdir = Path(args.outdir).expanduser().resolve()

    print("=" * 60)
    print("MiruCare シナリオ差分分析")
    print("=" * 60)
    print(f"✓ 結果ファイル: {result_path}")
    print(f"✓ 定義ファイル: {definition_path}")
    print(f"✓ 出力先: {outdir}")

    payload = load_json(result_path, "scenarios-result.json")
    definition = load_json(definition_path, "差分分析定義.json")

    if not isinstance(definition, dict):
        die("差分分析定義.json の形式が不正です")

    expectations = definition.get("test_case_expectations")
    if not isinstance(expectations, dict) or not expectations:
        die("差分分析定義.json に test_case_expectations がありません")

    scoring = definition.get("scoring") or {}
    weights = scoring.get("weights") or {
        "finding_count": 0.4,
        "check_types": 0.3,
        "severities": 0.15,
        "rule_code": 0.15,
    }
    pass_th = float(scoring.get("pass_threshold", 1.0))
    partial_th = float(scoring.get("partial_threshold", 0.5))

    meta, cases = extract_cases(payload)
    print(f"✓ ケース読込: {len(cases)} 件")

    # testCaseId → row
    by_id: Dict[str, Dict[str, Any]] = {}
    for row in cases:
        if not isinstance(row, dict):
            continue
        cid = case_id_of(row)
        if cid:
            by_id[cid] = row

    results: List[Dict[str, Any]] = []
    for case_id, expectation in expectations.items():
        row = by_id.get(case_id)
        if row is None:
            results.append(
                {
                    "test_case_id": case_id,
                    "test_case_name": expectation.get("test_case_name"),
                    "category": expectation.get("category"),
                    "status": "MISSING",
                    "score": 0.0,
                    "score_breakdown": {},
                    "expected": {
                        "finding_count": expectation.get("expected_finding_count"),
                        "finding_count_min": expectation.get("expected_finding_count_min"),
                        "finding_count_max": expectation.get("expected_finding_count_max"),
                        "check_types": expectation.get("expected_check_types") or [],
                        "severities": expectation.get("expected_severities") or [],
                        "rule_code": expectation.get("expected_rule_code"),
                        "rule_codes": expectation.get("expected_rule_codes") or [],
                        "notes": expectation.get("notes"),
                    },
                    "actual": {
                        "finding_count": None,
                        "check_types": [],
                        "severities": [],
                        "rule_codes": [],
                        "error": "scenarios-result.json に該当ケースがありません",
                        "findings": [],
                    },
                }
            )
            print(f"✗ MISSING: {case_id}")
            continue

        analyzed = analyze_case(
            case_id, row, expectation, weights, pass_th, partial_th
        )
        results.append(analyzed)
        mark = {"PASS": "✓", "PARTIAL": "△", "FAIL": "✗"}.get(
            analyzed["status"], "!"
        )
        print(
            f"{mark} {analyzed['status']}: {case_id} "
            f"(score={analyzed['score']:.0%}, findings={analyzed['actual']['finding_count']})"
        )

    summary = build_summary(results)
    report = {
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "source_result": str(result_path),
        "source_definition": str(definition_path),
        "result_meta": {
            "generatedAt": meta.get("generatedAt"),
            "municipality": meta.get("municipality"),
            "caseCount": meta.get("caseCount"),
        },
        "summary": summary,
        "results": results,
    }

    outdir.mkdir(parents=True, exist_ok=True)
    json_path = outdir / "analysis-report.json"
    html_path = outdir / "analysis-report.html"
    md_path = outdir / "improvement-suggestions.md"

    write_text(json_path, json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    write_text(html_path, build_html(report))
    write_text(md_path, build_improvement_md(results, summary))

    print()
    print("=" * 60)
    print(
        f"✓ 分析完了 — PASS {summary['pass']} / "
        f"PARTIAL {summary['partial']} / FAIL {summary['fail']} / "
        f"MISSING {summary['missing']}"
    )
    print("=" * 60)
    return 0 if summary["fail"] == 0 and summary["missing"] == 0 else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n✗ エラー: 中断されました", file=sys.stderr)
        sys.exit(130)
