#!/usr/bin/env python3
"""
MiruCare テスト自動化ファイル配置スクリプト（macOS 向け）

ダウンロードフォルダから、プロジェクトルートおよび テストケース/ へ
必要なファイルを対話的にコピーします。
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple


# ---------------------------------------------------------------------------
# 配置定義
# ---------------------------------------------------------------------------

# グループ1: ルート（必須）
GROUP1_REQUIRED: Sequence[str] = (
    "analyze-test-results.py",
    "差分分析定義.json",
)

# グループ2: ルート（参考用）
GROUP2_REFERENCE: Sequence[str] = (
    "00_パッケージ全体サマリ.json",
    "期待値マッピング定義_Vitest用.json",
    "差分分析_実行ガイド.json",
    "テスト実行ガイド.json",
    "テスト実施計画書.xlsx",
    "Cursor_実行パッケージ.json",
)

# グループ3: テストケース/ フォルダ
GROUP3_TEST_CASES: Sequence[str] = (
    "テストケース_正常系01_完全一致.json",
    "テストケース_正常系02_複数サービス.json",
    "テストケース_異常系01_プランにない介護.json",
    "テストケース_異常系02_実績請求不整合.json",
    "テストケース_異常系03_実績欠落.json",
    "テストケース_異常系04_資格なし実施.json",
    "テストケース_異常系05_過少請求.json",
    "テストケース_異常系06_同意なし変更.json",
    "テストケース_エッジケース01_月跨ぎ.json",
    "テストケース_エッジケース02_キャンセル.json",
    "テストケース_エッジケース03_部分実施.json",
)

TEST_CASE_DIR_NAME = "テストケース"


# ---------------------------------------------------------------------------
# ユーティリティ
# ---------------------------------------------------------------------------

def expand_path(raw: str) -> Path:
    """~ と相対パスを絶対 Path に展開する。"""
    return Path(os.path.expanduser(raw.strip())).resolve()


def prompt_path(label: str, default: str) -> Path:
    """対話入力でパスを取得する。空入力なら default を使う。"""
    prompt = f"{label} [{default}]: "
    try:
        value = input(prompt).strip()
    except EOFError:
        value = ""
    return expand_path(value or default)


def confirm_overwrite(dest: Path) -> bool:
    """既存ファイルがある場合に上書き確認する。"""
    while True:
        try:
            answer = input(f"  上書きしますか？ {dest.name} [y/N]: ").strip().lower()
        except EOFError:
            return False
        if answer in ("y", "yes"):
            return True
        if answer in ("", "n", "no"):
            return False
        print("  y または n で答えてください。")


def find_source(downloads: Path, filename: str) -> Path | None:
    """
    ダウンロード先からファイルを探す。
    直下 → 1階層下のサブフォルダの順で検索する。
    """
    direct = downloads / filename
    if direct.is_file():
        return direct

    try:
        for child in downloads.iterdir():
            if not child.is_dir():
                continue
            candidate = child / filename
            if candidate.is_file():
                return candidate
    except OSError:
        return None

    return None


def ensure_dir(path: Path) -> None:
    """フォルダを作成する（既存なら何もしない）。"""
    os.makedirs(path, exist_ok=True)
    print(f"✓ フォルダ確認: {path}")


def copy_one(
    src: Path,
    dest: Path,
    *,
    required: bool,
) -> Tuple[str, str]:
    """
    1ファイルをコピーする。

    Returns:
        (status, message)
        status: "copied" | "skipped" | "missing" | "error"
    """
    if not src.is_file():
        mark = "✗" if required else "!"
        level = "エラー" if required else "警告"
        return (
            "missing",
            f"{mark} {level}: 見つかりません — {src.name}",
        )

    try:
        if dest.exists():
            print(f"  既存ファイルあり: {dest}")
            if not confirm_overwrite(dest):
                return ("skipped", f"✓ スキップ: {dest.name}")

        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        return ("copied", f"✓ コピー: {src.name} → {dest}")
    except OSError as exc:
        return ("error", f"✗ エラー: {src.name} のコピーに失敗 — {exc}")


def copy_group(
    downloads: Path,
    dest_dir: Path,
    filenames: Iterable[str],
    *,
    group_label: str,
    required: bool,
) -> List[str]:
    """グループ単位でコピーし、失敗ステータスの一覧を返す。"""
    print(f"\n--- {group_label} ---")
    failures: List[str] = []

    for name in filenames:
        src = find_source(downloads, name)
        if src is None:
            status, msg = "missing", (
                f"{'✗ エラー' if required else '! 警告'}: "
                f"見つかりません — {name}"
            )
            print(msg)
            if required:
                failures.append(name)
            continue

        status, msg = copy_one(src, dest_dir / name, required=required)
        print(msg)
        if status in ("missing", "error") and required:
            failures.append(name)

    return failures


# ---------------------------------------------------------------------------
# メイン
# ---------------------------------------------------------------------------

def main() -> int:
    print("=" * 60)
    print("MiruCare テスト自動化ファイル配置スクリプト")
    print("=" * 60)
    print()

    downloads = prompt_path(
        "ダウンロードフォルダのパス",
        str(Path.home() / "Downloads"),
    )
    project = prompt_path(
        "MiruCare プロジェクトのパス",
        str(Path.home() / "Documents" / "mirucare-app"),
    )

    print()
    print(f"✓ ダウンロード元: {downloads}")
    print(f"✓ プロジェクト先: {project}")

    if not downloads.is_dir():
        print(f"✗ エラー: ダウンロードフォルダが存在しません — {downloads}")
        return 1

    if not project.exists():
        print(f"✗ エラー: プロジェクトパスが存在しません — {project}")
        return 1
    if not project.is_dir():
        print(f"✗ エラー: プロジェクトパスがフォルダではありません — {project}")
        return 1

    test_case_dir = project / TEST_CASE_DIR_NAME
    print()
    ensure_dir(test_case_dir)

    failures: List[str] = []
    failures.extend(
        copy_group(
            downloads,
            project,
            GROUP1_REQUIRED,
            group_label="グループ1: ルート（必須）",
            required=True,
        )
    )
    copy_group(
        downloads,
        project,
        GROUP2_REFERENCE,
        group_label="グループ2: ルート（参考用）",
        required=False,
    )
    failures.extend(
        copy_group(
            downloads,
            test_case_dir,
            GROUP3_TEST_CASES,
            group_label=f"グループ3: {TEST_CASE_DIR_NAME}/",
            required=True,
        )
    )

    print()
    print("=" * 60)
    if failures:
        print("✗ エラー: 必須ファイルの配置に失敗しました")
        for name in failures:
            print(f"  - {name}")
        print("=" * 60)
        return 1

    print("✓ 配置完了")
    print("=" * 60)
    print()
    print("配置先の確認:")
    print(f"  ルート: {project}")
    print(f"  テストケース: {test_case_dir}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n✗ エラー: 中断されました")
        sys.exit(130)
