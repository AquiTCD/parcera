import React, { useState, useEffect, useCallback } from 'react';
import type { TrainingPair, ParceraSettings } from '../../../shared/types';

interface TrainingTabProps {
  settings: ParceraSettings;
  profile?: string;
}

type SubTab = 'knowledge' | 'edit' | 'adapters';

interface TrainingStats {
  total: number;
  trainable: number;
  pending: number;
  last_trained_at: string | null;
  needs_train: boolean;
  status_message: string;
  is_training: boolean;
}

export const TrainingTab: React.FC<TrainingTabProps> = ({ settings, profile: initialProfile = 'default' }) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('knowledge');
  const [currentProfile, setCurrentProfile] = useState(initialProfile);
  const [pairs, setPairs] = useState<TrainingPair[]>([]);
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [trainingStatus, setTrainingStatus] = useState<any>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempProfileName, setTempProfileName] = useState('');
  const [lastActionTime, setLastActionTime] = useState(0);

  const port = settings.electron?.port || 8676;
  const baseUrl = `http://127.0.0.1:${port}/training`;

  const fetchProfiles = useCallback(async () => {
    // Left for potential sidebar use, but currentProfile is set from outside
  }, []);

  const fetchPairs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${baseUrl}/pairs?profile=${currentProfile}`);
      const data = await res.json();
      setPairs(data);

      const statsRes = await fetch(`${baseUrl}/stats?profile=${currentProfile}`);
      const statsData = await statsRes.json();
      setStats(statsData);

      // Refresh profiles list
      fetchProfiles();
    } catch (e) {
      console.error('Failed to fetch data:', e);
    } finally {
      setLoading(false);
    }
  }, [baseUrl, currentProfile, fetchProfiles]);

  useEffect(() => {
    fetchPairs();
  }, [fetchPairs]);

  useEffect(() => {
    if (window.electronAPI.onTrainingProfileChanged) {
      const cleanup = window.electronAPI.onTrainingProfileChanged((profile: string) => {
        setCurrentProfile(profile);
      });
      return cleanup;
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const checkStatus = async () => {
      try {
        const res = await fetch(`${baseUrl}/status?profile=${currentProfile}`);
        const data = await res.json();
        setTrainingStatus(data);
        if (data.status === 'running' || data.status === 'starting') {
          timer = setTimeout(checkStatus, 3000);
        } else if (data.status === 'completed' || data.status === 'failed') {
          // Refresh stats when finished
          fetchPairs();
        }
      } catch (e) {
        console.error('Failed to fetch training status:', e);
      }
    };

    checkStatus();
    return () => clearTimeout(timer);
  }, [baseUrl, currentProfile, lastActionTime, fetchPairs]);

  const handleAddKnowledge = async () => {
    if (!input.trim()) return;
    setIsGenerating(true);
    try {
      const isUrl = input.trim().startsWith('http');
      const body = isUrl
        ? { url: input.trim(), profile: currentProfile }
        : { text: input.trim(), profile: currentProfile };

      const res = await fetch(`${baseUrl}/add-knowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setInput('');
        await fetchPairs();
        setActiveSubTab('edit');
      } else {
        const err = await res.json();
        alert(`エラー: ${err.detail}`);
      }
    } catch (e) {
      alert(`通信エラー: ${e}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: TrainingPair['status'], editedOutput?: string) => {
    try {
      await fetch(`${baseUrl}/pairs/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, edited_output: editedOutput }),
      });
      await fetchPairs();
      setEditingId(null);
    } catch (e) {
      console.error('Failed to update status:', e);
    }
  };

  const startEditing = (pair: TrainingPair) => {
    setEditingId(pair.id);
    setEditValue(pair.edited_output || pair.output);
  };

  const handleRunTraining = async () => {
    if (!currentProfile) return;

    const ok = window.confirm(
      `現在のプロファイル「${currentProfile}」で追加学習を開始しますか？\n\n` +
      `※学習中はリソース確保のため、パルセラの反応（音声・返答）は一時的に停止（ミュート）されます。\n` +
      `※完了後、自動的に復帰します。`
    );
    if (!ok) return;

    try {
      const res = await fetch(`${baseUrl}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: currentProfile, iters: 100 })
      });
      await res.json();
      setLastActionTime(Date.now());
    } catch (e) {
      alert(`エラー: ${e}`);
    }
  };

  const handleRenameProfile = async () => {
    if (!currentProfile || !tempProfileName.trim() || tempProfileName.trim() === currentProfile) {
      setIsRenaming(false);
      return;
    }

    try {
      const res = await fetch(`${baseUrl}/rename-profile?old_name=${encodeURIComponent(currentProfile)}&new_name=${encodeURIComponent(tempProfileName.trim())}`, {
        method: 'POST'
      });
      if (res.ok) {
        setCurrentProfile(tempProfileName.trim());
        if (window.electronAPI.broadcastProfilesUpdated) {
          window.electronAPI.broadcastProfilesUpdated();
        }
      } else {
        alert('名前の変更に失敗しました。');
      }
    } catch (e) {
      console.error('Rename failed:', e);
      alert('エラーが発生しました。');
    } finally {
      setIsRenaming(false);
    }
  };

  const renderNotebookEntry = (pair: TrainingPair) => {
    const isEditing = editingId === pair.id;
    return (
      <div key={pair.id} className={`notebook-entry priority-${pair.status}`}>
        <div className="entry-question">
          <span className="user-icon">👤</span> {pair.input}
        </div>
        <div className="entry-response">
          <span className="ai-icon">💙</span>
          {isEditing ? (
            <div className="edit-container">
              <textarea
                className="edit-textarea"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
              <div className="edit-actions">
                <button onClick={() => handleUpdateStatus(pair.id, 'correction', editValue)} className="btn btn-primary btn-small">保存</button>
                <button onClick={() => setEditingId(null)} className="btn btn-secondary btn-small">取消</button>
              </div>
            </div>
          ) : (
            <span className="response-text">{pair.edited_output || pair.output}</span>
          )}
        </div>
        <div className="entry-footer">
          <div className="status-badge" data-status={pair.status}>{pair.status}</div>
          <div className="entry-actions">
            <button className="act-btn ok" title="OK" onClick={() => handleUpdateStatus(pair.id, 'ok')}>✅</button>
            <button className="act-btn correction" title="修正" onClick={() => startEditing(pair)}>📝</button>
            <button className="act-btn ng" title="除外" onClick={() => handleUpdateStatus(pair.id, 'ng')}>❌</button>
            <button className="act-btn ignore" title="保持" onClick={() => handleUpdateStatus(pair.id, 'ignored')}>➖</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="settings-window training-tab">
      <div className="settings-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '14px', color: '#888' }}>追加学習 / </span>
          {isRenaming ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                autoFocus
                className="settings-input"
                style={{ width: '120px', marginBottom: 0, padding: '2px 8px', fontSize: '12px' }}
                value={tempProfileName}
                onChange={(e) => setTempProfileName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameProfile();
                  if (e.key === 'Escape') setIsRenaming(false);
                }}
              />
              <button
                className="btn btn-primary btn-small"
                style={{ padding: '2px 6px', fontSize: '10px' }}
                onClick={handleRenameProfile}
              >
                保存
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600 }}>{currentProfile}</span>
              <button
                className="btn btn-secondary btn-small"
                style={{ padding: '2px 6px', fontSize: '10px' }}
                onClick={() => {
                  setTempProfileName(currentProfile);
                  setIsRenaming(true);
                }}
              >
                名前を変更
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {stats && (
          <div className="training-stats-minimal">
            <span className={stats.needs_train ? 'text-warning' : ''}>
              OK {stats.trainable} / 全 {stats.total} 件 [{stats.status_message}]
            </span>
          </div>
        )}
      </div>

      <div className="settings-layout">
        <aside className="training-sidebar-mini">
          <div className="step-menu">
            <button
              className={`menu-item ${activeSubTab === 'knowledge' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('knowledge')}
            >
              <span className="step-num">Step 1</span>
              <span className="step-label">知識の入力</span>
            </button>
            <button
              className={`menu-item ${activeSubTab === 'edit' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('edit')}
            >
              <span className="step-num">Step 2</span>
              <span className="step-label">データの編集</span>
            </button>
            <button
              className={`menu-item ${activeSubTab === 'adapters' ? 'active' : ''}`}
              onClick={() => setActiveSubTab('adapters')}
            >
              <span className="step-num">Step 3</span>
              <span className="step-label">学習の実行</span>
              {stats?.needs_train && <span className="dot-blink-update" />}
            </button>
          </div>
        </aside>

        <main className="training-main-content">
          <div className="settings-section-desc">
            {activeSubTab === 'knowledge' && '新しい知識をテキストまたはURLから入力し、学習用データを生成します。'}
            {activeSubTab === 'edit' && '生成されたデータを編集・確認します。「OK」または「修正」済みのデータが学習に使用されます。'}
            {activeSubTab === 'adapters' && '準備されたデータを元に、AIモデルの追加学習（LoRA）を実行します。'}
          </div>

          {activeSubTab === 'knowledge' && (
            <div className="knowledge-input-area">
              <textarea
                className="setting-input knowledge-textarea"
                placeholder="新しい知識やウェブサイトのURLを入力してください..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isGenerating}
              />
              <button
                className="btn btn-primary add-knowledge-btn"
                onClick={handleAddKnowledge}
                disabled={isGenerating || !input.trim()}
              >
                {isGenerating ? 'AIが解析中...' : 'データを解析して追加'}
              </button>
            </div>
          )}

          <div className="notebook-paper">
            {loading && <div className="loading-overlay">データを読み込み中...</div>}

            {activeSubTab === 'adapters' ? (
              <div className="adapter-management-panel">
                <h3>学習の実行</h3>

                {stats?.needs_train ? (
                  <div className="training-alert-info">
                    未学習のデータが <strong>{stats.trainable}件</strong> あります。学習を開始してモデルに反映しましょう。
                  </div>
                ) : (
                  <div className="training-alert-success">
                    すべての有効なデータは学習済みです。
                  </div>
                )}

                {trainingStatus && (trainingStatus.status === 'running' || trainingStatus.status === 'starting' || trainingStatus.status === 'completed' || trainingStatus.status === 'failed') && (
                  <div className="training-progress-card">
                    <div className="progress-header">
                      <span className="status-label">
                        {trainingStatus.status === 'starting' && '処理準備中...'}
                        {trainingStatus.status === 'running' && '追加学習を実行中'}
                        {trainingStatus.status === 'completed' && '学習が正常に完了しました'}
                        {trainingStatus.status === 'failed' && 'エラーが発生しました'}
                      </span>
                      <span className="percent-label">{trainingStatus.progress}%</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div className="progress-bar-fill" style={{ width: `${trainingStatus.progress}%` }}></div>
                    </div>
                    {(trainingStatus.status === 'running' || trainingStatus.status === 'starting') && (
                      <div className="progress-stats">
                        <span>Iteration: {trainingStatus.current_iter} / {trainingStatus.total_iters}</span>
                        <span>Loss: {trainingStatus.loss?.toFixed(4) || '---'}</span>
                      </div>
                    )}
                    {trainingStatus.status === 'running' && (
                      <div className="inactive-warning-msg">
                        ⚡️ 学習中：パルセラは一時的にオフラインになります
                      </div>
                    )}
                    {trainingStatus.status === 'completed' && (
                      <p style={{ fontSize: '12px', color: '#51cf66', marginTop: '10px', textAlign: 'left' }}>
                        学習が正常に完了しました！設定を反映するには、LLM設定で該当のプロファイルを選択し直してください。
                      </p>
                    )}
                    {trainingStatus.error && (
                      <div className="training-error-msg">
                        <strong>エラー詳細:</strong><br />
                        {trainingStatus.error}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                  <button
                    className="btn btn-primary training-run-btn"
                    onClick={handleRunTraining}
                    disabled={(!pairs.some(p => p.status === 'ok' || p.status === 'correction')) || (trainingStatus?.status === 'running' || trainingStatus?.status === 'starting')}
                  >
                    {trainingStatus?.status === 'running' || trainingStatus?.status === 'starting'
                      ? '⚡️ 学習を実行しています...'
                      : '🚀 追加学習を開始する'}
                  </button>
                  {!pairs.some(p => p.status === 'ok' || p.status === 'correction') && (
                    <p style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '10px' }}>
                      ※学習可能なデータ（OK/修正済み）が1つ以上必要です。
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="pairs-list">
                {pairs.length === 0 && !loading && (
                  <p style={{ textAlign: 'center', color: '#555', marginTop: '40px' }}>
                    データが登録されていません。Step 1 で知識を入力してください。
                  </p>
                )}
                {pairs.map(renderNotebookEntry)}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
