import { create } from 'zustand';

/**
 * Extracted from Runbook 2.3 & 2.26: Avatar Morph Controls + FSM
 * State machine for controlling avatar expressions and poses (blink, smile, talking, idle).
 */
export type FSMState = {
  blink: boolean;
  smile: boolean;
  talking: boolean;
  setState: (key: 'blink' | 'smile' | 'talking', value: boolean, autoResetMs?: number) => void;
};

export const useAvatarFSM = create<FSMState>((set) => ({
  blink: false,
  smile: false,
  talking: false,
  
  setState: (key, value, autoResetMs) => {
    set({ [key]: value });
    
    // Optional timed decay (e.g., auto-back to idle in 1s)
    if (value && autoResetMs) {
      setTimeout(() => set({ [key]: false }), autoResetMs);
    }
  }
}));
