import React, { useState, useEffect, useRef, useCallback } from 'react';
import phrasesData from '../lib/training_phrases.json';

interface Phrase {
  category: string;
  text: string;
}

interface TrainingViewProps {
  profileId?: string;
}

export const TrainingView: React.FC<TrainingViewProps> = ({ profileId: propProfileId }) => {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'validating' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');
  const [profileId] = useState(propProfileId || 'default');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const statusRef = useRef(status);
  const isRecordingRef = useRef(isRecording);

  // Sync refs for event listeners
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);

  useEffect(() => {
    let port = 8676;
    const init = async () => {
      const flatPhrases = phrasesData.flatMap(cat =>
        cat.phrases.map(text => ({ category: cat.category, text }))
      );
      setPhrases(flatPhrases);

      try {
        const settings = await window.electronAPI.getSettings();
        port = settings.electron?.port || 8676;

        const res = await fetch(`http://localhost:${port}/training/profiles/${profileId}/progress`);
        const data = await res.json();
        if (data.progress !== undefined) {
          const startIdx = Math.min(data.progress, flatPhrases.length);
          setCurrentIndex(startIdx);
          setProgress((startIdx / flatPhrases.length) * 100);
        }
      } catch (err) {
        console.error('Failed to init training window:', err);
      }
    };
    init();

    return () => {
      // Ensure AI is unmuted when leaving
      window.electronAPI.setTrainingMode(false, port);
    };
  }, [profileId]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (statusRef.current === 'idle' || statusRef.current === 'success' || statusRef.current === 'error') {
          if (!isRecordingRef.current) {
            startRecording();
          } else {
            stopRecording();
          }
        } else if (statusRef.current === 'recording') {
          stopRecording();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startRecording = async () => {
    if (progress >= 100 || currentIndex >= phrases.length) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      //...

      const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
      const mimeType = types.find(t => MediaRecorder.isTypeSupported(t));

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = handleStop;
      mediaRecorder.start();
      setIsRecording(true);

      // Mute AI when recording starts
      const settings = await window.electronAPI.getSettings();
      const port = settings.electron?.port || 8676;
      await window.electronAPI.setTrainingMode(true, port);

      setStatus('recording');
      setStatusMsg('録音中...');
    } catch (err) {
      console.error('Failed to start recording:', err);
      setStatus('error');
      setStatusMsg('マイクへのアクセスに失敗しました。');
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecordingRef.current) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);

      // Unmute AI when recording stops
      const settings = await window.electronAPI.getSettings();
      const port = settings.electron?.port || 8676;
      await window.electronAPI.setTrainingMode(false, port);
    }
  };

  const handleStop = async () => {
    setStatus('uploading');
    setStatusMsg('分析中...');
    const combinedBlob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });
    const currentPhraseText = phrases[currentIndex].text;

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const arrayBuffer = await combinedBlob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const targetSampleRate = 16000;
      const offlineCtx = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * targetSampleRate), targetSampleRate);
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start();

      const renderedBuffer = await offlineCtx.startRendering();
      const wavBlob = audioBufferToWav(renderedBuffer);
      await audioCtx.close();

      const formData = new FormData();
      formData.append('phrase', currentPhraseText);
      formData.append('audio', wavBlob, 'recording.wav');
      formData.append('profile_id', profileId);

      const settings = await window.electronAPI.getSettings();
      const port = settings.electron?.port || 8676;

      const response = await fetch(`http://localhost:${port}/training/record`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        if (result.validation?.valid) {
          setStatus('success');
          setStatusMsg('成功！✨');
          setTimeout(() => {
            nextPhrase();
            setStatus('idle');
            setStatusMsg('');
          }, 600);
        } else {
          setStatus('error');
          setStatusMsg('音声が不明瞭です。もう一度録音してください。');
        }
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setStatus('error');
      setStatusMsg('通信エラーが発生しました。');
    }
  };

  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = 1;
    const sampleRate = buffer.sampleRate;
    const format = 1;
    const bitDepth = 16;
    const data = buffer.getChannelData(0);
    const wavBuffer = new ArrayBuffer(44 + data.length * 2);
    const view = new DataView(wavBuffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + data.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, data.length * 2, true);
    let offset = 44;
    for (let i = 0; i < data.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  };

  const nextPhrase = () => {
    if (currentIndex < phrases.length - 1) {
      setCurrentIndex(prev => {
        const next = prev + 1;
        setProgress((next / phrases.length) * 100);
        return next;
      });
    } else {
      setStatusMsg('すべての特訓が完了しました！✨');
      setProgress(100);
    }
  };

  const currentPhrase = phrases[currentIndex];

  return (
    <div className="training-embed-container">
      <div className="training-card">
        <div className="training-header">
          <span className="category-badge">{currentPhrase?.category}</span>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">{currentIndex + 1} / {phrases.length}</span>
        </div>

        <div className="phrase-display">
          <h2 className={status === 'recording' ? 'pulse' : ''}>
            {currentIndex < phrases.length ? currentPhrase?.text : 'すべての特訓が完了しました！✨'}
          </h2>
        </div>

        <div className="training-controls">
          <div className="control-fixed-area">
            {progress < 100 && currentIndex < phrases.length ? (
              <>
                {!isRecording ? (
                  <button
                    className="record-btn start"
                    onClick={startRecording}
                    disabled={status === 'uploading'}
                  >
                    <span className="icon">🎤</span> 録音開始
                  </button>
                ) : (
                  <button className="record-btn stop" onClick={stopRecording}>
                    <span className="icon">⏹</span> ストップ
                  </button>
                )}
                <div className="shortcut-hint">Space / Enter でも操作できます</div>
              </>
            ) : (
              <button
                className="record-btn done"
                onClick={() => window.location.reload()}
              >
                🏠 特訓を終了する
              </button>
            )}
          </div>
        </div>

        <div className="status-container">
          {statusMsg && (
            <div className={`status-message ${status}`}>
              {statusMsg}
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .training-embed-container {
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding: 20px;
          color: white;
          font-family: 'Inter', 'Noto Sans JP', sans-serif;
        }
        .training-card {
          width: 100%;
          max-width: 500px;
          min-height: 400px;
          background: #111;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          border: 1px solid #222;
        }
        .training-header {
          display: flex;
          align-items: center;
          gap: 15px;
          height: 30px;
          margin-bottom: 20px;
        }
        .category-badge {
          background: #4fc1ff;
          color: #000;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
        }
        .progress-bar-bg {
          flex: 1;
          height: 4px;
          background: #222;
          border-radius: 2px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #4fc1ff, #a155ff);
          transition: width 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .progress-text {
          font-size: 12px;
          color: #666;
          font-variant-numeric: tabular-nums;
        }
        .phrase-display {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 20px 0;
        }
        .phrase-display h2 {
          font-size: 28px;
          font-weight: 700;
          line-height: 1.5;
          margin: 0;
          word-break: break-word;
        }
        .pulse {
          animation: pulse-red 1.5s infinite;
        }
        @keyframes pulse-red {
          0% { opacity: 1; }
          50% { opacity: 0.5; color: #ff4f4f; }
          100% { opacity: 1; }
        }
        .training-controls {
          height: 100px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .control-fixed-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .record-btn {
          width: 220px;
          height: 56px;
          border-radius: 28px;
          font-size: 18px;
          font-weight: 800;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .record-btn.start {
          background: #4fc1ff;
          color: #000;
          box-shadow: 0 4px 15px rgba(79, 193, 255, 0.3);
        }
        .record-btn.start:hover:not(:disabled) {
          background: #7dd3ff;
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(79, 193, 255, 0.4);
        }
        .record-btn.stop {
          background: #ff4f4f;
          color: #fff;
          animation: btn-pulse 2s infinite;
        }
        @keyframes btn-pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 79, 79, 0.4); }
          70% { box-shadow: 0 0 0 15px rgba(255, 79, 79, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 79, 79, 0); }
        }
        .record-btn.done {
          background: #4fff8d;
          color: #000;
          box-shadow: 0 4px 15px rgba(79, 255, 141, 0.3);
        }
        .record-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          filter: grayscale(1);
        }
        .shortcut-hint {
          font-size: 10px;
          color: #444;
          letter-spacing: 0.05em;
        }
        .status-container {
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .status-message {
          font-size: 13px;
          font-weight: 600;
        }
        .status-message.success { color: #4fff8d; }
        .status-message.error { color: #ff4f4f; }
        .status-message.recording { color: #ff4f4f; }
        .status-message.uploading { color: #888; }
      `}} />
    </div>
  );
};
