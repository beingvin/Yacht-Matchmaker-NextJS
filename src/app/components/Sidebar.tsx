'use client';

import React, { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import {
  Ship,
  Plus,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Trash2,
  Edit3,
  Pin,
  PinOff,
  MoreVertical,
  Check,
  X,
  Compass,
  Sparkles,
} from 'lucide-react';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'agent';
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  backendSessionId?: string;
  messages: Message[];
  isPinned?: boolean;
}

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (session: ChatSession) => void;
  onRenameSession: (sessionId: string, newTitle: string) => void;
  onTogglePinSession: (sessionId: string) => void;
  onOpenSettings: () => void;
  onSelectQuickPrompt?: (prompt: string) => void;
}

const formatChatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const subscribeToMount = () => () => {};
const getClientMountSnapshot = () => true;
const getServerMountSnapshot = () => false;

const hasItineraryProposal = (session: ChatSession): boolean => {
  return session.messages.some((msg) => {
    if (msg.sender !== 'agent') return false;
    const lower = msg.text.toLowerCase();
    return (
      lower.includes('booking summary') ||
      lower.includes('curated charter itinerary') ||
      lower.includes('itinerary overview') ||
      lower.includes('glimpse of luxury')
    );
  });
};

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  isOpen,
  onToggleOpen,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onTogglePinSession,
  onOpenSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenuSessionId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStartRename = (session: ChatSession) => {
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
    setActiveMenuSessionId(null);
  };

  const handleSaveRename = (sessionId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      onRenameSession(sessionId, trimmed);
    }
    setEditingSessionId(null);
  };

  const mounted = useSyncExternalStore(
    subscribeToMount,
    getClientMountSnapshot,
    getServerMountSnapshot
  );

  // Group sessions by date
  const groupSessions = () => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? sessions.filter(
          (s) =>
            s.title.toLowerCase().includes(query) ||
            s.messages.some((m) => m.text.toLowerCase().includes(query))
        )
      : sessions;

    const pinned: ChatSession[] = [];
    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const previous7Days: ChatSession[] = [];
    const older: ChatSession[] = [];

    if (!mounted) {
      for (const session of filtered) {
        if (session.isPinned) {
          pinned.push(session);
        } else {
          today.push(session);
        }
      }
      return { filtered, pinned, today, yesterday, previous7Days, older };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const sevenDaysStart = todayStart - 6 * 86400000;

    for (const session of filtered) {
      if (session.isPinned) {
        pinned.push(session);
        continue;
      }
      const sessionTime = new Date(session.createdAt).getTime();
      if (sessionTime >= todayStart) {
        today.push(session);
      } else if (sessionTime >= yesterdayStart) {
        yesterday.push(session);
      } else if (sessionTime >= sevenDaysStart) {
        previous7Days.push(session);
      } else {
        older.push(session);
      }
    }

    return { filtered, pinned, today, yesterday, previous7Days, older };
  };

  const { pinned, today, yesterday, previous7Days, older } = groupSessions();

  const renderSessionItem = (session: ChatSession) => {
    const isActive = session.id === activeSessionId;
    const isEditing = editingSessionId === session.id;
    const isMenuOpen = activeMenuSessionId === session.id;
    const hasProposal = hasItineraryProposal(session);

    return (
      <div key={session.id} className="relative group">
        <div
          className={`flex items-center rounded-xl transition ${
            isActive
              ? 'bg-white border border-zinc-200/90 shadow-xs'
              : 'hover:bg-zinc-200/60'
          }`}
        >
          {isEditing ? (
            <div className="flex flex-1 items-center gap-1.5 p-1.5">
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRename(session.id);
                  if (e.key === 'Escape') setEditingSessionId(null);
                }}
                autoFocus
                className="w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-500"
              />
              <button
                type="button"
                onClick={() => handleSaveRename(session.id)}
                className="rounded-md p-1 text-zinc-700 hover:bg-zinc-100"
                title="Save title"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditingSessionId(null)}
                className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onSelectSession(session.id)}
                className={`min-w-0 flex-1 px-3 py-2 text-left text-[13px] tracking-tight ${
                  isActive ? 'font-medium text-zinc-900' : 'text-zinc-600'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {session.isPinned && (
                    <Pin className="h-3 w-3 shrink-0 text-amber-600 fill-amber-600" />
                  )}
                  {hasProposal && (
                    <span
                      title="Charter proposal curated in this chat"
                      className="inline-flex shrink-0 items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-medium text-amber-700 border border-amber-200/70"
                    >
                      Proposal
                    </span>
                  )}
                  <span className="truncate">{session.title}</span>
                </div>
                <time className="mt-0.5 block text-[10px] font-normal text-zinc-400">
                  {formatChatDate(session.createdAt)}
                </time>
              </button>

              {/* Action Menu Trigger Button */}
              <div className="relative mr-1.5 flex items-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveMenuSessionId(isMenuOpen ? null : session.id);
                  }}
                  className={`rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-800 ${
                    isMenuOpen
                      ? 'opacity-100 bg-zinc-100 text-zinc-800'
                      : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
                  }`}
                  aria-label="Chat options"
                  title="Options"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </button>

                {/* Dropdown Menu */}
                {isMenuOpen && (
                  <div
                    ref={menuRef}
                    className="absolute right-0 top-7 z-30 w-44 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onTogglePinSession(session.id);
                        setActiveMenuSessionId(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      {session.isPinned ? (
                        <>
                          <PinOff className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Unpin Charter</span>
                        </>
                      ) : (
                        <>
                          <Pin className="h-3.5 w-3.5 text-zinc-500" />
                          <span>Pin Charter</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartRename(session)}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 hover:bg-zinc-50"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-zinc-500" />
                      <span>Rename</span>
                    </button>
                    <div className="my-1 border-t border-zinc-100" />
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteSession(session);
                        setActiveMenuSessionId(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      <span>Delete Chat</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderGroup = (title: string, groupList: ChatSession[]) => {
    if (groupList.length === 0) return null;
    return (
      <div key={title} className="mb-4">
        <h3 className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
          {title}
        </h3>
        <div className="space-y-0.5">{groupList.map(renderSessionItem)}</div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          onClick={onToggleOpen}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-zinc-200/90 bg-zinc-50/95 backdrop-blur-md transition-transform duration-300 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
      >
        {/* Top Header */}
        <div className="flex h-16 items-center justify-between border-b border-zinc-200/80 px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-amber-300 shadow-sm">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-semibold tracking-tight text-zinc-900 block leading-tight">
                Yacht Matchmaker - Lite
              </span>
              <span className="text-[10px] text-zinc-400 font-medium tracking-wide uppercase">
                LangGraph Concierge
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleOpen}
            className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-200/60 hover:text-zinc-700"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Action: New Chat & Search */}
        <div className="p-3 space-y-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-3.5 py-2.5 text-xs font-medium text-white shadow-sm transition hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
            <span>New Charter Inquire</span>
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search charters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-200/90 bg-white pl-8 pr-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 outline-none transition focus:border-zinc-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Chat History Grouping */}
        <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
          {sessions.length === 0 ? (
            <div className="p-4 text-center">
              <Compass className="mx-auto h-7 w-7 text-zinc-300" />
              <p className="mt-2 text-xs text-zinc-400">No charter inquiries yet</p>
            </div>
          ) : (
            <>
              {renderGroup('Pinned', pinned)}
              {renderGroup('Today', today)}
              {renderGroup('Yesterday', yesterday)}
              {renderGroup('Previous 7 Days', previous7Days)}
              {renderGroup('Older', older)}
            </>
          )}
        </div>

        {/* Footer / Settings */}
        <div className="border-t border-zinc-200/80 p-3">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex w-full items-center justify-between rounded-xl p-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200/60 hover:text-zinc-900"
          >
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-zinc-500" />
              <span>Concierge Settings</span>
            </div>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
          </button>
        </div>
      </aside>
    </>
  );
};
