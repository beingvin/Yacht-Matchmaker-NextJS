import fs from 'fs';
import path from 'path';

export interface StoredMessage {
  id: string;
  text: string;
  sender: 'user' | 'agent';
}

export interface StoredSession {
  session_id: string;
  title: string;
  created_at: number; // unix timestamp in seconds
  messages: StoredMessage[];
}

export interface UserSessionsMap {
  [userId: string]: StoredSession[];
}

const DATA_FILE = path.join(process.cwd(), 'data', 'user_sessions.json');

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf-8');
  }
}

export function getAllSessions(userId: string): StoredSession[] {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const all: UserSessionsMap = JSON.parse(raw);
    return all[userId] || [];
  } catch (err) {
    console.error('Error reading sessions file:', err);
    return [];
  }
}

export function getSession(userId: string, sessionId: string): StoredSession | undefined {
  const sessions = getAllSessions(userId);
  return sessions.find((s) => s.session_id === sessionId);
}

export function saveSession(userId: string, session: StoredSession) {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const all: UserSessionsMap = JSON.parse(raw);
    if (!all[userId]) {
      all[userId] = [];
    }
    const idx = all[userId].findIndex((s) => s.session_id === session.session_id);
    if (idx >= 0) {
      all[userId][idx] = session;
    } else {
      all[userId].unshift(session);
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving session:', err);
  }
}

export function deleteSession(userId: string, sessionId: string): boolean {
  try {
    ensureDataFile();
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const all: UserSessionsMap = JSON.parse(raw);
    if (!all[userId]) return false;
    all[userId] = all[userId].filter((s) => s.session_id !== sessionId);
    fs.writeFileSync(DATA_FILE, JSON.stringify(all, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error deleting session:', err);
    return false;
  }
}
