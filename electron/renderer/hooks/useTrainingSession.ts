import { useState, useEffect, useRef } from 'react';
import phrasesData from '../lib/training_phrases.json';
import { useAudioProcessing } from './useAudioProcessing';

export interface Phrase {
  category: string;
  text: string;
}

export const useTrainingSession = (profileId: string) => {
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'recording' | 'uploading' | 'validating' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const statusRef = useRef(status);
  const isRecordingRef = useRef(isRecording);

  const { resampleAndConvertToWav } = useAudioProcessing();

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

        const res = await fetch(`http://127.0.0.1:${port}/training/profiles/${profileId}/progress`);
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

  const startRecording = async () => {
    if (progress >= 100 || currentIndex >= phrases.length) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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

  const currentPhraseText = phrases[currentIndex]?.text;

  const handleStop = async () => {
    setStatus('uploading');
    setStatusMsg('分析中...');
    const combinedBlob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' });

    try {
      const wavBlob = await resampleAndConvertToWav(combinedBlob);

      const formData = new FormData();
      formData.append('phrase', currentPhraseText);
      formData.append('audio', wavBlob, 'recording.wav');
      formData.append('profile_id', profileId);

      const settings = await window.electronAPI.getSettings();
      const port = settings.electron?.port || 8676;

      const response = await fetch(`http://127.0.0.1:${port}/training/record`, {
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

  return {
    phrases,
    currentIndex,
    isRecording,
    progress,
    status,
    statusMsg,
    currentPhrase: phrases[currentIndex],
    statusRef,
    isRecordingRef,
    startRecording,
    stopRecording
  };
};
