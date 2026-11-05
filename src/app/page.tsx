'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Loader2,
  Ship,
  Sparkles,
  Compass,
  FileText,
  ShieldCheck,
  Receipt,
  MapPin,
  Calendar,
  Clock,
  Timer,
  Users,
  Maximize2,
  X,
  Camera,
  Copy,
  Check,
  PanelLeftOpen,
  ArrowUp,
  Anchor,
  RotateCw,
  AlertCircle,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Sidebar, ChatSession, Message } from './components/Sidebar';
import { SettingsModal } from './components/SettingsModal';

const USER_ID_KEY = 'yacht_concierge_user_id';
const SESSIONS_STORAGE_KEY = 'yacht_concierge_sessions';
const ACTIVE_SESSION_KEY = 'yacht_concierge_active_session_id';

const QUICK_PROMPTS = [
  {
    label: '🌅 Sunset in Goa (8 guests)',
    prompt: 'Plan a romantic sunset yacht cruise in Goa for 8 guests with chilled drinks and music.',
  },
  {
    label: '🎂 Birthday Party in Mumbai (15 guests)',
    prompt: 'I want to book a luxury yacht in Mumbai for a birthday party for 15 guests with catering.',
  },
  {
    label: '🥂 Corporate Sunset Charter (20 guests)',
    prompt: 'Need a corporate sunset cruise in Goa for 20 guests with catering and ambiance.',
  },
  {
    label: '🏝️ Grand Island Family Trip (8 guests)',
    prompt: 'Private yacht charter to Grand Island Goa for a family day trip of 8 people.',
  },
];

interface TraceData {
  step: string;
  icon: string;
  label: string;
}

interface ExtendedMessage extends Message {
  trace?: TraceData;
}

interface GuidedCharterDetails {
  location?: 'Goa' | 'Mumbai';
  date?: string;
  startTime?: string;
  durationHours?: number;
  guests?: number;
  occasion?: string;
}

const GUIDED_TIME_OPTIONS = [
  { label: 'Morning', value: '09:00' },
  { label: 'Afternoon', value: '13:00' },
  { label: 'Golden hour', value: '16:00' },
  { label: 'Sunset', value: '17:00' },
  { label: 'Evening', value: '19:00' },
];

const GUIDED_OCCASION_OPTIONS = [
  'Sunset cruise',
  'Birthday',
  'Anniversary',
  'Family day',
  'Corporate',
  'Just because',
];

const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getPersistentUserId = (): string => {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = generateUUID();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
};

// 1. Live Activity Trace Pill Icon resolver
const renderTraceIcon = (iconName?: string) => {
  switch (iconName) {
    case 'ship':
      return <Ship className="h-4 w-4 animate-bounce text-amber-500" />;
    case 'compass':
      return <Compass className="h-4 w-4 animate-spin text-sky-500" />;
    case 'receipt':
      return <Receipt className="h-4 w-4 text-emerald-500" />;
    case 'document':
      return <FileText className="h-4 w-4 text-indigo-500" />;
    case 'shield':
    case 'shield-check':
      return <ShieldCheck className="h-4 w-4 text-teal-500" />;
    case 'sparkles':
    default:
      return <Sparkles className="h-4 w-4 animate-pulse text-amber-400" />;
  }
};

// 2. Itinerary Badges Parser
interface ItineraryMeta {
  location?: string;
  date?: string;
  time?: string;
  duration?: string;
  guests?: string;
}

const parseItineraryMeta = (markdown: string): ItineraryMeta | null => {
  if (!markdown.includes('Booking Summary') && !markdown.includes('Curated Charter Itinerary')) {
    return null;
  }

  const meta: ItineraryMeta = {};
  const locMatch = markdown.match(/-\s*\*\*Location:\*\*\s*([^\n\r]+)/i);
  if (locMatch) meta.location = locMatch[1].trim();

  const dateMatch = markdown.match(/-\s*\*\*Date:\*\*\s*([^\n\r]+)/i);
  if (dateMatch) meta.date = dateMatch[1].trim();

  const timeMatch = markdown.match(/-\s*\*\*Time:\*\*\s*([^\n\r]+)/i);
  if (timeMatch) meta.time = timeMatch[1].trim();

  const durMatch = markdown.match(/-\s*\*\*Duration:\*\*\s*([^\n\r]+)/i);
  if (durMatch) meta.duration = durMatch[1].trim();

  const guestMatch = markdown.match(/-\s*\*\*Guests:\*\*\s*([^\n\r]+)/i);
  if (guestMatch) meta.guests = guestMatch[1].trim();

  return meta.location ? meta : null;
};

