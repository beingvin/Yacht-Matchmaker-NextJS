import { tool } from '@langchain/core/tools';
import { z } from 'zod/v3';
import { interpretRequirements } from '../agents/interpreter';
import { planItinerary } from '../agents/planner';
import { presentItinerary } from '../agents/presenter';
import type { UserRequirements } from '../state';

export const itineraryGeneratorTool = tool(
  async ({ conversation, supervisor_selected_yacht }) => {
    const extracted = await interpretRequirements(conversation);
    const requirements = { ...extracted, requested_yacht_name: supervisor_selected_yacht || extracted.requested_yacht_name };
    const required: (keyof UserRequirements)[] = ['location', 'date', 'start_time', 'duration_hr', 'guests', 'occasion'];
    const missing = required.filter((field) => requirements[field] == null || requirements[field] === '');
    if (missing.length) return JSON.stringify({ status: 'needs_details', missing, requirements });
    return presentItinerary(await planItinerary(requirements));
  },
  {
    name: 'itinerary_generator',
    description: 'Generate an itinerary only on explicit request. Runs the interpreter, planner, and presenter agents; reports missing details instead of guessing.',
    schema: z.object({ conversation: z.string().describe('Relevant guest and concierge conversation.'), supervisor_selected_yacht: z.string().optional().describe('A yacht selected from yacht_checker; omit to let the planner choose.') }),
  }
);
