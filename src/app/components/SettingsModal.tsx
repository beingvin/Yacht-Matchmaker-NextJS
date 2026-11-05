'use client';

import React, { useState } from 'react';
import { X, Copy, Check, RefreshCw, Trash2, Shield, Sparkles, Download, Ship } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onResetUserId: () => void;
  totalSessions: number;
  onClearAllHistory: () => void;
  onExportChats?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  userId,
  onResetUserId,
  totalSessions,
  onClearAllHistory,
  onExportChats,
}) => {
  const [copied, setCopied] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  if (!isOpen) return null;

  const handleCopyUserId = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl transition-all sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-amber-300 shadow-md">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900">Concierge Settings</h2>
              <p className="text-xs text-zinc-500">Manage your luxury charter profile and preferences</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="mt-5 space-y-4">
          {/* User Session ID */}
          <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/80 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <Shield className="h-3.5 w-3.5 text-zinc-600" />
                Browser-linked Guest ID
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700">
                Local profile
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500 leading-relaxed">
              Your chat history is associated with this guest ID. It is not a password or sign-in credential, so avoid sharing it publicly.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={userId || 'Loading...'}
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 font-mono text-xs text-zinc-700 select-all outline-none focus:border-zinc-400"
              />
              <button
                type="button"
                onClick={handleCopyUserId}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-xs transition hover:bg-zinc-50 hover:border-zinc-300"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-medium">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-zinc-500" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Reset your Guest ID? This will start a fresh session profile.')) {
                    onResetUserId();
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-600 shadow-xs transition hover:bg-zinc-50 hover:text-zinc-900"
                title="Reset session ID"
              >
                <RefreshCw className="h-3.5 w-3.5 text-zinc-500" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Concierge Agent Info */}
          <div className="rounded-xl border border-zinc-200/90 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                AI Concierge Specification
              </span>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                LangGraph JS
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-zinc-50 p-2.5">
                <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Concierge Persona</span>
                <span className="font-medium text-zinc-800">Ariel (Executive Charter)</span>
              </div>
              <div className="rounded-lg bg-zinc-50 p-2.5">
                <span className="block text-[10px] text-zinc-400 uppercase font-semibold">Supported Harbors</span>
                <span className="font-medium text-zinc-800">Goa & Mumbai Coast</span>
              </div>
            </div>
          </div>

          {/* History Management */}
          <div className="rounded-xl border border-zinc-200/90 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Session Storage
              </span>
              <span className="text-xs font-medium text-zinc-600">
                {totalSessions} {totalSessions === 1 ? 'charter session' : 'charter sessions'}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              {onExportChats && (
                <button
                  type="button"
                  onClick={onExportChats}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
                >
                  <Download className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Export JSON</span>
                </button>
              )}

              {!isConfirmingClear ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingClear(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                >
                  <Trash2 className="h-3.5 w-3.5 text-zinc-500" />
                  <span>Clear All History</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-red-600">Permanently delete?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllHistory();
                      setIsConfirmingClear(false);
                      onClose();
                    }}
                    className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClear(false)}
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-600 transition hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-6 flex justify-end border-t border-zinc-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-xs font-medium text-white transition hover:bg-zinc-800 shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