// Extract photos from markdown
const extractPhotos = (markdown: string): { alt: string; src: string }[] => {
  const photoRegex = /!\[(.*?)\]\((.*?)\)/g;
  const photos: { alt: string; src: string }[] = [];
  let match;
  while ((match = photoRegex.exec(markdown)) !== null) {
    photos.push({ alt: match[1], src: match[2] });
  }
  return photos;
};

// Helper to fix and normalize markdown tables for GFM parsing
const formatMarkdownTables = (raw: string): string => {
  if (!raw) return '';
  let text = raw.replace(/\r\n/g, '\n');

  // If table rows were collapsed with double pipes '| |', expand them into separate lines:
  text = text.replace(/\|\s*\|\s*/g, '|\n| ');

  // Ensure every table header starts with a pipe '|' if followed by a separator row
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const nextLine = (lines[i + 1] || '').trim();
    if (!line.startsWith('|') && line.includes('|') && line.endsWith('|') && nextLine.startsWith('|') && nextLine.includes('---')) {
      lines[i] = '| ' + line;
    }
  }
  text = lines.join('\n');

  // Ensure an empty line precedes the table for strict GFM parsing
  text = text.replace(/([^\n])\n(\|[^\n]+\|\n\|[\s-:]+\|)/g, '$1\n\n$2');

  return text;
};

