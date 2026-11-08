"""Build the plugin ZIP and an offline Pengu+Sona installer from pinned inputs."""
import argparse
import hashlib
import json
import shutil
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest().upper()


def write_zip(directory, destination):
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(directory.rglob('*')):
            if path.is_file():
                archive.write(path, path.relative_to(directory).as_posix())


def package(pengu_zip, output):
    vendor = json.loads((ROOT / 'installer/vendor.json').read_text(encoding='utf-8'))
    if sha256(pengu_zip) != vendor['pengu']['sha256']:
        raise ValueError('Official Pengu ZIP SHA256 does not match the pinned artifact')
    version = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
    output.mkdir(parents=True, exist_ok=True)
    bundle = output / f'Sona_{version}_Windows一键安装'
    if bundle.exists():
        raise FileExistsError(f'Use a new output directory; will not overwrite {bundle}')
    bundle.mkdir()
    plugin = bundle / 'sona'
    plugin.mkdir()
    for name in ['index.js', 'index.css']:
        shutil.copy2(ROOT / 'dist' / name, plugin / name)
    shutil.copytree(ROOT / 'assets', plugin / 'assets')
    if (ROOT / 'dist/assets').is_dir():
        shutil.copytree(ROOT / 'dist/assets', plugin / 'assets', dirs_exist_ok=True)
    shutil.copy2(ROOT / 'LICENSE', plugin / 'LICENSE')
    shutil.copy2(ROOT / 'README_个人版.md', plugin / 'README.md')
    shutil.copy2(ROOT / 'AKARI评分说明.md', bundle / 'AKARI评分说明.md')
    for source, target in [('installer/INSTALL.md', '安装说明.md'), ('installer/THIRD_PARTY_NOTICES.md', '第三方项目与许可.md'), ('README.md', 'Sona功能介绍.md'), ('installer/vendor.json', 'vendor.json')]:
        shutil.copy2(ROOT / source, bundle / target)
    # BOM is necessary for Chinese messages in Windows PowerShell 5.1.
    ps_text = (ROOT / 'installer/Install-Sona.ps1').read_text(encoding='utf-8-sig')
    (bundle / 'Install-Sona.ps1').write_text(ps_text, encoding='utf-8-sig', newline='\r\n')
    cmd_text = (ROOT / 'installer/Install.cmd').read_text(encoding='utf-8')
    (bundle / '一键安装.cmd').write_text(cmd_text, encoding='utf-8', newline='\r\n')
    (bundle / '安装说明.txt').write_text((ROOT / 'installer/INSTALL.md').read_text(encoding='utf-8'), encoding='utf-8-sig', newline='\r\n')
    loader = bundle / 'PenguLoader'
    loader.mkdir()
    with zipfile.ZipFile(pengu_zip) as archive:
        files = [item for item in archive.infolist() if not item.is_dir()]
        for item in files:
            name = PurePosixPath(item.filename.replace('\\', '/'))
            if name.is_absolute() or '..' in name.parts or len(name.parts) != 1:
                raise ValueError(f'Unexpected path in official Pengu ZIP: {item.filename}')
        if {item.filename for item in files} != set(vendor['pengu']['files']):
            raise ValueError('Official Pengu file list changed')
        for item in files:
            (loader / item.filename).write_bytes(archive.read(item))
    shutil.copy2(ROOT / 'installer/licenses/PenguLoader-MIT.txt', loader / 'LICENSE.txt')
    manifest = {'schema': 1, 'version': version, 'penguVersion': vendor['pengu']['version'], 'penguZipSha256': vendor['pengu']['sha256'], 'files': []}
    for file in sorted(bundle.rglob('*')):
        if file.is_file():
            manifest['files'].append({'path': file.relative_to(bundle).as_posix(), 'sha256': sha256(file)})
    (bundle / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    all_in_one = output / f'sona-v{version}-one-click-windows.zip'
    write_zip(bundle, all_in_one)
    plugin_only = output / f'sona-v{version}.zip'
    with zipfile.ZipFile(plugin_only, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(plugin.rglob('*')):
            if file.is_file():
                archive.write(file, 'sona/' + file.relative_to(plugin).as_posix())
        archive.write(ROOT / 'AKARI评分说明.md', 'AKARI评分说明.md')
    (output / 'SHA256SUMS.txt').write_text(''.join(f'{sha256(file)}  {file.name}\n' for file in [all_in_one, plugin_only]), encoding='utf-8')
    print(json.dumps({'version': version, 'bundle': str(bundle), 'files': len(manifest['files']), 'archives': [str(all_in_one), str(plugin_only)]}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--pengu-zip', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    package(args.pengu_zip.resolve(), args.output.resolve())
