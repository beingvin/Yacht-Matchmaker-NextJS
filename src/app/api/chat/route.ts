import { NextRequest, NextResponse } from 'next/server';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';
import { createYachtAgentGraph, YachtAgentState } from '@/lib/agent/graph';
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const { message, user_id, session_id } = await req.json();

    if (!message || !user_id) {
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
        const sendTrace = (step: string, icon: string, label: string) => {
          const payload = JSON.stringify({ type: 'trace', step, icon, label });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        };

        const sendFinal = (response: string) => {
          const payload = JSON.stringify({
            type: 'final',
            response,
            session_id: sessionId,
            user_id: user_id,
          });
          controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
        };

        try {
          // 1. Initial review trace
          sendTrace('init', 'sparkles', 'Ariel is reviewing your request...');
          await sleep(250);

          // 2. Instantiate and execute the LangGraph workflow
          const graph = createYachtAgentGraph();

          // We check whether the user is confirming or if this will trigger the pipeline
          const lowerMsg = message.toLowerCase().trim();
          const isConfirming =
            /\b(yes|proceed|confirm|go ahead|sure|sounds good|book it|do it)\b/i.test(lowerMsg) ||
            /\b(generate|create|prepare|make|build|provide|send|view|show)\b.*\bitinerar/i.test(lowerMsg) ||
            lowerMsg.includes('proceed with itinerary') ||
            lowerMsg.includes('confirm booking');

          if (isConfirming) {
            // Emit trace milestones for the multi-agent pipeline
            sendTrace('planning', 'compass', 'Initiating charter concierge planning...');
            await sleep(350);
            sendTrace('yacht', 'ship', 'Searching available luxury yachts in catalog...');
            await sleep(400);
            sendTrace('theme', 'sparkles', 'Matching celebration theme & curated decor...');
            await sleep(350);
            sendTrace('safety', 'compass', 'Assessing sea conditions & safety protocols...');
            await sleep(350);
            sendTrace('compiling', 'receipt', 'Calculating charter rates & itinerary inclusions...');
            await sleep(400);
            sendTrace('itinerary', 'document', 'Finalizing bespoke charter itinerary & photo gallery...');
            await sleep(400);
          }

          // Execute LangGraph
          const result = await graph.invoke({
            messages: langChainMessages,
          });

          const responseText =
            result.response_text ||
            result.final_itinerary ||
            "I'm here to assist with your luxury yacht charter.";

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
          const fallback =
            'I encountered a slight delay while coordinating with the harbor office. Please allow me a moment to re-evaluate your itinerary request.';
          sendFinal(fallback);
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
