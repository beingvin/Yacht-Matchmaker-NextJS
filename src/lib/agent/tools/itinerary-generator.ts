import { tool } from '@langchain/core/tools';
import { z } from 'zod/v3';
import { interpretRequirements } from '../agents/interpreter';
import { planItinerary } from '../agents/planner';
import { presentItinerary } from '../agents/presenter';
import type { UserRequirements } from '../state';

export const itineraryGeneratorTool = tool(async ({ conversation, supervisor_selected_yacht }) => {
  const extractedRequirements = await interpretRequirements(conversation);
  const requirements = { ...extractedRequirements, requested_yacht_name: supervisor_selected_yacht || extractedRequirements.requested_yacht_name };
  const requiredFields: (keyof UserRequirements)[] = ['location', 'date', 'start_time', 'duration_hr', 'guests', 'occasion'];
  const missing = requiredFields.filter((field) => requirements[field] == null || requirements[field] === '');
  if (missing.length > 0) return JSON.stringify({ status: 'needs_details', missing, requirements });
  const plan = await planItinerary(requirements);
  return await presentItinerary(plan);
}, {
  name: 'itinerary_generator',
  description: 'Generate a charter itinerary only when the guest explicitly asks for one. It runs the requirements interpreter, yacht/theme/forecast planner, and itinerary presenter AI agents. It asks for missing details instead of guessing.',
  schema: z.object({
    conversation: z.string().describe('The relevant guest and concierge conversation to interpret.'),
    supervisor_selected_yacht: z.string().optional().describe('A yacht the supervisor already selected from yacht_checker. Omit it to let the planner choose.'),
  }),
});
