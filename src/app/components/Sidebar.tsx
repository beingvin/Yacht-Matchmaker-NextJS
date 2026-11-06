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
  Loader2,
  RotateCw,
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
  isLoadingSessions: boolean;
  sessionsError: string | null;
  onRetrySessions: () => void;
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
  isLoadingSessions,
  sessionsError,
  onRetrySessions,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuSessionId, setActiveMenuSessionId] = useState<string | null>(null);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  const closeDrawerOnMobile = () => {
    if (window.matchMedia('(max-width: 767px)').matches) {
      onToggleOpen();
    }
  };

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
              ? 'bg-[#29292e] border border-[#38383e]'
              : 'hover:bg-[#252529]'
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
                className="w-full rounded-md border border-[#45454c] bg-[#202024] px-2 py-1 text-xs text-[#e7e7e9] outline-none focus:border-white"
              />
              <button
                type="button"
                onClick={() => handleSaveRename(session.id)}
                className="rounded-md p-1 text-[#a2a2ab] hover:bg-[#303036] hover:text-white"
                title="Save title"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setEditingSessionId(null)}
                className="rounded-md p-1 text-[#777780] hover:bg-[#303036] hover:text-white"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  onSelectSession(session.id);
                  closeDrawerOnMobile();
                }}
                className={`min-h-11 min-w-0 flex-1 px-3 py-2 text-left text-[13px] tracking-tight ${
                  isActive ? 'font-medium text-[#e7e7e9]' : 'text-[#a2a2ab]'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {session.isPinned && (
                    <Pin className="h-3 w-3 shrink-0 text-amber-600 fill-amber-600" />
                  )}
                  {hasProposal && (
                    <span
                      title="Charter proposal curated in this chat"
                      className="inline-flex shrink-0 items-center rounded-md border border-[#45454c] bg-[#303036] px-1.5 py-0.5 text-[9.5px] font-medium text-[#d4d4d8]"
                    >
                      Proposal
                    </span>
                  )}
                  <span className="truncate">{session.title}</span>
                </div>
                <time className="mt-0.5 block text-[10px] font-normal text-[#777780]">
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
                  className={`rounded-md p-1.5 text-[#777780] transition hover:bg-[#303036] hover:text-white ${
                    isMenuOpen
                      ? 'opacity-100 bg-[#303036] text-white'
                      : 'opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus:opacity-100'
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
                    className="absolute right-0 top-7 z-30 w-44 rounded-lg border border-[#3b3b42] bg-[#252529] p-1.5 shadow-xl animate-in fade-in zoom-in-95 duration-150"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onTogglePinSession(session.id);
                        setActiveMenuSessionId(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[#c5c5cc] hover:bg-[#303036]"
                    >
                      {session.isPinned ? (
                        <>
                          <PinOff className="h-3.5 w-3.5 text-[#92929b]" />
                          <span>Unpin Charter</span>
                        </>
                      ) : (
                        <>
                          <Pin className="h-3.5 w-3.5 text-[#92929b]" />
                          <span>Pin Charter</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStartRename(session)}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-[#c5c5cc] hover:bg-[#303036]"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-[#92929b]" />
                      <span>Rename</span>
                    </button>
                    <div className="my-1 border-t border-[#38383e]" />
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteSession(session);
                        setActiveMenuSessionId(null);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-950/40"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-400" />
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
        <h3 className="mb-1.5 px-3 text-[10px] font-semibold tracking-wider text-[#777780] uppercase">
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
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(18rem,calc(100vw-1rem))] flex-col border-r border-[#34343a] bg-[#19191c] pb-[env(safe-area-inset-bottom)] transition-transform duration-300 sm:w-64 md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:hidden'
        }`}
      >
        {/* Top Header */}
        <div className="flex h-14 items-center justify-between border-b border-[#303036] px-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#19191c] shadow-sm">
              <Ship className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-[13px] font-semibold tracking-tight leading-tight text-[#e7e7e9]">
                Yacht Matchmaker - Lite
              </span>
              <span className="text-[9px] font-medium uppercase tracking-wide text-[#777780]">
                Private Charter Concierge
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleOpen}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#777780] transition hover:bg-[#29292e] hover:text-[#e7e7e9]"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        {/* Action: New Chat & Search */}
        <div className="space-y-2 p-2.5">
          <button
            type="button"
            onClick={() => {
              onNewChat();
              closeDrawerOnMobile();
            }}
            className="flex min-h-9 w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-xs font-medium text-[#19191c] transition hover:bg-[#e7e7e9]"
          >
            <Plus className="h-4 w-4" />
            <span>New Charter Inquire</span>
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#777780]" />
            <input
              type="text"
              placeholder="Search charters..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-9 w-full rounded-md border border-[#34343a] bg-[#202024] py-2 pl-8 pr-3 text-xs text-[#e7e7e9] placeholder-[#777780] outline-none transition focus:border-[#a1a1aa]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-[#777780] hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* Chat History Grouping */}
        <div className="flex-1 overflow-y-auto px-2 py-1 scrollbar-thin">
          {isLoadingSessions && sessions.length === 0 ? (
            <div className="flex items-center justify-center gap-2 p-4 text-xs text-[#777780]" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading chat history…
            </div>
          ) : sessions.length === 0 && !sessionsError ? (
            <div className="p-4 text-center">
              <Compass className="mx-auto h-7 w-7 text-[#55555e]" />
              <p className="mt-2 text-xs text-[#777780]">No charter inquiries yet</p>
            </div>
          ) : (
            <>
              {sessionsError && (
                <div
                  className="m-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
                  role="alert"
                >
                  <p>{sessionsError}</p>
                  <button
                    type="button"
                    onClick={onRetrySessions}
                    disabled={isLoadingSessions}
                    className="mt-2 inline-flex items-center gap-1.5 font-semibold hover:underline disabled:opacity-60"
                  >
                    {isLoadingSessions ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCw className="h-3 w-3" />
                    )}
                    Try again
                  </button>
                </div>
              )}
              {isLoadingSessions && sessions.length > 0 && (
                <p className="px-3 py-2 text-[11px] text-[#777780]" role="status">
                  Syncing chat history…
                </p>
              )}
              {renderGroup('Pinned', pinned)}
              {renderGroup('Today', today)}
              {renderGroup('Yesterday', yesterday)}
              {renderGroup('Previous 7 Days', previous7Days)}
              {renderGroup('Older', older)}
              {sessions.length > 0 &&
                !sessionsError &&
                !isLoadingSessions &&
                !pinned.length &&
                !today.length &&
                !yesterday.length &&
                !previous7Days.length &&
                !older.length && (
                  <p className="p-4 text-center text-xs text-[#777780]">
                    No chats match your search.
                  </p>
                )}
            </>
          )}
        </div>

        {/* Footer / Settings */}
        <div className="border-t border-[#303036] p-2.5">
          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              closeDrawerOnMobile();
            }}
            className="flex min-h-9 w-full items-center justify-between rounded-md p-2 text-xs font-medium text-[#a2a2ab] transition hover:bg-[#29292e] hover:text-[#e7e7e9]"
          >
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-[#777780]" />
              <span>Concierge Settings</span>
            </div>
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-[#24362c]" />
          </button>
        </div>
      </aside>
    </>
  );
};
