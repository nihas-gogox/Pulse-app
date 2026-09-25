import { useEffect } from 'react';
import { Platform } from 'react-native';
import type { KeypadKey } from './keypad';

export interface UsePhysicalKeypadInputOptions {
  enabled: boolean;
  onKey: (key: KeypadKey) => void;
  onSubmit?: () => void;
  onClose?: () => void;
  allowDecimal?: boolean;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

function numpadDigit(key: string): KeypadKey | null {
  if (!key.startsWith('Numpad') || key.length !== 7) return null;
  const digit = key.slice(6);
  return /^[0-9]$/.test(digit) ? (digit as KeypadKey) : null;
}

/**
 * Maps physical keyboard / numpad keys to on-screen keypad presses (web only).
 */
export function usePhysicalKeypadInput({
  enabled,
  onKey,
  onSubmit,
  onClose,
  allowDecimal = true,
}: UsePhysicalKeypadInputOptions): void {
  useEffect(() => {
    if (!enabled || Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const handler = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const { key } = event;

      if (key === 'Enter' || key === 'NumpadEnter') {
        if (onSubmit) {
          event.preventDefault();
          onSubmit();
        }
        return;
      }

      if (key === 'Escape') {
        if (onClose) {
          event.preventDefault();
          onClose();
        }
        return;
      }

      if (key === 'Backspace' || key === 'Delete') {
        event.preventDefault();
        onKey('⌫');
        return;
      }

      if (
        allowDecimal &&
        (key === '.' || key === 'Decimal' || key === 'NumpadDecimal')
      ) {
        event.preventDefault();
        onKey('.');
        return;
      }

      if (/^[0-9]$/.test(key)) {
        event.preventDefault();
        onKey(key as KeypadKey);
        return;
      }

      const digit = numpadDigit(key);
      if (digit) {
        event.preventDefault();
        onKey(digit);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [allowDecimal, enabled, onClose, onKey, onSubmit]);
}
