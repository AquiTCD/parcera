# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

datas = []
binaries = []
# 必要なモジュールを明示的に指定
hiddenimports = [
    'appdirs',
    'queue',
    'numpy',
    'pyaudio',
    'threading',
    'asyncio',
    'faster_whisper',
    'ctranslate2',
    'tokenizers',
    'huggingface_hub'
]

# アプリケーションの全モジュールを収集
tmp_ret = collect_all('app.audio')
datas += tmp_ret[0]
binaries += tmp_ret[1]
hiddenimports += tmp_ret[2]

# 必要なバイナリを明示的に含める
try:
    # PyAudioのバイナリ
    import pyaudio
    import os
    pa_path = os.path.dirname(pyaudio.__file__)
    pa_lib = os.path.join(pa_path, '_portaudio.dylib')
    print(f"Looking for PortAudio at: {pa_lib}")
    if os.path.exists(pa_lib):
        print("PortAudio library found")
        binaries.append((pa_lib, '.'))
    else:
        print("PortAudio library not found")

    # CTranslate2のバイナリ
    import ctranslate2
    ct2_path = os.path.dirname(ctranslate2.__file__)
    for f in os.listdir(ct2_path):
        if f.endswith('.so') or f.endswith('.dylib'):
            print(f"Found CTranslate2 library: {f}")
            binaries.append((os.path.join(ct2_path, f), '.'))
        print("PortAudio library found")  # デバッグ出力
        binaries.append((pa_lib, '.'))
    else:
        print("PortAudio library not found")  # デバッグ出力
except ImportError as e:
    print(f"Error importing PyAudio: {e}")  # デバッグ出力
    pass


a = Analysis(
    ['src/main.py'],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='Parcera',
    debug=True,  # デバッグモードを有効化
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch='arm64',
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='Parcera',
)
app = BUNDLE(
    coll,
    name='Parcera.app',
    icon=None,
    bundle_identifier='com.aquitcd.parcera',
    info_plist={
        'LSBackgroundOnly': False,
        'CFBundleName': 'Parcera',
        'CFBundleDisplayName': 'Parcera',
        'CFBundleIdentifier': 'com.aquitcd.parcera',
        'CFBundleVersion': '1.0.0',
        'CFBundleShortVersionString': '1.0.0',
        'NSHighResolutionCapable': True,
        'LSMultipleInstancesProhibited': True,
        'NSMicrophoneUsageDescription': 'このアプリは音声認識のためにマイクを使用します。',
    },
)
