'use client';

import { useEffect, useState } from 'react';
import {
  MdClose,
  MdContentCopy,
  MdCheck,
  MdAccountBalance,
  MdRefresh,
  MdWarning,
} from 'react-icons/md';
import api from '../services/api';

export function AddMoneySheet({ onClose }: { onClose: () => void }) {
  const [details, setDetails] = useState<{
    account_number: string;
    bank_name: string;
    account_name: string;
    note: string;
    kyc_status: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await api.getFundingDetails();
      setDetails(d);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load your funding details.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      setError(null);
      try {
        const d = await api.getFundingDetails();
        if (active) setDetails(d);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not load your funding details.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const copy = async () => {
    if (!details?.account_number) return;
    try {
      await navigator.clipboard.writeText(details.account_number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="am-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="am-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="am-handle" />

        <div className="am-header">
          <h2 className="am-title">Add money</h2>
          <button className="am-close" onClick={onClose} aria-label="Close">
            <MdClose size={20} color="var(--text-tertiary)" />
          </button>
        </div>

        <p className="am-sub">
          Transfer from any Nigerian bank app into your Admerce account.
          It lands in seconds.
        </p>

        {loading ? (
          <div className="am-skeleton" />
        ) : error ? (
          <div className="am-error">
            <MdWarning size={20} color="var(--danger-fg)" />
            <div className="am-error-body">
              <span>{error}</span>
              <button className="am-retry" onClick={load}>
                <MdRefresh size={14} />
                Try again
              </button>
            </div>
          </div>
        ) : details ? (
          <>
            <div className="am-accountCard">
              <div className="am-accountIcon">
                <MdAccountBalance size={22} color="var(--brand-on-gradient)" />
              </div>
              <div className="am-accountBody">
                <span className="am-accountLabel">Your account number</span>
                <span className="am-accountNumber">
                  {details.account_number}
                </span>
                <span className="am-accountBank">{details.bank_name}</span>
                <span className="am-accountName">{details.account_name}</span>
              </div>
              <button
                className="am-copyBtn"
                onClick={copy}
                aria-label="Copy account number"
              >
                {copied ? (
                  <MdCheck size={20} color="var(--success-fg)" />
                ) : (
                  <MdContentCopy size={20} color="var(--brand-primary)" />
                )}
              </button>
            </div>

            <div className="am-note">{details.note}</div>

            {details.kyc_status && details.kyc_status !== 'verified' && (
              <div className="am-kyc">
                <MdWarning size={16} color="var(--warning-fg)" />
                <span>
                  Complete KYC on your profile to unlock the full monthly
                  limit on your wallet.
                </span>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

const CSS = `
  .am-overlay {
    position: fixed;
    inset: 0;
    background: var(--overlay);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    z-index: 200;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .am-sheet {
    width: 100%;
    max-width: 520px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border-radius: 24px 24px 0 0;
    padding: 12px 22px calc(28px + env(safe-area-inset-bottom));
    box-shadow: var(--shadow-lg);
    animation: amUp 0.28s cubic-bezier(0.22, 1, 0.36, 1);
  }
  @keyframes amUp {
    from { transform: translateY(100%); }
    to   { transform: translateY(0); }
  }
  .am-handle {
    width: 40px; height: 4px;
    background: var(--border-default);
    border-radius: 2px;
    margin: 0 auto 18px;
  }
  .am-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }
  .am-title {
    font-size: 20px; font-weight: 800;
    margin: 0; letter-spacing: -0.3px;
  }
  .am-close {
    width: 32px; height: 32px;
    border: none;
    background: var(--bg-tertiary);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
  }
  .am-sub {
    font-size: 13.5px;
    color: var(--text-tertiary);
    margin: 0 0 20px;
    line-height: 1.5;
  }
  .am-accountCard {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px;
    border-radius: 18px;
    background: var(--brand-gradient);
    color: var(--brand-on-gradient);
    box-shadow: var(--shadow-brand);
  }
  .am-accountIcon {
    width: 44px; height: 44px;
    border-radius: 14px;
    background: color-mix(in srgb, var(--brand-on-gradient) 14%, transparent);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .am-accountBody {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: 3px;
  }
  .am-accountLabel {
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--brand-on-gradient) 72%, transparent);
  }
  .am-accountNumber {
    font-size: 24px;
    font-weight: 800;
    letter-spacing: 1px;
    font-variant-numeric: tabular-nums;
    color: var(--brand-on-gradient);
  }
  .am-accountBank {
    font-size: 12.5px;
    font-weight: 700;
    color: color-mix(in srgb, var(--brand-on-gradient) 85%, transparent);
  }
  .am-accountName {
    font-size: 11.5px;
    color: color-mix(in srgb, var(--brand-on-gradient) 65%, transparent);
    word-break: break-word;
  }
  .am-copyBtn {
    width: 42px; height: 42px;
    border-radius: 12px;
    border: none;
    background: var(--bg-secondary);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 0.15s;
  }
  .am-copyBtn:active { transform: scale(0.95); }
  .am-note {
    margin-top: 14px;
    font-size: 12.5px;
    color: var(--text-tertiary);
    line-height: 1.5;
    padding-left: 4px;
  }
  .am-kyc {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-top: 14px;
    padding: 12px 14px;
    border-radius: 12px;
    background: var(--warning-bg);
    border: 1px solid var(--warning-strong);
    color: var(--warning-fg);
    font-size: 12.5px;
    line-height: 1.5;
    font-weight: 600;
  }
  .am-skeleton {
    height: 120px;
    border-radius: 18px;
    background: var(--bg-tertiary);
    animation: amPulse 1.4s ease-in-out infinite;
  }
  @keyframes amPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.55; }
  }
  .am-error {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border-radius: 14px;
    background: var(--danger-bg);
    border: 1px solid var(--danger-strong);
  }
  .am-error-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13.5px;
    color: var(--danger-fg);
    line-height: 1.5;
  }
  .am-retry {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
    padding: 6px 12px;
    border: none;
    border-radius: 8px;
    background: var(--danger-fg);
    color: #FFFFFF;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
  }
`;