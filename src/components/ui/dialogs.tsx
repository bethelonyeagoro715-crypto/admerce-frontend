'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  MdWarning,
  MdInfoOutline,
  MdCheckCircle,
  MdErrorOutline,
} from 'react-icons/md';

// ─── Public types ─────────────────────────────────────────────────
export type DialogKind = 'info' | 'warning' | 'danger' | 'success';

export interface ConfirmOptions {
  title: string;
  body?: string;
  kind?: DialogKind;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface AlertOptions {
  title: string;
  body?: string;
  kind?: DialogKind;
  confirmLabel?: string;
}

export interface PromptOptions {
  title: string;
  body?: string;
  kind?: DialogKind;
  placeholder?: string;
  defaultValue?: string;
  multiline?: boolean;
  required?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface QueueItem {
  id: number;
  type: 'confirm' | 'alert' | 'prompt';
  options: ConfirmOptions | AlertOptions | PromptOptions;
  resolve: (value: unknown) => void;
}

// ─── Module-level queue ───────────────────────────────────────────
let queue: QueueItem[] = [];
const listeners = new Set<() => void>();
let idCounter = 0;

function notify() {
  listeners.forEach((l) => l());
}

function enqueue(item: QueueItem) {
  queue.push(item);
  notify();
}

function dequeue() {
  queue = queue.slice(1);
  notify();
}

// ─── Public API ───────────────────────────────────────────────────
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    enqueue({
      id: ++idCounter,
      type: 'confirm',
      options,
      resolve: (v) => resolve(v === true),
    });
  });
}

export function alertDialog(options: AlertOptions): Promise<void> {
  return new Promise((resolve) => {
    enqueue({
      id: ++idCounter,
      type: 'alert',
      options,
      resolve: () => resolve(),
    });
  });
}

export function promptDialog(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    enqueue({
      id: ++idCounter,
      type: 'prompt',
      options,
      resolve: (v) => resolve(typeof v === 'string' ? v : null),
    });
  });
}

// ─── Kind → visual treatment ──────────────────────────────────────
const KIND_META: Record<
  DialogKind,
  {
    icon: React.ReactNode;
    bg: string;
    border: string;
    gradient: string;
    shadow: string;
  }
> = {
  info: {
    icon: <MdInfoOutline size={26} color="#0504AA" />,
    bg: '#EEF0FF',
    border: '#C7CCFF',
    gradient: 'linear-gradient(135deg, #0504AA 0%, #3D3BFF 100%)',
    shadow: '0 8px 20px rgba(5,4,170,0.24)',
  },
  warning: {
    icon: <MdWarning size={26} color="#B45309" />,
    bg: '#FEF3C7',
    border: '#FDE68A',
    gradient: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)',
    shadow: '0 8px 20px rgba(217,119,6,0.24)',
  },
  danger: {
    icon: <MdErrorOutline size={26} color="#B91C1C" />,
    bg: '#FEF2F2',
    border: '#FECACA',
    gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
    shadow: '0 8px 20px rgba(220,38,38,0.24)',
  },
  success: {
    icon: <MdCheckCircle size={26} color="#065F46" />,
    bg: '#ECFDF5',
    border: '#A7F3D0',
    gradient: 'linear-gradient(135deg, #16A34A 0%, #22C55E 100%)',
    shadow: '0 8px 20px rgba(22,163,74,0.24)',
  },
};

