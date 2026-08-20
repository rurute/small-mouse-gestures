#!/usr/bin/env python3
"""ウェブストア提出用の ZIP を作る。

  python3 tools/package.py

同梱するものは許可リストで指定している。除外リスト方式にすると、
将来ファイルを増やしたときに黙って配布物へ紛れ込むため。

ZIP を作る前に manifest の整合性を確認し、一つでも引っかかったら
中断する。壊れたパッケージを黙って吐くのが一番困る。
"""

import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# 同梱するものの許可リスト。ここに無いものは配布物に入らない。
INCLUDE = [
    ("manifest.json", None),
    ("icons", {".png"}),
    ("src", {".js", ".html", ".css"}),
]


class PackagingError(Exception):
    """配布物として出せない状態を見つけたときに投げる。"""


def collect_files():
    """許可リストに従って同梱するファイルを集める。"""
    files = []
    for name, extensions in INCLUDE:
        target = ROOT / name
        if not target.exists():
            raise PackagingError(f"{name} が見つかりません")

        if extensions is None:
            files.append(target)
            continue

        for path in sorted(target.rglob("*")):
            if path.is_dir():
                continue
            if path.suffix not in extensions:
                raise PackagingError(
                    f"{path.relative_to(ROOT)} は許可リストにない拡張子です。"
                    f"配布物に含めるなら tools/package.py の INCLUDE を更新してください"
                )
            files.append(path)
    return files


def load_manifest():
    path = ROOT / "manifest.json"
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise PackagingError(f"manifest.json を JSON として読めません: {error}") from error

    if manifest.get("manifest_version") != 3:
        raise PackagingError(
            f"manifest_version が 3 ではありません: {manifest.get('manifest_version')!r}"
        )
    for key in ("name", "version"):
        if not manifest.get(key):
            raise PackagingError(f"manifest.json に {key} がありません")
    return manifest


def manifest_referenced_paths(manifest):
    """manifest が名指ししているファイルを列挙する。"""
    referenced = list(manifest.get("icons", {}).values())

    service_worker = manifest.get("background", {}).get("service_worker")
    if service_worker:
        referenced.append(service_worker)

    for entry in manifest.get("content_scripts", []):
        referenced.extend(entry.get("js", []))
        referenced.extend(entry.get("css", []))

    options_page = manifest.get("options_page")
    if options_page:
        referenced.append(options_page)

    return referenced


def verify_references(manifest, files):
    """manifest の参照先が実在し、かつ同梱されることを確認する。"""
    packaged = {path.relative_to(ROOT).as_posix() for path in files}
    for reference in manifest_referenced_paths(manifest):
        if not (ROOT / reference).exists():
            raise PackagingError(f"manifest が参照する {reference} が存在しません")
        if reference not in packaged:
            raise PackagingError(f"manifest が参照する {reference} が配布物に含まれていません")


def build(manifest, files):
    slug = manifest["name"].strip().lower().replace(" ", "-")
    archive = DIST / f"{slug}-{manifest['version']}.zip"

    if archive.exists():
        raise PackagingError(
            f"{archive.relative_to(ROOT)} はすでにあります。"
            f"manifest.json の version を上げるか、既存の ZIP を消してください"
        )

    DIST.mkdir(exist_ok=True)
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in files:
            zf.write(path, path.relative_to(ROOT).as_posix())
    return archive


def main():
    try:
        manifest = load_manifest()
        files = collect_files()
        verify_references(manifest, files)
        archive = build(manifest, files)
    except PackagingError as error:
        print(f"エラー: {error}", file=sys.stderr)
        return 1

    print(f"{archive.relative_to(ROOT)} を作成しました\n")
    for path in files:
        print(f"  {path.relative_to(ROOT).as_posix():<42} {path.stat().st_size:>7,} bytes")
    print(f"\n  {len(files)} ファイル / ZIP {archive.stat().st_size:,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
