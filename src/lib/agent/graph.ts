import { BaseMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getVertexModel } from './model';
import { itineraryGeneratorTool } from './tools/itinerary-generator';
import { yachtCheckerTool } from './tools/yacht-checker';
import { loadCatalog } from './data/catalog';

export { getVertexModel } from './model';
export type { ItineraryPlan, Theme, UserRequirements, Yacht } from './state';

export function createYachtAgentGraph() {
  const supervisor = getVertexModel();
  const locations = [...new Set(loadCatalog().yachts.map((yacht) => yacht.location))]
    .sort((a, b) => a.localeCompare(b))
    .map((location) => location.replace(/\b\w/g, (character) => character.toUpperCase()));
  const locationList = locations.join(', ');
  return createReactAgent({
    llm: supervisor,
    tools: [yachtCheckerTool, itineraryGeneratorTool],
    name: 'yacht_concierge_supervisor',
    prompt:
      `You are Ariel, a warm and knowledgeable yacht charter concierge. The catalog currently has yachts in these locations: ${locationList}. When the conversation begins and the guest has not already shared a location or specific request, open with exactly: "Hello! I'm Ariel, your yacht charter concierge. I'd be delighted to help you plan a fantastic yacht experience. To get started, where would you like to charter? Available locations are: ${locationList}." Keep the conversation natural and paced: ask at most one concise follow-up question per reply. Do not present a checklist or request every booking detail in the opening message. After location is known, collect date, start time, duration, guest count, and occasion gradually as the conversation calls for them. Remember and reuse details already provided; when the guest gives several details together, acknowledge them and ask only for the next most relevant missing detail. Use yacht_checker for yacht facts and never invent inventory details or live availability. Call itinerary_generator only after the guest explicitly asks you to prepare an itinerary; include the full conversation in its input and pass supervisor_selected_yacht only when you selected it with yacht_checker. Omit supervisor_selected_yacht otherwise. If the generator reports missing details, ask for one missing detail at a time and wait. When it returns an itinerary, pass the complete itinerary back unchanged as your answer. Do not claim a booking has been made.`,
  });
}

function modelText(content: BaseMessage['content']): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

export async function runYachtConcierge(messages: BaseMessage[]): Promise<string> {
  const agent = createYachtAgentGraph();
  const result = await agent.invoke({ messages });
  const lastMessage = result.messages[result.messages.length - 1];
  if (!lastMessage) throw new Error('The concierge supervisor returned no response.');
  const itineraryToolResult = [...result.messages]
    .reverse()
    .find((message) => message._getType() === 'tool' && (message as { name?: string }).name === 'itinerary_generator');
  const generatedItinerary = itineraryToolResult ? modelText(itineraryToolResult.content) : '';
  const finalText = /^### Booking Summary & Curated Charter Itinerary/m.test(generatedItinerary)
    ? generatedItinerary
    : modelText(lastMessage.content);
  if (!finalText.trim()) throw new Error('The concierge supervisor returned an empty response.');
  return finalText;
}
