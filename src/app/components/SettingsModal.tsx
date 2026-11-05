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
        className="relative w-full max-w-lg rounded-xl border border-[#3b3b42] bg-[#222226] p-5 shadow-2xl transition-all sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#38383e] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#19191c]">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#ededf0]">Concierge Settings</h2>
              <p className="text-xs text-[#92929b]">Manage your charter profile and preferences</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-[#777780] transition hover:bg-[#303036] hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="mt-5 space-y-4">
          {/* User Session ID */}
          <div className="rounded-lg border border-[#38383e] bg-[#252529] p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#a2a2ab]">
                <Shield className="h-3.5 w-3.5 text-[#92929b]" />
                Browser-linked Guest ID
              </span>
              <span className="rounded-md bg-[#303036] px-2 py-0.5 text-[10px] font-semibold text-[#c5c5cc]">
                Local profile
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[#92929b]">
              Your chat history is associated with this guest ID. It is not a password or sign-in credential, so avoid sharing it publicly.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={userId || 'Loading...'}
                className="min-w-0 flex-1 rounded-md border border-[#3b3b42] bg-[#202024] px-3 py-1.5 font-mono text-xs text-[#c5c5cc] select-all outline-none focus:border-white"
              />
              <button
                type="button"
                onClick={handleCopyUserId}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#3b3b42] bg-[#2a2a30] px-3 py-1.5 text-xs font-medium text-[#c5c5cc] transition hover:bg-[#34343a]"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="font-medium text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-[#92929b]" />
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
                className="inline-flex items-center gap-1.5 rounded-md border border-[#3b3b42] bg-[#2a2a30] px-2.5 py-1.5 text-xs font-medium text-[#a2a2ab] transition hover:bg-[#34343a] hover:text-white"
                title="Reset session ID"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#92929b]" />
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Concierge Agent Info */}
          <div className="rounded-lg border border-[#38383e] bg-[#252529] p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#a2a2ab]">
                <Sparkles className="h-3.5 w-3.5 text-[#d4d4d8]" />
                AI Concierge Specification
              </span>
              <span className="rounded-md bg-[#303036] px-2 py-0.5 text-[10px] font-medium text-[#c5c5cc]">
                LangGraph JS
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-md bg-[#202024] p-2.5">
                <span className="block text-[10px] font-semibold uppercase text-[#777780]">Concierge Persona</span>
                <span className="font-medium text-[#e7e7e9]">Ariel (Executive Charter)</span>
              </div>
              <div className="rounded-md bg-[#202024] p-2.5">
                <span className="block text-[10px] font-semibold uppercase text-[#777780]">Supported Harbors</span>
                <span className="font-medium text-[#e7e7e9]">Goa & Mumbai Coast</span>
              </div>
            </div>
          </div>

          {/* History Management */}
          <div className="rounded-lg border border-[#38383e] bg-[#252529] p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#a2a2ab]">
                Session Storage
              </span>
              <span className="text-xs font-medium text-[#a2a2ab]">
                {totalSessions} {totalSessions === 1 ? 'charter session' : 'charter sessions'}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              {onExportChats && (
                <button
                  type="button"
                  onClick={onExportChats}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#3b3b42] bg-[#2a2a30] px-3 py-1.5 text-xs font-medium text-[#c5c5cc] transition hover:bg-[#34343a]"
                >
                  <Download className="h-3.5 w-3.5 text-[#92929b]" />
                  <span>Export JSON</span>
                </button>
              )}

              {!isConfirmingClear ? (
                <button
                  type="button"
                  onClick={() => setIsConfirmingClear(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#3b3b42] bg-[#2a2a30] px-3 py-1.5 text-xs font-medium text-[#a2a2ab] transition hover:border-red-900 hover:bg-red-950/40 hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5 text-[#92929b]" />
                  <span>Clear All History</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-red-400">Permanently delete?</span>
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
                    className="rounded-md border border-[#3b3b42] bg-[#2a2a30] px-2 py-1 text-xs text-[#a2a2ab] transition hover:bg-[#34343a] hover:text-white"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="mt-5 flex justify-end border-t border-[#38383e] pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white px-4 py-2 text-xs font-medium text-[#19191c] transition hover:bg-[#e7e7e9]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
