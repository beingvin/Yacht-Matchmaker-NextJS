import { HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getVertexModel } from '../model';
import type { ItineraryPlan } from '../state';

function contentText(content: unknown): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

export async function presentItinerary(plan: ItineraryPlan): Promise<string> {
  const agent = createReactAgent({
    llm: getVertexModel(8192), tools: [], name: 'charter_itinerary_presenter',
    prompt: `Write a complete itinerary using only supplied plan data. Reproduce this exact heading and labels, each on its own line:
### Booking Summary & Curated Charter Itinerary
- **Location:** value
- **Date:** value
- **Time:** value
- **Duration:** value
- **Guests:** value

Include vessel allocation, theme and ambiance, pricing and inclusions, safety and marine forecast, and yacht photos. Include a Markdown image for every supplied yacht photo URL. State rate and total accurately. Do not add unsupported facts. Return only itinerary Markdown.`,
  });
  const result = await agent.invoke({ messages: [new HumanMessage(JSON.stringify(plan, null, 2))] });
  const response = [...result.messages].reverse().find((message) => message._getType() === 'ai' && !(message as { tool_calls?: unknown[] }).tool_calls?.length);
  if (!response) throw new Error('Presenter agent returned no final message.');
  const itinerary = contentText(response.content).trim();
  const fields = [
    /^### Booking Summary & Curated Charter Itinerary$/m,
    /^- \*\*Location:\*\* .+$/m, /^- \*\*Date:\*\* .+$/m, /^- \*\*Time:\*\* .+$/m,
    /^- \*\*Duration:\*\* .+$/m, /^- \*\*Guests:\*\* .+$/m,
  ];
  if (fields.some((field) => !field.test(itinerary))) throw new Error('Presenter did not return the required itinerary format.');
  for (const photo of plan.yacht.photos) {
    const escaped = photo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`!\\[[^\\]]*\\]\\(${escaped}\\)`).test(itinerary)) throw new Error(`Presenter omitted catalog photo ${photo}.`);
  }
  return itinerary;
}
