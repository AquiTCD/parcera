import React, { useEffect } from 'react';
import { state } from '../lib/state';
import type { AvatarType } from '../lib/state';
import { useAvatar } from '../lib/hooks/useAvatar';
import { api } from '../lib/api';

// Initialize global state.avatarType immediately upon module execution
const params = new URLSearchParams(window.location.search);
state.avatarType = (params.get('type') as AvatarType) || 'user';
if (state.avatarType === 'ai') {
  document.title = 'Parcera - AI';
} else if (state.avatarType === 'user') {
  document.title = 'Parcera - User';
}

export const Avatar: React.FC = () => {
  // In Tauri/WKWebView, `body { -webkit-app-region: drag }` swallows all mouse events
  // (including :hover), even on children with -webkit-app-region: no-drag.
  // Mark the body so CSS can opt out, letting Tauri's data-tauri-drag-region handle dragging.
  useEffect(() => {
    if (api.platform === 'tauri') {
      document.body.classList.add('tauri-mode');
      return () => { document.body.classList.remove('tauri-mode'); };
    }
  }, []);

  const {
    avatarImageRef,
    statusDebugRef,
    visible,
    viewMode,
    isLocked,
    isMuted,
    isFlipped,
    mode,
    controlCorner,
    handleImageError,
    toggleMute,
    toggleMode,
    toggleLock,
    sensitivity,
    setSensitivity,
  } = useAvatar();

  return (
    <>
      <div
        className={`avatar-container ${!visible ? 'hidden' : ''} ${viewMode === 'wide' ? 'wide-view' : ''}`}
        data-testid="avatar-container"
        {...(api.platform === 'tauri' && !isLocked ? { 'data-tauri-drag-region': '' } : {})}
      >
        <img
          ref={avatarImageRef}
          id="avatar-image"
          className={`avatar-main ${isFlipped ? 'flipped' : ''}`}
          onError={handleImageError}
          draggable={false}
        />
        <div
          ref={statusDebugRef}
          id="status-debug"
          style={{
            position: 'fixed',
            bottom: '4px',
            left: '4px',
            color: 'white',
            background: 'rgba(0,0,0,0.75)',
            padding: '2px 5px',
            borderRadius: '4px',
            fontSize: '9px',
            pointerEvents: 'none',
            zIndex: 100,
            fontFamily: 'monospace',
            whiteSpace: 'pre',
          }}
        >
          Initializing...
        </div>

        <div className="controls-wrapper" data-corner={controlCorner}>
          <button
            className={`control-button ${isLocked ? 'active' : ''}`}
            onClick={toggleLock}
            title={isLocked ? "移動ロックを解除" : "位置をロック"}
            data-testid="lock-button"
          >
            {isLocked ? '🔒' : '🔓'}
          </button>

          {state.avatarType === 'ai' && (
            <>
              <div className="sensitivity-selector">
                {(['low', 'medium', 'high'] as const).map((level) => (
                  <button
                    key={level}
                    className={`sensitivity-button ${sensitivity === level ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSensitivity(level);
                    }}
                    title={`反応感度: ${level}`}
                  >
                    {level === 'low' ? 'L' : level === 'medium' ? 'M' : 'H'}
                  </button>
                ))}
              </div>
              <button
                className={`control-button ${mode === 'conversation' ? 'active' : ''}`}
                onClick={toggleMode}
                style={{ fontSize: '14px' }}
                title={mode === 'conversation' ? "対話モード (おしゃべり中)" : "独り言モード (見守り中)"}
              >
                {mode === 'conversation' ? '💬' : '👁️'}
              </button>
            </>
          )}

          {state.avatarType === 'user' && (
            <button
              className={`control-button ${isMuted ? 'active' : ''}`}
              onClick={toggleMute}
              title={isMuted ? "マイクはミュートされています" : "マイクはオンです"}
            >
              {isMuted ? '🔇' : '🎤'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};
