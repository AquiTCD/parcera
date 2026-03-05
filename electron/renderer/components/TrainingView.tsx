import React, { useState, useEffect, useRef, useCallback } from 'react';
import phrasesData from '../lib/training_phrases.json';

interface Phrase {
  category: string;
  text: string;
}

export const TrainingView: React.FC = () => {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'validating' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // Flatten phrases for easier navigation
    const flatPhrases = phrasesData.flatMap(cat =>
      cat.phrases.map(text => ({ category: cat.category, text }))
    );
    setPhrases(flatPhrases);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = handleStop;
      mediaRecorder.start();
      setIsRecording(true);
      setStatus('recording');
    } catch (err) {
      console.error('Failed to start recording:', err);
      setStatus('error');
      setStatusMsg('マイクへのアクセスに失敗しました。');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      setIsRecording(false);
    }
  };

  const handleStop = async () => {
    setStatus('uploading');
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' }); // Electron/Chrome uses webm
    const currentPhrase = phrases[currentIndex].text;

    const formData = new FormData();
    formData.append('phrase', currentPhrase);
    formData.append('audio', blob, 'recording.webm');

    try {
      // Get settings to find port
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
          setTimeout(() => {
            nextPhrase();
            setStatus('idle');
          }, 800);
        } else {
          setStatus('error');
          setStatusMsg('音声が短すぎるか、無音の可能性があります。もう一度録音してください。');
        }
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setStatus('error');
      setStatusMsg('送信に失敗しました。サーバーの状態を確認してください。');
    }
  };

  const nextPhrase = () => {
    if (currentIndex < phrases.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setProgress(((currentIndex + 1) / phrases.length) * 100);
    } else {
      setStatusMsg('すべての特訓が完了しました！✨');
      setProgress(100);
    }
  };

  const currentPhrase = phrases[currentIndex];

  return (
    <div className="training-container">
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
            {currentPhrase?.text || '読み込み中...'}
          </h2>
        </div>

        <div className="training-controls">
          {!isRecording ? (
            <button
              className="record-btn start"
              onClick={startRecording}
              disabled={status === 'uploading' || progress === 100}
            >
              <span className="icon">🎤</span> 録音開始
            </button>
          ) : (
            <button className="record-btn stop" onClick={stopRecording}>
              <span className="icon">⏹</span> ストップ
            </button>
          )}
        </div>

        {statusMsg && (
          <div className={`status-message ${status}`}>
            {statusMsg}
          </div>
        )}

        {status === 'uploading' && <div className="loader">分析中...</div>}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        .training-container {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          background: #0f0f0f;
          color: white;
          font-family: 'Inter', sans-serif;
        }
        .training-card {
          width: 90%;
          max-width: 600px;
          background: #1a1a1a;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          text-align: center;
          border: 1px solid #333;
        }
        .training-header {
          display: flex;
          align-items: center;
          gap: 15px;
          margin-bottom: 40px;
        }
        .category-badge {
          background: #4fc1ff;
          color: #000;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
        }
        .progress-bar-bg {
          flex: 1;
          height: 6px;
          background: #333;
          border-radius: 3px;
          overflow: hidden;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #4fc1ff, #a155ff);
          transition: width 0.3s ease;
        }
        .progress-text {
          font-size: 14px;
          color: #888;
        }
        .phrase-display {
          min-height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 40px;
        }
        .phrase-display h2 {
          font-size: 32px;
          line-height: 1.4;
          margin: 0;
          color: #fff;
        }
        .pulse {
          animation: pulse-red 1.5s infinite;
        }
        @keyframes pulse-red {
          0% { color: #fff; }
          50% { color: #ff4f4f; }
          100% { color: #fff; }
        }
        .record-btn {
          padding: 15px 40px;
          border-radius: 30px;
          font-size: 18px;
          font-weight: bold;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s;
          margin: 0 auto;
        }
        .record-btn.start {
          background: #4fc1ff;
          color: #000;
        }
        .record-btn.start:hover {
          background: #7dd3ff;
          transform: scale(1.05);
        }
        .record-btn.stop {
          background: #ff4f4f;
          color: #fff;
        }
        .record-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .status-message {
          margin-top: 20px;
          padding: 10px;
          border-radius: 8px;
          font-size: 14px;
        }
        .status-message.error {
          background: rgba(255, 79, 79, 0.1);
          color: #ff4f4f;
          border: 1px solid #ff4f4f;
        }
        .status-message.success {
          color: #4fff8d;
        }
        .loader {
          margin-top: 20px;
          color: #888;
          font-size: 14px;
        }
      `}} />
    </div>
  );
};
