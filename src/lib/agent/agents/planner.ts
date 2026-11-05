import { HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { loadCatalog } from '../data/catalog';
import { getVertexModel } from '../model';
import { PlanResultSchema, type ItineraryPlan, type UserRequirements } from '../state';
import { z } from 'zod/v3';

export async function planItinerary(requirements: UserRequirements): Promise<ItineraryPlan> {
  const { yachts, themes } = loadCatalog();
  const eligibleYachts = yachts.filter((yacht) => {
    if (yacht.location.toLowerCase() !== requirements.location?.toLowerCase()) return false;
    if (yacht.max_capacity < (requirements.guests ?? 0)) return false;
    if (yacht.min_duration_hr > (requirements.duration_hr ?? 0)) return false;
    if (requirements.budget_total != null && yacht.rate_hr * (requirements.duration_hr ?? 0) > requirements.budget_total) return false;
    return true;
  });
  const candidates = requirements.requested_yacht_name
    ? eligibleYachts.filter((yacht) => yacht.yacht_name.toLowerCase() === requirements.requested_yacht_name?.trim().toLowerCase())
    : eligibleYachts;
  if (requirements.requested_yacht_name && candidates.length === 0) throw new Error(`The requested yacht "${requirements.requested_yacht_name}" is not eligible for these requirements.`);
  if (candidates.length === 0) throw new Error('No yacht in the catalog meets the requested location, capacity, duration, and budget.');

  const planSchema = z.object({
    selected_yacht_id: z.string(), selected_theme_id: z.string(), marine_forecast: z.string(), safety_protocols: z.array(z.string()),
  });
  const plannerAgent = createReactAgent({
    llm: getVertexModel(), tools: [], name: 'charter_planning_agent',
    prompt: 'You are the yacht planning agent. Choose one yacht only from the supplied eligible candidates and one theme from the supplied theme catalog. Use each selected item ID exactly. Respect the selected theme recommended_timing when it fits the guest requested time, and explain any mismatch without changing the requested time. Provide a forecast assessment for the requested date and location, and safety protocols. If current marine data is unavailable to you, clearly say the forecast is an estimate that must be verified with the harbor authority. Never invent catalog facts.',
    responseFormat: planSchema,
  });
  const result = await plannerAgent.invoke({
    messages: [new HumanMessage(JSON.stringify({ requirements, eligible_yachts: candidates, themes }, null, 2))],
  });
  const planned = planSchema.parse(result.structuredResponse);
  const yacht = candidates.find((candidate) => candidate.id === planned.selected_yacht_id);
  if (!yacht) throw new Error('The planning agent selected a yacht outside the eligible catalog results.');
  const theme = themes.find((candidate) => candidate.id === planned.selected_theme_id);
  if (!theme) throw new Error('The planning agent selected a theme outside the theme catalog.');
  return { requirements, yacht, theme, marine_forecast: planned.marine_forecast, safety_protocols: planned.safety_protocols, total_cost: yacht.rate_hr * (requirements.duration_hr ?? 0) };
}
