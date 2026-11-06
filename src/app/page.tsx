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
  ChevronLeft,
  ChevronRight,
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

const DESTINATION_CARDS = [
  {
    name: 'Andaman',
    title: 'Island-hopping escapes',
    description: 'Clear waters, quiet coves, and island routes',
    image: '/yachts/island_serenity/exterior.jpg',
  },
  {
    name: 'Chennai',
    title: 'The Coromandel coast',
    description: 'Open-water views along the eastern shoreline',
    image: '/yachts/coromandel_breeze/exterior.jpg',
  },
  {
    name: 'Goa',
    title: 'Golden-hour escapes',
    description: 'Quiet coves, island routes, and open-water sunsets',
    image: '/yachts/black_diamond/exterior.jpg',
  },
  {
    name: 'Kochi',
    title: 'Harbor to open sea',
    description: 'Coastal views and relaxed harbor departures',
    image: '/yachts/malabar_pearl/exterior.jpg',
  },
  {
    name: 'Lakshadweep',
    title: 'Turquoise lagoons',
    description: 'Island scenery and clear-water adventures',
    image: '/yachts/lagoon_dream/exterior.jpg',
  },
  {
    name: 'Mumbai',
    title: 'The city, from the sea',
    description: 'Harbor landmarks, Mandwa cruises, and celebrations afloat',
    image: '/yachts/azure_voyager/exterior.jpg',
  },
  {
    name: 'Pondicherry',
    title: 'Coastal calm',
    description: 'Easygoing cruises along the eastern coast',
    image: '/yachts/coral_breeze/exterior.jpg',
  },
];

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
  location?: 'Andaman' | 'Chennai' | 'Goa' | 'Kochi' | 'Lakshadweep' | 'Mumbai' | 'Pondicherry';
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

