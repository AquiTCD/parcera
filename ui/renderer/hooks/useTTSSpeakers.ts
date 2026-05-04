import useSWR from 'swr';

export const useLocalSpeakers = (provider: string, url: string | undefined) => {
  const shouldFetch = (provider === 'aivisspeech' || provider === 'voicevox') && url;

  const { data: speakersInfo, error: speakersError, isValidating: isFetchingTTS, mutate: retrySpeakers } = useSWR(
    shouldFetch ? ['speakers', url] : null,
    async ([_, fetchUrl]) => {
      const res = await fetch(`${fetchUrl}/speakers`);
      if (!res.ok) throw new Error('エンジンに接続できません');
      const data = await res.json();
      return data.flatMap((speaker: any) =>
        speaker.styles.map((style: any) => ({
          id: style.id,
          name: speaker.name,
          styleName: style.name
        }))
      );
    },
    { revalidateOnFocus: false, errorRetryCount: 1 }
  );

  return { speakersInfo, speakersError, isFetchingTTS, retrySpeakers };
};

export const useGoogleVoices = (provider: string, apiKey: string | undefined) => {
  const shouldFetch = provider === 'google' && !!apiKey;

  const { data: googleVoices, error: googleError, isValidating: isFetchingGoogleVoice, mutate: retryGoogle } = useSWR(
    shouldFetch ? ['googleVoices', apiKey] : null,
    async ([_, key]) => {
      const res = await fetch(`https://texttospeech.googleapis.com/v1/voices?key=${key}`);
      if (!res.ok) throw new Error('API要求に失敗しました。キーを確認してください');
      const data = await res.json();
      if (!data.voices) throw new Error('音声一覧が取得できませんでした');
      return data.voices.filter((v: any) => v.name.includes('ja-JP')).map((v: any) => ({
        id: v.name,
        gender: v.ssmlGender.replace('SSML_VOICE_GENDER_', '')
      }));
    },
    { revalidateOnFocus: false, errorRetryCount: 1 }
  );

  return { googleVoices, googleError, isFetchingGoogleVoice, retryGoogle };
};
