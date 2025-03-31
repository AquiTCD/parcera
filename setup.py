from setuptools import setup, find_packages

setup(
    name="parcera",
    version="0.1",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[
        "pyinstaller==6.5.0",
        "pyaudio==0.2.14",
        "numpy==1.26.4",
        "faster-whisper==0.10.0",
    ],
)