const GUIDED_LOCATIONS = [
  { name: 'Andaman', description: 'Clear waters and island routes' },
  { name: 'Chennai', description: 'The Coromandel coastline' },
  { name: 'Goa', description: 'Beaches, islands, and river routes' },
  { name: 'Kochi', description: 'Harbor views and coastal cruises' },
  { name: 'Lakshadweep', description: 'Turquoise lagoons and island scenery' },
  { name: 'Mumbai', description: 'Harbor landmarks and Mandwa cruises' },
  { name: 'Pondicherry', description: 'Relaxed cruises along the east coast' },
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
      return <Ship className="h-4 w-4 animate-bounce text-[#d4d4d8]" />;
    case 'compass':
      return <Compass className="h-4 w-4 animate-spin text-[#d4d4d8]" />;
    case 'receipt':
      return <Receipt className="h-4 w-4 text-emerald-500" />;
    case 'document':
      return <FileText className="h-4 w-4 text-indigo-500" />;
    case 'shield':
    case 'shield-check':
      return <ShieldCheck className="h-4 w-4 text-teal-500" />;
    case 'sparkles':
    default:
      return <Sparkles className="h-4 w-4 animate-pulse text-[#d4d4d8]" />;
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

  useEffect(() => {
    const desktopQuery = window.matchMedia('(min-width: 768px)');
    let wasDesktop = desktopQuery.matches;
    const syncSidebarToViewport = () => {
      if (desktopQuery.matches !== wasDesktop) {
        wasDesktop = desktopQuery.matches;
        setIsSidebarOpen(wasDesktop);
      }
    };

    window.addEventListener('resize', syncSidebarToViewport);
    return () => window.removeEventListener('resize', syncSidebarToViewport);
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const guidedLocationsRef = useRef<HTMLDivElement>(null);

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
    <div className="flex h-[100dvh] min-w-0 overflow-hidden bg-[#1c1c1f] font-sans text-[#e7e7e9] antialiased">
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
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#1c1c1f]">
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-3 top-3 z-10 rounded-lg border border-[#34343a] bg-[#27272c] p-2 text-[#a2a2ab] transition hover:bg-[#303036] hover:text-white"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        {/* Message Feed */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 sm:py-6 md:px-8 scrollbar-thin">
          {messages.length <= 1 ? (
            guidedStep !== null ? (
              <section className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-3 sm:py-10">
                <div className="rounded-2xl border border-[#38383e] bg-[#222226] p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#d4d4d8]">
                        Your charter, step by step
                      </p>
                      <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#ededf0]">
                        {guidedStep === 6 ? 'Review your trip' : [
                          'Choose your coast',
                          'Pick a date',
                          'Choose a departure time',
                          'How long would you like to cruise?',
                          'How many guests?',
                          'What are you celebrating?',
                        ][guidedStep]}
                      </h2>
                      <p className="mt-2 text-sm text-[#a2a2ab]">
                        {guidedStep === 6
                          ? 'Check the details before Ariel prepares your itinerary.'
                          : 'You can change any of these details before asking Ariel to prepare an itinerary.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuidedStep(null)}
                      className="rounded-md p-2 text-[#777780] transition hover:bg-[#303036] hover:text-white"
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
                          index < guidedStep ? 'bg-white' : 'bg-[#3b3b42]'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-[#777780]">
                    {guidedStep === 6 ? 'Ready to review' : `Step ${guidedStep + 1} of 6`}
                  </p>

                  <div className="mt-6">
                    {guidedStep === 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            guidedLocationsRef.current?.scrollBy({
                              left: -guidedLocationsRef.current.clientWidth,
                              behavior: 'smooth',
                            })
                          }
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#38383e] bg-[#252529] text-[#c5c5cc] transition hover:bg-[#303036] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                          aria-label="Scroll destinations left"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div
                          ref={guidedLocationsRef}
                          className="flex min-w-0 snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                        >
                        {GUIDED_LOCATIONS.map(({ name: location, description }) => (
                          <button
                            key={location}
                            type="button"
                            onClick={() => handleGuidedDetailsChange({ location }, 1)}
                            className="min-h-28 basis-full shrink-0 snap-start rounded-xl border border-[#38383e] bg-[#252529] px-3 py-3 text-left transition hover:border-[#a1a1aa] hover:bg-[#2b2b31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:min-h-24 sm:basis-[calc((100%-0.75rem)/2)] sm:px-3 sm:py-3 lg:min-h-28 lg:px-4 lg:py-4"
                          >
                            <MapPin className="mb-3 h-5 w-5 text-[#d4d4d8]" />
                            <span className="block text-base font-semibold text-[#ededf0]">{location}</span>
                            <span className="mt-1 block text-xs text-[#92929b]">
                              {description}
                            </span>
                          </button>
                        ))}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            guidedLocationsRef.current?.scrollBy({
                              left: guidedLocationsRef.current.clientWidth,
                              behavior: 'smooth',
                            })
                          }
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#38383e] bg-[#252529] text-[#c5c5cc] transition hover:bg-[#303036] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                          aria-label="Scroll destinations right"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {guidedStep === 1 && (
                      <label className="block max-w-sm">
                        <span className="mb-2 block text-xs font-medium text-[#a2a2ab]">Charter date</span>
                        <input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={guidedDetails.date || ''}
                          onChange={(event) => {
                            if (event.target.value) {
                              handleGuidedDetailsChange({ date: event.target.value }, 2);
                            }
                          }}
                          className="w-full rounded-lg border border-[#3b3b42] bg-[#202024] px-3 py-2.5 text-sm text-[#e7e7e9] outline-none focus:border-white"
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
                            className="rounded-lg border border-[#38383e] bg-[#252529] px-3 py-3 text-sm text-[#c5c5cc] transition hover:border-[#a1a1aa] hover:bg-[#2b2b31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                          >
                            <span className="block font-medium">{option.label}</span>
                            <span className="mt-1 block text-xs text-[#777780]">{option.value}</span>
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
                            className="rounded-lg border border-[#38383e] bg-[#252529] px-3 py-3 text-sm font-medium text-[#c5c5cc] transition hover:border-[#a1a1aa] hover:bg-[#2b2b31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
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
                              className="rounded-lg border border-[#38383e] bg-[#252529] px-3 py-3 text-sm font-medium text-[#c5c5cc] transition hover:border-[#a1a1aa] hover:bg-[#2b2b31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                              {guests}
                            </button>
                          ))}
                        </div>
                        <label className="mt-4 block max-w-xs">
                          <span className="mb-2 block text-xs font-medium text-[#92929b]">
                            Or enter a custom guest count
                          </span>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={customGuestCount}
                              onChange={(event) => setCustomGuestCount(event.target.value)}
                              className="w-full rounded-lg border border-[#3b3b42] bg-[#202024] px-3 py-2 text-sm text-[#e7e7e9] outline-none focus:border-white"
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
                              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#19191c] transition hover:bg-[#e7e7e9] disabled:cursor-not-allowed disabled:opacity-40"
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
                            className="rounded-lg border border-[#38383e] bg-[#252529] px-3 py-3 text-sm text-[#c5c5cc] transition hover:border-[#a1a1aa] hover:bg-[#2b2b31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                          >
                            {occasion}
                          </button>
                        ))}
                      </div>
                    )}

                    {guidedStep === 6 && (
                      <div>
                        <dl className="divide-y divide-[#38383e] rounded-xl border border-[#38383e] bg-[#252529] px-4">
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
                              <dt className="text-xs text-[#92929b]">{label}</dt>
                              <dd className="flex items-center gap-3 text-right text-sm font-medium text-[#e7e7e9]">
                                {value || 'Not set'}
                                <button
                                  type="button"
                                  onClick={() => setGuidedStep(Number(step))}
                                  className="text-xs font-medium text-[#e7e7e9] hover:text-white"
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
                          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#19191c] transition hover:bg-[#e7e7e9] disabled:opacity-60"
                        >
                          <Sparkles className="h-4 w-4" />
                          Ask Ariel to prepare my itinerary
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-[#38383e] pt-4">
                    {guidedStep > 0 ? (
                      <button
                        type="button"
                        onClick={() => setGuidedStep(guidedStep === 6 ? 5 : guidedStep - 1)}
                        className="text-xs font-medium text-[#92929b] transition hover:text-[#e7e7e9]"
                      >
                        Back
                      </button>
                    ) : (
                      <span />
                    )}
                    <p className="text-[11px] text-[#777780]">You can also just chat with Ariel below.</p>
                  </div>
                </div>
              </section>
            ) : (
            <section className="mx-auto flex min-h-full max-w-6xl flex-col justify-start py-4 sm:justify-center sm:py-8">
              <div className="mb-7 text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-[#ededf0] sm:text-3xl">
                  Where will the water take you?
                </h2>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#a2a2ab]">
                  Pick a coast to start planning. Ariel will help you find the right yacht, route, and
                  experience.
                </p>
              </div>

              <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-3 pb-3 scrollbar-thin sm:-mx-4 sm:px-4 md:-mx-8 md:px-8">
                {DESTINATION_CARDS.map(({ name, title, description, image }) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() =>
                      handleWelcomePrompt(
                        `I’m planning a yacht charter in ${name} for 8 guests. Help me choose a route and experience.`
                      )
                    }
                    className="group relative flex min-h-48 w-[min(78vw,18rem)] shrink-0 snap-start flex-col justify-end overflow-hidden rounded-xl border border-white/10 bg-slate-300 bg-cover bg-center p-3 text-left shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:min-h-52 sm:w-[18rem] sm:p-4"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(15,15,20,0.04) 10%, rgba(15,15,20,0.28) 42%, rgba(15,15,20,0.88) 100%), url('${image}')`,
                    }}
                  >
                    <span className="mb-2 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/85">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {name}
                    </span>
                    <span className="text-base font-semibold leading-tight text-white sm:text-lg">
                      {title}
                    </span>
                    <span className="mt-1 text-xs leading-snug text-white/85">{description}</span>
                    <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-white transition group-hover:text-white/80">
                      Start planning <ArrowUp className="h-3.5 w-3.5 rotate-45" />
                    </span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => {
                  setGuidedDetails({});
                  setCustomGuestCount('');
                  setGuidedStep(0);
                }}
                className="mx-auto mt-5 inline-flex items-center gap-2 rounded-lg border border-[#3b3b42] bg-[#252529] px-3.5 py-2 text-xs font-medium text-[#c5c5cc] transition hover:border-[#a1a1aa] hover:bg-[#2b2b31] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Calendar className="h-4 w-4" />
                Plan step by step
              </button>

              <div className="mt-6">
                <p className="mb-3 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-[#777780]">
                  Or try a sample voyage
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {QUICK_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleWelcomePrompt(item.prompt)}
                      className="rounded-md border border-[#38383e] bg-[#252529] px-3 py-1.5 text-xs text-[#a2a2ab] transition hover:border-[#a1a1aa] hover:bg-[#2b2b31] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            )
          ) : (
          <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
            {messages.map((message) => {
              const isUser = message.sender === 'user';
              const itineraryMeta = !isUser ? parseItineraryMeta(message.text) : null;
              const photos = !isUser ? extractPhotos(message.text) : [];
              let cleanText = message.text;
              if (!isUser) {
                cleanText = cleanText
                  .replace(
                    /(?:^|\r?\n)#{1,6}\s*[^\r\n]*(?:yacht\s+photos?|vessel\s+photo\s+gallery)[^\r\n]*(?:\r?\n|$)[\s\S]*$/i,
                    ''
                  )
                  .replace(/!\[[^\]]*\]\([^)]+\)/g, '');
                if (itineraryMeta) {
                  cleanText = cleanText.replace(
                    /(?:^|\r?\n)#{1,6}\s*Booking Summary\s*\r?\n(?:[-*]\s+\*\*[^*\r\n]+:\*\*[^\r\n]*(?:\r?\n|$))+/i,
                    '\n'
                  );
                }
                cleanText = formatMarkdownTables(cleanText.trim());
              }
              const tripDetails = itineraryMeta
                ? [
                    { label: 'Destination', value: itineraryMeta.location || '', Icon: MapPin },
                    { label: 'Date', value: itineraryMeta.date || '', Icon: Calendar },
                    { label: 'Departure', value: itineraryMeta.time || '', Icon: Clock },
                    { label: 'Duration', value: itineraryMeta.duration || '', Icon: Timer },
                    { label: 'Guests', value: itineraryMeta.guests || '', Icon: Users },
                  ].filter((detail) => detail.value)
                : [];

              return (
                <div
                  key={message.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`}
                >
                  <div
                    className={`relative min-w-0 break-words rounded-2xl p-4 transition-all sm:p-5 md:p-6 ${
                      isUser
                        ? 'ml-auto w-fit max-w-[min(88%,44rem)] rounded-xl rounded-br-md bg-[#303036] font-medium text-white'
                        : 'w-full max-w-3xl border border-[#34343a] bg-[#222226] text-[#c5c5cc]'
                    }`}
                  >
                    {/* Header info for agent messages */}
                    {!isUser && (
                      <div className="mb-3 flex items-center justify-between border-b border-[#38383e] pb-2.5">
                        <div className="flex items-center gap-2">
                          <Ship className="h-4 w-4 text-[#d4d4d8]" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#d4d4d8]">
                            Ariel • Charter Concierge
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyText(message.id, message.text)}
                          className="rounded-md p-1 text-[#777780] transition hover:bg-[#303036] hover:text-white"
                          title="Copy message"
                          aria-label={copiedId === message.id ? 'Message copied' : 'Copy message'}
                        >
                          {copiedId === message.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    )}

                    {/* Charter details */}
                    {itineraryMeta && (
                      <div className="mb-5 overflow-hidden rounded-lg border border-[#38383e] bg-[#252529]">
                        <div className="border-b border-[#38383e] bg-[#29292e] px-3 py-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#92929b]">
                            Charter details
                          </span>
                        </div>
                        <dl
                          className="grid gap-px bg-[#38383e]"
                          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))' }}
                        >
                          {tripDetails.map(({ label, value, Icon }) => (
                            <div key={label} className="min-w-0 bg-[#252529] px-3 py-3">
                              <dt className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-[#92929b]">
                                <Icon className="h-3.5 w-3.5 text-[#d4d4d8]" />
                                {label}
                              </dt>
                              <dd className="mt-1 break-words text-sm font-semibold text-[#e7e7e9]">
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    )}

                    {/* Markdown Body */}
                    <div
                      className={`max-w-none text-sm leading-6 ${
                        isUser ? 'font-medium text-white' : 'text-[#c5c5cc]'
                      }`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          table: ({ node, ...props }) => (
                            <div
                              role="region"
                              aria-label="Scrollable itinerary table"
                              tabIndex={0}
                              className="my-5 w-full overflow-x-auto overscroll-x-contain rounded-lg border border-[#38383e] bg-[#252529] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                            >
                              <table className="w-full min-w-[480px] border-collapse text-left text-sm" {...props} />
                            </div>
                          ),
                          thead: ({ node, ...props }) => (
                            <thead className="border-b border-[#38383e] bg-[#29292e] text-xs font-semibold uppercase tracking-wider text-[#e7e7e9]" {...props} />
                          ),
                          tbody: ({ node, ...props }) => (
                            <tbody className="divide-y divide-[#38383e] font-normal text-[#c5c5cc]" {...props} />
                          ),
                          tr: ({ node, ...props }) => (
                            <tr className="transition-colors hover:bg-[#2c2c32]" {...props} />
                          ),
                          th: ({ node, ...props }) => (
                            <th scope="col" className="border-b border-[#38383e] px-4 py-3 font-semibold text-[#e7e7e9]" {...props} />
                          ),
                          td: ({ node, ...props }) => (
                            <td className="px-4 py-3 text-[#b0b0b8]" {...props} />
                          ),
                          h3: ({ node, ...props }) => (
                            <h3 className="mt-5 mb-2 text-base font-semibold text-[#ededf0]" {...props} />
                          ),
                          h4: ({ node, ...props }) => (
                            <h4 className="mt-4 mb-2 flex items-center gap-2 text-sm font-semibold text-[#e7e7e9]" {...props} />
                          ),
                          h1: ({ node, ...props }) => (
                            <h1 className="mb-3 text-xl font-semibold tracking-tight text-[#ededf0]" {...props} />
                          ),
                          h2: ({ node, ...props }) => (
                            <h2 className="mt-5 mb-2 text-lg font-semibold tracking-tight text-[#ededf0]" {...props} />
                          ),
                          p: ({ node, ...props }) => (
                            <p className="mb-3 last:mb-0" {...props} />
                          ),
                          ul: ({ node, ...props }) => (
                            <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-[#d4d4d8]" {...props} />
                          ),
                          ol: ({ node, ...props }) => (
                            <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-[#e7e7e9]" {...props} />
                          ),
                          li: ({ node, ...props }) => (
                            <li className="ps-1" {...props} />
                          ),
                          strong: ({ node, ...props }) => (
                            <strong className={isUser ? 'font-semibold' : 'font-semibold text-[#ededf0]'} {...props} />
                          ),
                          blockquote: ({ node, ...props }) => (
                            <blockquote className="my-4 border-l-2 border-[#777780] pl-4 text-[#a2a2ab]" {...props} />
                          ),
                          a: ({ node, ...props }) => (
                            <a className="font-medium text-[#e7e7e9] underline decoration-[#777780] underline-offset-2 hover:text-white" {...props} />
                          ),
                          hr: () => <hr className="my-5 border-[#38383e]" />,
                          code: ({ node, ...props }) => (
                            <code className="rounded bg-[#f1f0e9] px-1.5 py-0.5 font-mono text-[0.9em] text-[#314440]" {...props} />
                          ),
                          pre: ({ node, ...props }) => (
                            <pre className="my-4 overflow-x-auto rounded-lg border border-[#38383e] bg-[#19191c] p-4 text-sm leading-6 text-[#d3d3da]" {...props} />
                          ),
                          img: () => null,
                        }}
                      >
                        {cleanText}
                      </ReactMarkdown>
                    </div>

                    {/* Interactive Charter Confirmation Action */}
                    {!isUser && message.text.includes('Shall I proceed with the itinerary?') && (
                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#38383e] pt-3">
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleSendMessage('Yes, please proceed with the itinerary')}
                          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-[#19191c] transition hover:bg-[#e7e7e9] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>Confirm & Generate Itinerary</span>
                        </button>
                      </div>
                    )}

                    {/* 3. Photo Grid & Lightbox (16:10 aspect ratio) */}
                    {photos.length > 0 && (
                      <div className="mt-6 border-t border-[#38383e] pt-4">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-[#d4d4d8] uppercase">
                            <Camera className="h-3.5 w-3.5" />
                            Vessel Photo Gallery ({photos.length})
                          </span>
                          <span className="text-[11px] text-[#777780]">
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
                              className="group relative aspect-[16/10] cursor-zoom-in overflow-hidden rounded-lg border border-[#38383e] bg-[#252529]"
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
                className="flex items-start gap-3 rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200"
                role="alert"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <div className="flex-1">
                  <p>Ariel couldn’t send a reply. Your message is still here.</p>
                  <button
                    type="button"
                    onClick={() => handleSendMessage(chatError.query, true)}
                    disabled={isLoading}
                    className="mt-2 inline-flex items-center gap-1.5 font-semibold text-red-300 underline-offset-2 hover:underline disabled:opacity-60"
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
                <div className="flex items-center gap-3 rounded-lg border border-[#38383e] bg-[#222226] px-3 py-2.5">
                  {/* Pulsating green indicator */}
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
                  </span>

                  {/* Live Step Icon */}
                  <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[#38383e] bg-[#29292e]">
                    {renderTraceIcon(currentTrace.icon)}
                  </div>

                  {/* Step Label */}
                  <div className="flex flex-col">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#d4d4d8]">
                      Live Multi-Agent Trace • {currentTrace.step}
                    </span>
                    <span className="text-xs font-medium text-[#c5c5cc]">
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
        <div className="shrink-0 border-t border-[#34343a] bg-[#202024] px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:p-4 md:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(inputMessage);
            }}
            className="mx-auto flex min-h-11 max-w-4xl items-center gap-2 rounded-xl border border-[#3b3b42] bg-[#252529] px-3 py-2 transition focus-within:border-white focus-within:ring-2 focus-within:ring-white/20 sm:px-3.5"
          >
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Inquire with Ariel (e.g., 'Sunset yacht cruise in Goa for 8 guests on Dec 15')..."
              disabled={isLoading}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#e7e7e9] placeholder-[#777780] outline-none disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#19191c] transition hover:bg-[#e7e7e9] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send message"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-white" />
              ) : (
                <ArrowUp className="h-4 w-4 stroke-[2.5]" />
              )}
            </button>
          </form>
          <p className="mt-2 text-center text-[10px] text-[#777780]">
            Ariel curates luxury yacht charters exclusively along the coastlines of Mumbai and Goa.
          </p>
        </div>
      </div>
    </div>
  );
}