export default function YachtConciergeApp() {
  const [userId, setUserId] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState('');
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionLoadAttempt, setSessionLoadAttempt] = useState(0);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatError, setChatError] = useState<{ sessionId: string; query: string } | null>(null);
  const [currentTrace, setCurrentTrace] = useState<TraceData | null>(null);
  const [guidedStep, setGuidedStep] = useState<number | null>(null);
  const [guidedDetails, setGuidedDetails] = useState<GuidedCharterDetails>({});
  const [customGuestCount, setCustomGuestCount] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize guest profile and restore sessions
  // This state must be initialized from browser storage after hydration to avoid server/client mismatches.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let cancelled = false;
    const persistentId = getPersistentUserId();
    setUserId(persistentId);

    // Load from local storage
    let initialSessions: ChatSession[] = [];
    try {
      const stored = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (stored) {
        initialSessions = JSON.parse(stored);
      }
    } catch {
      initialSessions = [];
    }

    if (initialSessions.length === 0) {
      const defaultId = generateUUID();
      const defaultSession: ChatSession = {
        id: defaultId,
        title: 'New Charter Inquire',
        createdAt: new Date().toISOString(),
        messages: [
          {
            id: generateUUID(),
            text: "Welcome to Yacht Matchmaker - Lite. I am Ariel, your dedicated luxury yacht charter concierge. To curate an exceptional voyage, please share your preferred location (**Goa** or **Mumbai**), date, duration, number of guests, and the celebration occasion.",
            sender: 'agent',
          },
        ],
      };
      initialSessions = [defaultSession];
    }

    const savedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY) || initialSessions[0].id;
    if (!cancelled) {
      setSessions(initialSessions);
      setActiveSessionId(savedActiveId);
      setIsLoadingSessions(true);
      setSessionsError(null);
    }

    const loadSessions = async () => {
      try {
        const response = await fetch(`/api/chat?user_id=${encodeURIComponent(persistentId)}`);
        if (!response.ok) {
          throw new Error(`History request failed (${response.status}).`);
        }
        const data = await response.json();
        if (data?.sessions && Array.isArray(data.sessions) && data.sessions.length > 0) {
          const remoteSessions: ChatSession[] = data.sessions.map((s: any) => ({
            id: s.session_id,
            title: s.title,
            createdAt: new Date(s.created_at * 1000).toISOString(),
            backendSessionId: s.session_id,
            messages: s.messages.map((m: any) => ({
              id: m.id || generateUUID(),
              text: m.text,
              sender: m.sender,
            })),
          }));
          if (!cancelled) {
            setSessions(remoteSessions);
            if (!remoteSessions.some((s) => s.id === savedActiveId)) {
              setActiveSessionId(remoteSessions[0].id);
            }
          }
        }
      } catch (error) {
        console.error('Chat history load error:', error);
        if (!cancelled) {
          setSessionsError('Could not sync chat history. Showing chats saved in this browser.');
        }
      } finally {
        if (!cancelled) setIsLoadingSessions(false);
      }
    };

    void loadSessions();
    return () => {
      cancelled = true;
    };
  }, [sessionLoadAttempt]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Save sessions to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    }
  }, [sessions, activeSessionId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, currentTrace]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession?.messages || [];

  const handleNewChat = () => {
    setGuidedStep(null);
    setGuidedDetails({});
    setCustomGuestCount('');
    const newId = generateUUID();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Charter Inquire',
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: generateUUID(),
          text: "Welcome to Yacht Matchmaker - Lite. I am Ariel, your dedicated luxury yacht charter concierge. To curate an exceptional voyage, please share your preferred location (**Goa** or **Mumbai**), date, duration, number of guests, and the celebration occasion.",
          sender: 'agent',
        },
      ],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newId);
  };

  const handleDeleteSession = async (session: ChatSession) => {
    const remaining = sessions.filter((s) => s.id !== session.id);
    if (remaining.length === 0) {
      handleNewChat();
    } else {
      setSessions(remaining);
      if (activeSessionId === session.id) {
        setActiveSessionId(remaining[0].id);
      }
    }

    try {
      await fetch(
        `/api/chat?user_id=${encodeURIComponent(userId)}&session_id=${encodeURIComponent(
          session.backendSessionId || session.id
        )}`,
        { method: 'DELETE' }
      );
    } catch (e) {
      console.error('Delete chat error:', e);
    }
  };

  const handleRenameSession = (sessionId: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle } : s))
    );
  };

  const handleTogglePinSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, isPinned: !s.isPinned } : s))
    );
  };

  const handleResetUserId = () => {
    localStorage.removeItem(USER_ID_KEY);
    localStorage.removeItem(SESSIONS_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    window.location.reload();
  };

  const handleClearAllHistory = () => {
    localStorage.removeItem(SESSIONS_STORAGE_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    handleNewChat();
  };

  const handleSendMessage = async (textToSend: string, isRetry = false) => {
    const query = textToSend.trim();
    if (!query || isLoading || !userId || !activeSession) return;

    setIsLoading(true);
    setChatError(null);
    setInputMessage('');

    const userMsg: Message = {
      id: generateUUID(),
      text: query,
      sender: 'user',
    };

    const initialTrace: TraceData = {
      step: 'init',
      icon: 'sparkles',
      label: 'Ariel is reviewing your request...',
    };
    setCurrentTrace(initialTrace);

    const isFirstUserMessage =
      activeSession.messages.filter((m) => m.sender === 'user').length === 0;
    const sessionTitle = isFirstUserMessage
      ? query.slice(0, 32) + (query.length > 32 ? '...' : '')
      : activeSession.title;

    if (!isRetry) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? {
                ...s,
                title: sessionTitle,
                messages: [...s.messages, userMsg],
              }
            : s
        )
      );
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          user_id: userId,
          session_id: activeSession.backendSessionId || activeSession.id,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let receivedFinal = false;
        let streamError: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const jsonText = trimmed.slice(5).trim();
            if (!jsonText) continue;

            try {
              const eventData = JSON.parse(jsonText);
              if (eventData.type === 'trace') {
                setCurrentTrace({
                  step: eventData.step,
                  icon: eventData.icon,
                  label: eventData.label,
                });
              } else if (eventData.type === 'final') {
                const finalReply = eventData.response || '';
                if (!finalReply.trim()) {
                  streamError = 'The chat service returned an empty response.';
                  continue;
                }
                receivedFinal = true;
                setCurrentTrace(null);
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === activeSessionId
                      ? {
                          ...s,
                          backendSessionId: eventData.session_id || s.backendSessionId,
                          messages: [
                            ...s.messages,
                            {
                              id: generateUUID(),
                              text: finalReply,
                              sender: 'agent',
                            },
                          ],
                        }
                      : s
                  )
                );
              } else if (eventData.type === 'error') {
                streamError = eventData.error || 'The chat service could not process that message.';
              }
            } catch (jsonErr) {
              console.error('Error parsing SSE event:', jsonErr);
            }
          }
        }
        if (streamError) throw new Error(streamError);
        if (!receivedFinal) throw new Error('The chat service ended without a response.');
      } else {
        const data = await response.json();
        const reply = data.response || data.text;
        if (!reply) throw new Error(data.error || 'The chat service returned no response.');
        setCurrentTrace(null);
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? {
                  ...s,
                  messages: [
                    ...s.messages,
                    {
                      id: generateUUID(),
                      text: reply,
                      sender: 'agent',
                    },
                  ],
                }
              : s
          )
        );
      }
    } catch (err) {
      console.error('Chat error:', err);
      setCurrentTrace(null);
      setChatError({ sessionId: activeSessionId, query });
    } finally {
      setIsLoading(false);
      setCurrentTrace(null);
    }
  };

  const handleRetrySessionLoad = () => {
    setSessionLoadAttempt((attempt) => attempt + 1);
  };

  const handleGuidedDetailsChange = (details: Partial<GuidedCharterDetails>, nextStep: number) => {
    setGuidedDetails((current) => ({ ...current, ...details }));
    setGuidedStep(nextStep);
  };

  const handleGenerateGuidedItinerary = () => {
    const { location, date, startTime, durationHours, guests, occasion } = guidedDetails;
    if (!location || !date || !startTime || !durationHours || !guests || !occasion) return;

    const request = [
      'Please prepare a yacht charter itinerary with these details:',
      `Location: ${location}`,
      `Date: ${date}`,
      `Start time: ${startTime}`,
      `Duration: ${durationHours} hours`,
      `Guests: ${guests}`,
      `Occasion: ${occasion}`,
    ].join('\n');

    setGuidedStep(null);
    void handleSendMessage(request);
  };

  const handleWelcomePrompt = (prompt: string) => {
    setInputMessage(prompt);
    inputRef.current?.focus();
  };

  const handleCopyText = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 font-sans text-zinc-100 antialiased">
      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLightboxImage(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-5 right-5 rounded-full bg-white/10 p-2.5 text-white backdrop-blur-md transition hover:bg-white/20"
            aria-label="Close image modal"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxImage}
            alt="Enlarged yacht view"
            className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Concierge Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        userId={userId}
        onResetUserId={handleResetUserId}
        totalSessions={sessions.length}
        onClearAllHistory={handleClearAllHistory}
      />

      {/* Persistent History Sidebar */}
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
        onSelectSession={(id) => {
          setGuidedStep(null);
          setActiveSessionId(id);
        }}
        onNewChat={handleNewChat}
        onDeleteSession={handleDeleteSession}
        onRenameSession={handleRenameSession}
        onTogglePinSession={handleTogglePinSession}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isLoadingSessions={isLoadingSessions}
        sessionsError={sessionsError}
        onRetrySessions={handleRetrySessionLoad}
      />

      {/* Main Chat Workspace */}
      <div className="flex flex-1 flex-col overflow-hidden bg-zinc-900/90">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-zinc-800/80 bg-zinc-950/70 px-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 transition hover:bg-zinc-800"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 shadow-md">
                <Anchor className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
                  <span>Ariel</span>
                  <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium text-amber-300 border border-amber-400/20">
                    Luxury Concierge
                  </span>
                </h1>
                <p className="text-[11px] text-zinc-400">
                  Private Charter Itinerary & Flotilla Advisor
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-zinc-800 bg-zinc-900/70 px-3 py-1 text-xs text-zinc-300">
              <MapPin className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-[11px] font-medium">Serving Goa & Mumbai</span>
            </div>
          </div>
        </header>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 scrollbar-thin">
          {messages.length <= 1 ? (
            guidedStep !== null ? (
              <section className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-6 sm:py-10">
                <div className="rounded-3xl border border-zinc-800 bg-zinc-950/80 p-5 shadow-2xl sm:p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                        Your charter, step by step
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        {guidedStep === 6 ? 'Review your trip' : [
                          'Choose your coast',
                          'Pick a date',
                          'Choose a departure time',
                          'How long would you like to cruise?',
                          'How many guests?',
                          'What are you celebrating?',
                        ][guidedStep]}
                      </h2>
                      <p className="mt-2 text-sm text-zinc-400">
                        {guidedStep === 6
                          ? 'Check the details before Ariel prepares your itinerary.'
                          : 'You can change any of these details before asking Ariel to prepare an itinerary.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuidedStep(null)}
                      className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
                      aria-label="Close guided planner"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-6 flex items-center gap-2" aria-label="Booking steps">
                    {Array.from({ length: 6 }, (_, index) => (
                      <span
                        key={index}
                        className={`h-1.5 flex-1 rounded-full ${
                          index < guidedStep ? 'bg-amber-400' : 'bg-zinc-800'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-zinc-500">
                    {guidedStep === 6 ? 'Ready to review' : `Step ${guidedStep + 1} of 6`}
                  </p>

                  <div className="mt-6">
                    {guidedStep === 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(['Goa', 'Mumbai'] as const).map((location) => (
                          <button
                            key={location}
                            type="button"
                            onClick={() => handleGuidedDetailsChange({ location }, 1)}
                            className="rounded-2xl border border-zinc-700 bg-zinc-900 px-5 py-5 text-left transition hover:border-amber-400/70 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            <MapPin className="mb-3 h-5 w-5 text-amber-300" />
                            <span className="block text-lg font-semibold text-white">{location}</span>
                            <span className="mt-1 block text-xs text-zinc-400">
                              {location === 'Goa'
                                ? 'Beaches, islands, and river routes'
                                : 'Harbor landmarks and Mandwa cruises'}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {guidedStep === 1 && (
                      <label className="block max-w-sm">
                        <span className="mb-2 block text-xs font-medium text-zinc-300">Charter date</span>
                        <input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={guidedDetails.date || ''}
                          onChange={(event) => {
                            if (event.target.value) {
                              handleGuidedDetailsChange({ date: event.target.value }, 2);
                            }
                          }}
                          className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-white outline-none focus:border-amber-400"
                        />
                      </label>
                    )}

                    {guidedStep === 2 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {GUIDED_TIME_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleGuidedDetailsChange({ startTime: option.value }, 3)}
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-200 transition hover:border-amber-400/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            <span className="block font-medium">{option.label}</span>
                            <span className="mt-1 block text-xs text-zinc-500">{option.value}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {guidedStep === 3 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[2, 3, 4, 6].map((hours) => (
                          <button
                            key={hours}
                            type="button"
                            onClick={() =>
                              handleGuidedDetailsChange({ durationHours: hours }, 4)
                            }
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-4 text-sm font-medium text-zinc-200 transition hover:border-amber-400/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            {hours} hours
                          </button>
                        ))}
                      </div>
                    )}

                    {guidedStep === 4 && (
                      <div>
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {[2, 4, 6, 8, 10, 12, 15, 20, 30].map((guests) => (
                            <button
                              key={guests}
                              type="button"
                              onClick={() => handleGuidedDetailsChange({ guests }, 5)}
                              className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm font-medium text-zinc-200 transition hover:border-amber-400/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                            >
                              {guests}
                            </button>
                          ))}
                        </div>
                        <label className="mt-4 block max-w-xs">
                          <span className="mb-2 block text-xs font-medium text-zinc-400">
                            Or enter a custom guest count
                          </span>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={customGuestCount}
                              onChange={(event) => setCustomGuestCount(event.target.value)}
                              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-amber-400"
                            />
                            <button
                              type="button"
                              disabled={
                                !customGuestCount ||
                                Number(customGuestCount) < 1 ||
                                Number(customGuestCount) > 100
                              }
                              onClick={() =>
                                handleGuidedDetailsChange({ guests: Number(customGuestCount) }, 5)
                              }
                              className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Continue
                            </button>
                          </div>
                        </label>
                      </div>
                    )}

                    {guidedStep === 5 && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {GUIDED_OCCASION_OPTIONS.map((occasion) => (
                          <button
                            key={occasion}
                            type="button"
                            onClick={() => handleGuidedDetailsChange({ occasion }, 6)}
                            className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-sm text-zinc-200 transition hover:border-amber-400/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                          >
                            {occasion}
                          </button>
                        ))}
                      </div>
                    )}

                    {guidedStep === 6 && (
                      <div>
                        <dl className="divide-y divide-zinc-800 rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4">
                          {[
                            ['Location', guidedDetails.location, 0],
                            [
                              'Date',
                              guidedDetails.date
                                ? new Date(`${guidedDetails.date}T12:00:00`).toLocaleDateString(
                                    'en-US',
                                    { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' }
                                  )
                                : undefined,
                              1,
                            ],
                            [
                              'Departure',
                              GUIDED_TIME_OPTIONS.find((option) => option.value === guidedDetails.startTime)
                                ? `${GUIDED_TIME_OPTIONS.find((option) => option.value === guidedDetails.startTime)?.label} (${guidedDetails.startTime})`
                                : undefined,
                              2,
                            ],
                            ['Duration', guidedDetails.durationHours ? `${guidedDetails.durationHours} hours` : undefined, 3],
                            ['Guests', guidedDetails.guests ? `${guidedDetails.guests} guests` : undefined, 4],
                            ['Occasion', guidedDetails.occasion, 5],
                          ].map(([label, value, step]) => (
                            <div key={label} className="flex items-center justify-between gap-3 py-3">
                              <dt className="text-xs text-zinc-400">{label}</dt>
                              <dd className="flex items-center gap-3 text-right text-sm font-medium text-white">
                                {value || 'Not set'}
                                <button
                                  type="button"
                                  onClick={() => setGuidedStep(Number(step))}
                                  className="text-xs font-medium text-amber-300 hover:text-amber-200"
                                >
                                  Edit
                                </button>
                              </dd>
                            </div>
                          ))}
                        </dl>
                        <button
                          type="button"
                          onClick={handleGenerateGuidedItinerary}
                          disabled={isLoading}
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:brightness-110 disabled:opacity-60"
                        >
                          <Sparkles className="h-4 w-4" />
                          Ask Ariel to prepare my itinerary
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-zinc-800 pt-4">
                    {guidedStep > 0 ? (
                      <button
                        type="button"
                        onClick={() => setGuidedStep(guidedStep === 6 ? 5 : guidedStep - 1)}
                        className="text-xs font-medium text-zinc-400 transition hover:text-white"
                      >
                        Back
                      </button>
                    ) : (
                      <span />
                    )}
                    <p className="text-[11px] text-zinc-500">You can also just chat with Ariel below.</p>
                  </div>
                </div>
              </section>
            ) : (
            <section className="mx-auto flex min-h-full max-w-4xl flex-col justify-center py-6 sm:py-10">
              <div className="mb-7 text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Private yacht charters · Goa & Mumbai
                </span>
                <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Where will the water take you?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-400 sm:text-base">
                  Pick a coast to start planning. Ariel will help you find the right yacht, route, and
                  experience.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    handleWelcomePrompt(
                      'I’m planning a yacht charter in Goa for 8 guests. Help me choose a route and experience.'
                    )
                  }
                  className="group relative flex min-h-52 flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 bg-cover bg-center p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-amber-400/50 hover:shadow-amber-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:min-h-60"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, rgba(9,9,11,0.02) 10%, rgba(9,9,11,0.28) 42%, rgba(9,9,11,0.96) 100%), url('/yachts/black_diamond/exterior.jpg')",
                  }}
                >
                  <span className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                    <MapPin className="h-3.5 w-3.5" />
                    Goa
                  </span>
                  <span className="text-xl font-semibold text-white">Golden-hour escapes</span>
                  <span className="mt-1 text-xs text-zinc-300">
                    Quiet coves, island routes, and open-water sunsets
                  </span>
                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-white transition group-hover:text-amber-200">
                    Start planning <ArrowUp className="h-3.5 w-3.5 rotate-45" />
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleWelcomePrompt(
                      'I’m planning a yacht charter in Mumbai for 8 guests. Help me choose a route and experience.'
                    )
                  }
                  className="group relative flex min-h-52 flex-col justify-end overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 bg-cover bg-center p-5 text-left shadow-lg transition hover:-translate-y-0.5 hover:border-amber-400/50 hover:shadow-amber-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:min-h-60"
                  style={{
                    backgroundImage:
                      "linear-gradient(180deg, rgba(9,9,11,0.02) 10%, rgba(9,9,11,0.28) 42%, rgba(9,9,11,0.96) 100%), url('/yachts/azure_voyager/exterior.jpg')",
                  }}
                >
                  <span className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">
                    <MapPin className="h-3.5 w-3.5" />
                    Mumbai
                  </span>
                  <span className="text-xl font-semibold text-white">The city, from the sea</span>
                  <span className="mt-1 text-xs text-zinc-300">
                    Harbor landmarks, Mandwa cruises, and celebrations afloat
                  </span>
                  <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-white transition group-hover:text-amber-200">
                    Start planning <ArrowUp className="h-3.5 w-3.5 rotate-45" />
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setGuidedDetails({});
                  setCustomGuestCount('');
                  setGuidedStep(0);
                }}
                className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 px-4 py-2.5 text-xs font-semibold text-amber-200 transition hover:border-amber-300/60 hover:bg-amber-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              >
                <Calendar className="h-4 w-4" />
                Plan step by step
              </button>

              <div className="mt-6">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Or try a sample voyage
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {QUICK_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleWelcomePrompt(item.prompt)}
                      className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-300 transition hover:border-amber-500/40 hover:bg-zinc-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            )
          ) : (
          <div className="mx-auto max-w-4xl space-y-6">
            {messages.map((message) => {
              const isUser = message.sender === 'user';
              const itineraryMeta = !isUser ? parseItineraryMeta(message.text) : null;
              const photos = !isUser ? extractPhotos(message.text) : [];
              const cleanText = !isUser
                ? formatMarkdownTables(
                    message.text
                      .replace(
                        /(?:^|\r?\n)#{1,6}\s*[^\r\n]*(?:yacht\s+photos?|vessel\s+photo\s+gallery)[^\r\n]*(?:\r?\n|$)[\s\S]*$/i,
                        ''
                      )
                      .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
                      .trim()
                  )
                : message.text;

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
                >
                  <div
                    className={`relative max-w-3xl rounded-2xl p-5 md:p-6 transition-all ${
                      isUser
                        ? 'bg-amber-500 text-zinc-950 font-medium shadow-lg'
                        : 'border border-zinc-800/90 bg-zinc-950/80 text-zinc-200 shadow-xl'
                    }`}
                  >
                    {/* Header info for agent messages */}
                    {!isUser && (
                      <div className="mb-3 flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Ship className="h-4 w-4 text-amber-400" />
                          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                            Ariel • Charter Concierge
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(message.id, message.text)}
                          className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
                          title="Copy message"
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* 2. Itinerary Badges (Location, Date, Time, Duration, Guests) */}
                    {itineraryMeta && (
                      <div className="mb-5 flex flex-wrap gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                        {itineraryMeta.location && (
                          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-500/20">
                            <MapPin className="h-3.5 w-3.5 text-amber-400" />
                            <span>{itineraryMeta.location}</span>
                          </div>
                        )}
                        {itineraryMeta.date && (
                          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-500/20">
                            <Calendar className="h-3.5 w-3.5 text-amber-400" />
                            <span>{itineraryMeta.date}</span>
                          </div>
                        )}
                        {itineraryMeta.time && (
                          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-500/20">
                            <Clock className="h-3.5 w-3.5 text-amber-400" />
                            <span>{itineraryMeta.time}</span>
                          </div>
                        )}
                        {itineraryMeta.duration && (
                          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-500/20">
                            <Timer className="h-3.5 w-3.5 text-amber-400" />
                            <span>{itineraryMeta.duration}</span>
                          </div>
                        )}
                        {itineraryMeta.guests && (
                          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-500/20">
                            <Users className="h-3.5 w-3.5 text-amber-400" />
                            <span>{itineraryMeta.guests}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Markdown Body */}
                    <div
                      className={`prose prose-invert max-w-none text-sm leading-relaxed ${
                        isUser ? 'prose-p:text-zinc-950 font-medium' : 'text-zinc-200'
                      }`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ node, ...props }) => (
                            <div className="my-5 w-full overflow-x-auto rounded-xl border border-zinc-800/90 bg-zinc-950/70 shadow-lg backdrop-blur-sm">
                              <table className="w-full min-w-[480px] border-collapse text-left text-sm" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }) => (
                            <thead className="border-b border-zinc-800 bg-zinc-900/90 text-xs font-semibold uppercase tracking-wider text-amber-300" {...props} />
                          ),
                          tbody: ({ node, ...props }) => (
                            <tbody className="divide-y divide-zinc-800/60 font-normal text-zinc-200" {...props} />
                          ),
                          tr: ({ node, ...props }) => (
                            <tr className="transition-colors hover:bg-zinc-800/40" {...props} />
                          ),
                          th: ({ node, ...props }) => (
                            <th className="px-4 py-3 font-semibold text-amber-300 border-b border-zinc-800" {...props} />
                          ),
                          td: ({ node, ...props }) => (
                            <td className="px-4 py-3 text-zinc-300" {...props} />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3 className="mt-4 mb-2 text-base font-bold text-amber-300" {...props} />
                          ),
                          h4: ({ node, ...props }) => (
                            <h4 className="mt-4 mb-2 text-sm font-semibold text-zinc-100 flex items-center gap-2" {...props} />
                          ),
                          img: () => null,
                        }}
                      >
                        {cleanText}
                      </ReactMarkdown>
                    </div>

                    {/* Interactive Charter Confirmation Action */}
                    {!isUser && message.text.includes('Shall I proceed with the itinerary?') && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-800/80">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleSendMessage('Yes, please proceed with the itinerary')}
                          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-md hover:from-amber-400 hover:to-amber-500 transition cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Confirm & Generate Itinerary</span>
                        </button>
                      </div>
                    )}

                    {/* 3. Photo Grid & Lightbox (16:10 aspect ratio) */}
                    {photos.length > 0 && (
                      <div className="mt-6 border-t border-zinc-800/80 pt-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-amber-400 uppercase">
                            <Camera className="h-3.5 w-3.5" />
                            Vessel Photo Gallery ({photos.length})
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            Click to enlarge in HD
                          </span>
                        </div>
                        <div
                          className={`grid gap-3 ${
                            photos.length === 1
                              ? 'grid-cols-1 max-w-md'
                              : photos.length === 2
                              ? 'grid-cols-1 sm:grid-cols-2'
                              : 'grid-cols-1 sm:grid-cols-3'
                          }`}
                        >
                          {photos.map((img, idx) => (
                            <div
                              key={idx}
                              onClick={() => setLightboxImage(img.src)}
                              className="group relative aspect-[16/10] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-md cursor-zoom-in"
                            >
                              <img
                                src={img.src}
                                alt={img.alt || 'Yacht photo'}
                                loading="lazy"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                              />
                              <div className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                <Maximize2 className="h-3.5 w-3.5" />
                              </div>
                              {img.alt && (
                                <div className="absolute bottom-2 left-2 right-2 truncate rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-xs">
                                  {img.alt}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {chatError?.sessionId === activeSessionId && (
              <div
                className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-100"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <div className="flex-1">
                  <p>Ariel couldn’t send a reply. Your message is still here.</p>
                  <button
                    type="button"
                    onClick={() => handleSendMessage(chatError.query, true)}
                    disabled={isLoading}
                    className="mt-2 inline-flex items-center gap-1.5 font-semibold text-red-200 underline-offset-2 hover:underline disabled:opacity-60"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCw className="h-3.5 w-3.5" />
                    )}
                    Retry message
                  </button>
                </div>
              </div>
            )}

            {/* 1. Live Activity Trace Pill (Green pulsating indicator + live step icon) */}
            {isLoading && currentTrace && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-zinc-950/90 px-4 py-3 shadow-xl backdrop-blur-md">
                  {/* Pulsating green indicator */}
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>

                  {/* Live Step Icon */}
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800">
                    {renderTraceIcon(currentTrace.icon)}
                  </div>

                  {/* Step Label */}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      Live Multi-Agent Trace • {currentTrace.step}
                    </span>
                    <span className="text-xs font-medium text-zinc-200">
                      {currentTrace.label}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
          )}
        </div>

        {/* Input Bar */}
        <div className="border-t border-zinc-800/80 bg-zinc-950/80 p-4 md:p-5 backdrop-blur-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputMessage);
            }}
            className="mx-auto flex max-w-4xl items-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 px-4 py-2.5 shadow-lg focus-within:border-amber-500/60 transition"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Inquire with Ariel (e.g., 'Sunset yacht cruise in Goa for 8 guests on Dec 15')..."
              disabled={isLoading}
              className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
              ) : (
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              )}
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-zinc-500">
            Ariel curates luxury yacht charters exclusively along the coastlines of Mumbai and Goa.
          </p>
        </div>
      </div>
    </div>
  );
}
