import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getVertexModel } from '../model';
import type { ItineraryPlan } from '../state';

function modelText(content: BaseMessage['content']): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

export async function presentItinerary(plan: ItineraryPlan): Promise<string> {
  const presenterAgent = createReactAgent({
    llm: getVertexModel(8192), tools: [], name: 'charter_itinerary_presenter',
    prompt: `You are the itinerary presentation agent. Write a complete, polished yacht itinerary using only the supplied plan data. The client parses the following exact Markdown fields, so reproduce the heading and labels exactly and keep each summary field on its own line:
### Booking Summary & Curated Charter Itinerary
- **Location:** value
- **Date:** value
- **Time:** value
- **Duration:** value
- **Guests:** value

Include sections for vessel allocation, theme and ambiance, pricing and inclusions, safety and marine forecast, and yacht photos. Include the selected theme's recommended timing in the theme and ambiance section. Include a Markdown image for every supplied yacht photo URL. State the hourly rate and total cost accurately. Do not add unsupported services or facts. Return only the itinerary Markdown.`,
  });
  const response = await presenterAgent.invoke({ messages: [new HumanMessage(JSON.stringify(plan, null, 2))] });
  const responseMessage = [...response.messages].reverse().find((message) => message._getType() === 'ai' && !(message as { tool_calls?: unknown[] }).tool_calls?.length);
  if (!responseMessage) throw new Error('The itinerary presenter agent returned no final message.');
  const itinerary = modelText(responseMessage.content).trim();
  const requiredFields = [
    /^### Booking Summary & Curated Charter Itinerary$/m,
    /^- \*\*Location:\*\* .+$/m, /^- \*\*Date:\*\* .+$/m, /^- \*\*Time:\*\* .+$/m,
    /^- \*\*Duration:\*\* .+$/m, /^- \*\*Guests:\*\* .+$/m,
  ];
  if (requiredFields.some((pattern) => !pattern.test(itinerary))) throw new Error('The presenter agent did not return the required itinerary format.');
  for (const photo of plan.yacht.photos) {
    const escapedPhoto = photo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`!\\[[^\\]]*\\]\\(${escapedPhoto}\\)`).test(itinerary)) throw new Error(`The presenter agent omitted the catalog photo ${photo}.`);
  }
  return itinerary;
}
