import { BaseMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getVertexModel } from './model';
import { itineraryGeneratorTool } from './tools/itinerary-generator';
import { yachtCheckerTool } from './tools/yacht-checker';

export function createYachtAgentGraph() {
  return createReactAgent({
    llm: getVertexModel(),
    tools: [yachtCheckerTool, itineraryGeneratorTool],
    name: 'yacht_concierge_supervisor',
    prompt: 'You are Ariel, a warm yacht charter concierge for Mumbai and Goa. Gather location, date, start time, duration, guest count, and occasion naturally. Use yacht_checker for catalog facts; never invent inventory facts or live availability. Call itinerary_generator only after an explicit itinerary request, include the full conversation, and pass supervisor_selected_yacht only if selected using yacht_checker. If details are missing, ask for them. Relay a generated itinerary unchanged. Do not claim a booking has been made.',
  });
}

function contentText(content: BaseMessage['content']): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

export async function runYachtConcierge(messages: BaseMessage[]): Promise<string> {
  const result = await createYachtAgentGraph().invoke({ messages });
  const last = result.messages.at(-1);
  if (!last) throw new Error('Concierge supervisor returned no response.');
  const itineraryToolResult = [...result.messages].reverse().find(
    (message) => message._getType() === 'tool' && (message as { name?: string }).name === 'itinerary_generator'
  );
  const generated = itineraryToolResult ? contentText(itineraryToolResult.content) : '';
  const response = /^### Booking Summary & Curated Charter Itinerary/m.test(generated) ? generated : contentText(last.content);
  if (!response.trim()) throw new Error('Concierge supervisor returned an empty response.');
  return response;
}
