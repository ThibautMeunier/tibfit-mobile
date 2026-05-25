import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { getPlans, getSeances } from '../services/api';
import { Seance } from '../types';

type GenerationStatus = 'idle' | 'generating' | 'done' | 'error';

interface GenerationState {
  status: GenerationStatus;
  planId: number | null;
  startedAt: number | null;
  seances: Seance[];
}

interface GenerationContextValue extends GenerationState {
  startGeneration: () => void;
  completeGeneration: (planId: number) => void;
  failGeneration: () => void;
  resetGeneration: () => void;
}

const GenerationContext = createContext<GenerationContextValue | null>(null);

const INITIAL: GenerationState = {
  status: 'idle',
  planId: null,
  startedAt: null,
  seances: [],
};

export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GenerationState>(INITIAL);
  const appState = useRef(AppState.currentState);

  const startGeneration = useCallback(() => {
    setState({ status: 'generating', planId: null, startedAt: Date.now(), seances: [] });
  }, []);

  const completeGeneration = useCallback(async (planId: number) => {
    try {
      const seances = await getSeances(planId);
      setState({ status: 'done', planId, startedAt: null, seances });
    } catch {
      setState(prev => ({ ...prev, status: 'done', planId, startedAt: null }));
    }
  }, []);

  const failGeneration = useCallback(() => {
    setState(prev => ({ ...prev, status: 'error' }));
  }, []);

  const resetGeneration = useCallback(() => {
    setState(INITIAL);
  }, []);

  // Au retour au premier plan, vérifie si un plan a été créé pendant l'absence
  useEffect(() => {
    const sub = AppState.addEventListener('change', async (next: AppStateStatus) => {
      const prev = appState.current;
      appState.current = next;

      if (next === 'active' && prev !== 'active') {
        setState(current => {
          if (current.status !== 'generating' || current.startedAt === null) return current;
          // Lance la vérification async sans bloquer le setState
          const startedAt = current.startedAt;
          (async () => {
            try {
              const plans = await getPlans();
              const recent = plans[0];
              if (recent && new Date(recent.created_at).getTime() >= startedAt - 60_000) {
                const seances = await getSeances(recent.id);
                setState({ status: 'done', planId: recent.id, startedAt: null, seances });
              }
            } catch { /* ignore */ }
          })();
          return current;
        });
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <GenerationContext.Provider value={{ ...state, startGeneration, completeGeneration, failGeneration, resetGeneration }}>
      {children}
    </GenerationContext.Provider>
  );
}

export function useGeneration() {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error('useGeneration must be used inside GenerationProvider');
  return ctx;
}
