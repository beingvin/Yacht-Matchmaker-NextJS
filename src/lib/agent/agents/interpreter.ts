import { HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getVertexModel } from '../model';
import { RequirementsSchema, type UserRequirements } from '../state';

export async function interpretRequirements(conversation: string): Promise<UserRequirements> {
  const interpreterAgent = createReactAgent({
    llm: getVertexModel(), tools: [], name: 'booking_requirements_interpreter',
    prompt: 'You are the booking requirements interpreter. Extract only details stated or clearly implied by the guest conversation. Omit every missing field. Do not guess, infer defaults, or invent dates, times, guest counts, budget, occasion, or a preferred yacht. Extract a requested yacht only when the guest expresses that preference; do not mistake a concierge recommendation for the guestâ€™s choice.',
    responseFormat: RequirementsSchema,
  });
  const result = await interpreterAgent.invoke({ messages: [new HumanMessage(conversation)] });
  return RequirementsSchema.parse(result.structuredResponse);
}
