import { NextRequest, NextResponse } from 'next/server';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { runYachtConcierge } from '@/lib/agent/graph';
import {
  getAllSessions,
  getSession,
  saveSession,
  deleteSession,
  StoredMessage,
  StoredSession,
} from '@/lib/session-store';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id');
  if (!userId) {
    return NextResponse.json({ error: 'Missing user ID' }, { status: 400 });
  }

  try {
    const sessions = getAllSessions(userId);
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Session history API Error:', error);
    return NextResponse.json({ error: 'Unable to load chat history.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id');
  const sessionId = req.nextUrl.searchParams.get('session_id');
  if (!userId || !sessionId) {
    return NextResponse.json({ error: 'Missing user ID or session ID' }, { status: 400 });
  }

  try {
    const deleted = deleteSession(userId, sessionId);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('Delete chat API Error:', error);
    return NextResponse.json({ error: 'Unable to delete chat history.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, user_id, session_id } = await req.json();

    if (typeof message !== 'string' || !message.trim() || typeof user_id !== 'string' || !user_id) {
      return NextResponse.json({ error: 'Missing message or user ID' }, { status: 400 });
    }

    const sessionId: string = session_id || crypto.randomUUID();

    // Fetch existing session or initialize
    const existing = getSession(user_id, sessionId);
    const existingMessages: StoredMessage[] = existing?.messages || [];

    // Convert stored messages to LangChain BaseMessage objects
    const langChainMessages: BaseMessage[] = existingMessages.map((m) =>
      m.sender === 'user' ? new HumanMessage(m.text) : new AIMessage(m.text)
    );
    const newUserMessage = new HumanMessage(message);
    langChainMessages.push(newUserMessage);

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const sendFinal = (response: string) => {
          const payload = JSON.stringify({
            type: 'final',
            response,
            session_id: sessionId,
            user_id: user_id,
          });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        };

        const sendError = (error: string) => {
          const payload = JSON.stringify({ type: 'error', error });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        };

        try {
          const responseText = await runYachtConcierge(langChainMessages);

          // Update and save session
          const updatedMessages: StoredMessage[] = [
            ...existingMessages,
            { id: crypto.randomUUID(), text: message, sender: 'user' },
            { id: crypto.randomUUID(), text: responseText, sender: 'agent' },
          ];

          // Determine title from first user message if new
          const title =
            existing?.title ||
            message.slice(0, 36) + (message.length > 36 ? '...' : '');

          const sessionToSave: StoredSession = {
            session_id: sessionId,
            title: title,
            created_at: existing?.created_at || Math.floor(Date.now() / 1000),
            messages: updatedMessages,
          };
          saveSession(user_id, sessionToSave);

          // Emit final response
          sendFinal(responseText);
          controller.close();
        } catch (err: any) {
          console.error('LangGraph streaming execution error:', err);
          sendError(err instanceof Error ? err.message : String(err));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    console.error('Next.js API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
