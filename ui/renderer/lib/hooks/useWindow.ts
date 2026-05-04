import { useCallback } from 'react';
import { api } from '../api';
import type { Rect, OpResult } from '../bridge';

export function useWindow() {
  const resizeWindow = useCallback((width: number, height: number): void => {
    api.resizeWindow(width, height);
  }, []);

  const setResizable = useCallback((resizable: boolean): void => {
    api.setResizable(resizable);
  }, []);

  const closeWindow = useCallback((): void => {
    api.closeWindow();
  }, []);

  const getWindowBounds = useCallback((): Promise<Rect | null> => {
    return api.getWindowBounds();
  }, []);

  const saveWindowBounds = useCallback((type: 'user' | 'ai'): Promise<OpResult> => {
    return api.saveWindowBounds(type);
  }, []);

  const getAvatarWindowBounds = useCallback((type: 'user' | 'ai'): Promise<Rect | null> => {
    return api.getAvatarWindowBounds(type);
  }, []);

  return { resizeWindow, setResizable, closeWindow, getWindowBounds, saveWindowBounds, getAvatarWindowBounds };
}
