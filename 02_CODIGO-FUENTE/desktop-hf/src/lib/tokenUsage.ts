// v1.5.3 — Token usage context + hook for footer display.
// Acumula IN/OUT/TOTAL por chat activo (no global de sesión).
// Cada respuesta del agente aporta usage.prompt_tokens / usage.completion_tokens.

import { useState, useCallback, useEffect } from 'react';

export interface TokenUsage {
  in: number;
  out: number;
  total: number;
}

export interface TokenUsageByChat {
  [chatId: string]: TokenUsage;
}

const STORAGE_KEY = 'letxinet:token-usage-v1';

function loadStored(): TokenUsageByChat {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) return JSON.parse(raw) as TokenUsageByChat;
  } catch { /* noop */ }
  return {};
}

function persist(data: TokenUsageByChat) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch { /* noop */ }
}

export function useTokenUsage() {
  const [byChat, setByChat] = useState<TokenUsageByChat>(() => loadStored());

  // Persist on every change
  useEffect(() => {
    persist(byChat);
  }, [byChat]);

  const addTokens = useCallback((chatId: string, inputTokens: number, outputTokens: number) => {
    if (!chatId) return;
    setByChat(prev => {
      const current = prev[chatId] || { in: 0, out: 0, total: 0 };
      const updated: TokenUsage = {
        in: current.in + (inputTokens || 0),
        out: current.out + (outputTokens || 0),
        total: current.total + (inputTokens || 0) + (outputTokens || 0),
      };
      return { ...prev, [chatId]: updated };
    });
  }, []);

  const resetChat = useCallback((chatId: string) => {
    setByChat(prev => {
      if (!prev[chatId]) return prev;
      const next = { ...prev };
      delete next[chatId];
      return next;
    });
  }, []);

  const getForChat = useCallback((chatId: string | null): TokenUsage => {
    if (!chatId) return { in: 0, out: 0, total: 0 };
    return byChat[chatId] || { in: 0, out: 0, total: 0 };
  }, [byChat]);

  return { addTokens, resetChat, getForChat };
}
