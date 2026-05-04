from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Dict, Any, Literal

# --- Sub-Models ---

class GeminiConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    model: str = Field(default="gemini-2.0-flash")
    api_key: str = Field(default="")
    temperature: float = Field(default=1.0)
    persist_history: bool = Field(default=False)

class OpenAIConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    model: str = Field(default="gpt-4o")
    api_key: str = Field(default="")
    temperature: float = Field(default=1.0)
    persist_history: bool = Field(default=False)

class LocalLLMConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    model: str = Field(default="mlx-community/gemma-2-9b-it-4bit")
    temperature: float = Field(default=0.8)
    max_tokens: int = Field(default=100)
    repetition_penalty: float = Field(default=1.1)
    repetition_context_size: int = Field(default=20)
    adapter_path: Optional[str] = Field(default=None)
    persist_history: bool = Field(default=False)

class LLMProviders(BaseModel):
    model_config = ConfigDict(extra="allow")
    gemini: GeminiConfig = Field(default_factory=GeminiConfig)
    openai: OpenAIConfig = Field(default_factory=OpenAIConfig)
    local: LocalLLMConfig = Field(default_factory=LocalLLMConfig)

class LLMSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    provider: str = Field(default="gemini")
    providers: LLMProviders = Field(default_factory=LLMProviders)

class STTDictionary(BaseModel):
    model_config = ConfigDict(extra="allow")
    specific_keywords: List[str] = Field(default_factory=list)

class FasterWhisperConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    model: str = Field(default="longisland3/kotoba-whisper-v2.2-faster")
    device: str = Field(default="cpu")
    compute_type: str = Field(default="int8")
    whisper_vad_filter: bool = Field(default=False)

class GoogleSTTConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    api_key: str = Field(default="")
    language: str = Field(default="ja-JP")

class AzureSTTConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    api_key: str = Field(default="")
    region: str = Field(default="japaneast")
    language: str = Field(default="ja-JP")

class STTProviders(BaseModel):
    model_config = ConfigDict(extra="allow")
    faster_whisper: FasterWhisperConfig = Field(default_factory=FasterWhisperConfig)
    google: GoogleSTTConfig = Field(default_factory=GoogleSTTConfig)
    azure: AzureSTTConfig = Field(default_factory=AzureSTTConfig)

class STTSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    provider: str = Field(default="moonshine")
    ignore_sentences: List[str] = Field(default_factory=list)
    dictionary: STTDictionary = Field(default_factory=STTDictionary)
    providers: STTProviders = Field(default_factory=STTProviders)

class TTSGlobalSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    speedScale: float = Field(default=1.0)
    pitchScale: float = Field(default=0.0)
    intonationScale: float = Field(default=1.0)
    tempoDynamicsScale: float = Field(default=1.0)
    volumeScale: float = Field(default=1.0)
    prePhonemeLength: float = Field(default=0.1)
    postPhonemeLength: float = Field(default=0.1)

class AivisSpeechConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    api_url: str = Field(default="http://127.0.0.1:10101")
    engine_path: str = Field(default="/Applications/AivisSpeech.app/Contents/Resources/AivisSpeech-Engine/run")
    style_id: int = Field(default=0)

class VoicevoxConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    api_url: str = Field(default="http://127.0.0.1:50021")
    engine_path: str = Field(default="/Applications/VOICEVOX.app/Contents/Resources/vv-engine/run")
    speaker_id: int = Field(default=3)

class GoogleTTSConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    api_key: str = Field(default="")
    language: str = Field(default="ja-JP")
    voice: str = Field(default="ja-JP-Neural2-B")
    speaking_rate: float = Field(default=1.0)
    pitch: float = Field(default=0.0)
    volume_gain_db: float = Field(default=0.0)

class TTSProviders(BaseModel):
    model_config = ConfigDict(extra="allow")
    aivisspeech: AivisSpeechConfig = Field(default_factory=AivisSpeechConfig)
    voicevox: VoicevoxConfig = Field(default_factory=VoicevoxConfig)
    google: GoogleTTSConfig = Field(default_factory=GoogleTTSConfig)

class TTSSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    provider: str = Field(default="aivisspeech")
    settings: TTSGlobalSettings = Field(default_factory=TTSGlobalSettings)
    providers: TTSProviders = Field(default_factory=TTSProviders)

class VADSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    volume_db_threshold: float = Field(default=-20.0)
    silence_duration_threshold: float = Field(default=0.4)
    max_duration: float = Field(default=15.0)
    start_muted: bool = Field(default=False)

class WindowSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    width: int = Field(default=400)
    height: int = Field(default=400)
    x: int = Field(default=0)
    y: int = Field(default=0)
    alwaysOnTop: bool = Field(default=False)
    locked: bool = Field(default=False)
    control_corner: str = Field(default="bottom-right")

class AppWindows(BaseModel):
    model_config = ConfigDict(extra="allow")
    ai: WindowSettings = Field(default_factory=WindowSettings)
    user: WindowSettings = Field(default_factory=WindowSettings)

class AppSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    port: int = Field(default=8676)
    ai_audio_sample_rate: int = Field(default=16000)
    gpu_acceleration: bool = Field(default=True)
    mic_device_id: str = Field(default="default")
    windows: AppWindows = Field(default_factory=AppWindows)

class AvatarCharConfig(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str = Field(default="AI")
    assets_dir: str = Field(default="/assets/ai")
    flip_horizontal: bool = Field(default=False)
    chroma_key_enabled: bool = Field(default=False)
    chroma_key_color: str = Field(default="green")

class AvatarsSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    show_debug: bool = Field(default=False)
    breathe_scale: float = Field(default=1.008)
    breathe_amplitude: float = Field(default=3.0)
    breathe_duration: float = Field(default=4500.0)
    user: AvatarCharConfig = Field(default_factory=AvatarCharConfig)
    ai: AvatarCharConfig = Field(default_factory=AvatarCharConfig)

class AIProfileSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str = Field(default="パルセラ")
    species: str = Field(default="ダークエルフ")
    gender: str = Field(default="女性")
    personality: str = Field(default="")
    tone: str = Field(default="")
    first_person: str = Field(default="あたし")
    hobbies: str = Field(default="")

class UserProfileSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str = Field(default="アキ")
    calling: str = Field(default="アキさん")
    gender: str = Field(default="男性")
    mode: str = Field(default="soliloquy")

class TwitchSettings(BaseModel):
    model_config = ConfigDict(extra="allow")
    enabled: bool = Field(default=False)
    client_id: str = Field(default="")
    client_secret: str = Field(default="")
    wake_word: str = Field(default="パルセラ|Parcera")
    ng_words: List[str] = Field(default_factory=list)
    ignored_users: List[str] = Field(default_factory=list)
    response_speed: str = Field(default="natural")

# --- Root Configuration Model ---

class ParceraSettings(BaseModel):
    """Root model for application settings representing settings.yaml"""
    model_config = ConfigDict(extra="allow")

    # Global Settings
    verbose: bool = Field(default=False)
    profile_mode: bool = Field(default=False)
    simple_log: bool = Field(default=True)
    log_level: str = Field(default="INFO")
    
    # Pipeline Settings
    merge_request_threshold: float = Field(default=0.6)
    response_sensitivity: str = Field(default="medium")
    force_keywords: List[str] = Field(default_factory=list)

    # Component Configs
    llm: LLMSettings = Field(default_factory=LLMSettings)
    stt: STTSettings = Field(default_factory=STTSettings)
    tts: TTSSettings = Field(default_factory=TTSSettings)
    vad: VADSettings = Field(default_factory=VADSettings)
    app: AppSettings = Field(default_factory=AppSettings)
    avatars: AvatarsSettings = Field(default_factory=AvatarsSettings)
    
    # Profiles & Knowledge
    ai_profile: AIProfileSettings = Field(default_factory=AIProfileSettings)
    user_profile: UserProfileSettings = Field(default_factory=UserProfileSettings)
    knowledge: str = Field(default="")
    
    # Integrations
    twitch: TwitchSettings = Field(default_factory=TwitchSettings)
