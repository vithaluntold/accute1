import { useState, useCallback, useRef } from "react";

interface UndoState<T> {
  action: string;
  data: T;
  timestamp: number;
}

export function useUndo<T = any>(duration: number = 5000) {
  const [undoState, setUndoState] = useState<UndoState<T> | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const confirmCallbackRef = useRef<((data: T) => void) | null>(null);
  const undoCallbackRef = useRef<((data: T) => void) | null>(null);

  const scheduleAction = useCallback(
    (
      action: string,
      data: T,
      onConfirm: (data: T) => void,
      onUndo?: (data: T) => void
    ) => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      const state: UndoState<T> = {
        action,
        data,
        timestamp: Date.now(),
      };

      setUndoState(state);
      setShowUndo(true);
      confirmCallbackRef.current = onConfirm;
      undoCallbackRef.current = onUndo || null;

      // Auto-confirm after duration
      timeoutRef.current = setTimeout(() => {
        confirmCallbackRef.current?.(state.data);
        setShowUndo(false);
        setUndoState(null);
      }, duration);
    },
    [duration]
  );

  const undo = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (undoState && undoCallbackRef.current) {
      undoCallbackRef.current(undoState.data);
    }

    setShowUndo(false);
    setUndoState(null);
  }, [undoState]);

  const confirm = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (undoState && confirmCallbackRef.current) {
      confirmCallbackRef.current(undoState.data);
    }

    setShowUndo(false);
    setUndoState(null);
  }, [undoState]);

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setShowUndo(false);
    setUndoState(null);
  }, []);

  return {
    undoState,
    showUndo,
    scheduleAction,
    undo,
    confirm,
    cancel,
  };
}