// ─── Dialog host ──────────────────────────────────────────────────
function DialogHost() {
  const [items, setItems] = useState<QueueItem[]>(queue);
  const [inputState, setInputState] = useState<{
    item: QueueItem;
    value: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const listener = () => setItems([...queue]);
    listeners.add(listener);
    // Re-read queue in case something was pushed between render and effect.
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const current = items[0] ?? null;
  const inputValue =
    current?.type === 'prompt'
      ? inputState?.item === current
        ? inputState.value
        : ((current.options as PromptOptions).defaultValue ?? '')
      : '';

  // Reset the input whenever a new prompt opens and autofocus it.
  useEffect(() => {
    if (current?.type === 'prompt') {
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [current]);

  const finish = useCallback(
    (result: unknown) => {
      if (!current) return;
      current.resolve(result);
      dequeue();
    },
    [current],
  );

  // Keyboard shortcuts: Esc = cancel/close, Enter = confirm/submit.
  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (current.type === 'alert') finish(undefined);
        else if (current.type === 'prompt') finish(null);
        else finish(false);
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        if (current.type === 'alert') {
          finish(undefined);
        } else if (current.type === 'confirm') {
          finish(true);
        } else if (current.type === 'prompt') {
          const opts = current.options as PromptOptions;
          if (!opts.required || inputValue.trim()) finish(inputValue);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, inputValue, finish]);

  if (!current) return null;

  const opts = current.options as ConfirmOptions & AlertOptions & PromptOptions;
  const kind: DialogKind =
    opts.kind ?? (current.type === 'alert' ? 'info' : 'warning');
  const meta = KIND_META[kind];

  const isConfirm = current.type === 'confirm';
  const isAlert = current.type === 'alert';
  const isPrompt = current.type === 'prompt';

  const promptOpts = current.options as PromptOptions;
  const confirmLabel =
    opts.confirmLabel ?? (isPrompt ? 'Submit' : isAlert ? 'Got it' : 'Confirm');
  const cancelLabel = opts.cancelLabel ?? 'Cancel';
  const submitDisabled = isPrompt && promptOpts.required && !inputValue.trim();

  const overlay = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={() => {
        if (isAlert) finish(undefined);
        else if (isPrompt) finish(null);
        else finish(false);
      }}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 11, 26, 0.55)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          backgroundColor: '#FFFFFF',
          borderRadius: 22,
          padding: '26px 24px 20px',
          boxShadow: '0 24px 60px rgba(15,23,42,0.24)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: 62,
            height: 62,
            borderRadius: 20,
            backgroundColor: meta.bg,
            border: `1px solid ${meta.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          {meta.icon}
        </div>

        <h3
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: '#0B0B1A',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
          }}
        >
          {opts.title}
        </h3>

        {opts.body && (
          <p
            style={{
              fontSize: 14,
              color: '#5A6178',
              marginTop: 10,
              lineHeight: 1.55,
              maxWidth: 320,
              whiteSpace: 'pre-line',
              margin: '10px 0 0',
            }}
          >
            {opts.body}
          </p>
        )}

        {isPrompt && (
          <div style={{ width: '100%', marginTop: 16 }}>
            {promptOpts.multiline ? (
              <textarea
                ref={(el) => {
                  inputRef.current = el;
                }}
                value={inputValue}
                onChange={(e) =>
                  setInputState({ item: current, value: e.target.value })
                }
                placeholder={promptOpts.placeholder}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1.5px solid #E6E8F0',
                  backgroundColor: '#FAFAFC',
                  fontSize: 14,
                  color: '#0B0B1A',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  lineHeight: 1.5,
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#C7CCFF';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E6E8F0';
                  e.currentTarget.style.backgroundColor = '#FAFAFC';
                }}
              />
            ) : (
              <input
                ref={(el) => {
                  inputRef.current = el;
                }}
                type="text"
                value={inputValue}
                onChange={(e) =>
                  setInputState({ item: current, value: e.target.value })
                }
                placeholder={promptOpts.placeholder}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: '1.5px solid #E6E8F0',
                  backgroundColor: '#FAFAFC',
                  fontSize: 14,
                  color: '#0B0B1A',
                  outline: 'none',
                  fontFamily: 'inherit',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#C7CCFF';
                  e.currentTarget.style.backgroundColor = '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#E6E8F0';
                  e.currentTarget.style.backgroundColor = '#FAFAFC';
                }}
              />
            )}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 22,
            width: '100%',
          }}
        >
          {!isAlert && (
            <button
              type="button"
              onClick={() => {
                if (isPrompt) finish(null);
                else finish(false);
              }}
              style={{
                flex: 1,
                padding: '13px 16px',
                borderRadius: 14,
                border: '1px solid #E6E8F0',
                backgroundColor: '#FFFFFF',
                color: '#5A6178',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F6F7FB';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
              }}
            >
              {cancelLabel}
            </button>
          )}

          <button
            type="button"
            disabled={submitDisabled}
            onClick={() => {
              if (isAlert) finish(undefined);
              else if (isPrompt) finish(inputValue);
              else finish(true);
            }}
            style={{
              flex: isAlert ? 1 : 1.4,
              padding: '13px 16px',
              borderRadius: 14,
              border: 'none',
              background: meta.gradient,
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 700,
              cursor: submitDisabled ? 'not-allowed' : 'pointer',
              opacity: submitDisabled ? 0.5 : 1,
              fontFamily: 'inherit',
              boxShadow: submitDisabled ? 'none' : meta.shadow,
              transition: 'transform 0.15s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              if (submitDisabled) return;
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}

// ─── Auto-mount the host once, on first import (client-only) ──────
let hostRoot: Root | null = null;
let hostContainer: HTMLDivElement | null = null;

function ensureHost() {
  if (typeof document === 'undefined') return;
  if (hostContainer) return;
  hostContainer = document.createElement('div');
  hostContainer.id = '__app_dialog_host__';
  document.body.appendChild(hostContainer);
  hostRoot = createRoot(hostContainer);
  hostRoot.render(<DialogHost />);
}

if (typeof window !== 'undefined') {
  ensureHost();
}