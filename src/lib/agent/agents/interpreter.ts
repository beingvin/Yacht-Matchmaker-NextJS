import { HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { getVertexModel } from '../model';
import { RequirementsSchema, type UserRequirements } from '../state';

export async function interpretRequirements(conversation: string): Promise<UserRequirements> {
  const agent = createReactAgent({
    llm: getVertexModel(), tools: [], name: 'booking_requirements_interpreter',
    prompt: 'Extract only details stated or clearly implied by the guest. Omit missing fields. Never guess dates, times, guest counts, budget, occasion, or yacht preference. Do not mistake a concierge recommendation for the guest’s choice.',
    responseFormat: RequirementsSchema,
  });
  const result = await agent.invoke({ messages: [new HumanMessage(conversation)] });
  return RequirementsSchema.parse(result.structuredResponse);
}
