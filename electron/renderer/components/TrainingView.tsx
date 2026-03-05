import React, { useEffect } from 'react';
import { useTrainingSession } from '../hooks/useTrainingSession';
import './TrainingView.css';

interface TrainingViewProps {
  profileId?: string;
}

export const TrainingView: React.FC<TrainingViewProps> = ({ profileId: propProfileId }) => {
  const profileId = propProfileId || 'default';
  const {
    phrases,
    currentIndex,
    isRecording,
    progress,
    status,
    statusMsg,
    currentPhrase,
    statusRef,
    isRecordingRef,
    startRecording,
    stopRecording
  } = useTrainingSession(profileId);

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
  }, [startRecording, stopRecording, statusRef, isRecordingRef]);

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
    </div>
  );
};
