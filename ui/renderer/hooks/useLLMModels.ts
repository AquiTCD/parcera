import useSWR from 'swr';

export const useLLMModels = (provider: string, apiKey: string | undefined) => {
  const shouldFetch = apiKey && (provider === 'gemini' || provider === 'openai');

  const { data: models, error, isValidating: isFetchingModels, mutate: retryModels } = useSWR(
    shouldFetch ? ['models', provider, apiKey] : null,
    async ([_, prov, key]) => {
      if (prov === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!res.ok) throw new Error('API要求に失敗しました。キーを確認してください');
        const data = await res.json();
        return data.models.map((m: any) => m.name.replace('models/', ''));
      } else {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` }
        });
        if (!res.ok) throw new Error('API要求に失敗しました。キーを確認してください');
        const data = await res.json();
        return data.data.map((m: any) => m.id);
      }
    },
    { revalidateOnFocus: false, errorRetryCount: 1 }
  );

  return { models, error, isFetchingModels, retryModels };
};
