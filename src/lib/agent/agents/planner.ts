import { HumanMessage } from '@langchain/core/messages';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { loadCatalog } from '../data/catalog';
import { getVertexModel } from '../model';
import { PlanResultSchema, type ItineraryPlan, type UserRequirements } from '../state';

export async function planItinerary(requirements: UserRequirements): Promise<ItineraryPlan> {
  const { yachts, themes } = loadCatalog();
  const eligible = yachts.filter((yacht) =>
    yacht.location.toLowerCase() === requirements.location?.toLowerCase() &&
    yacht.max_capacity >= (requirements.guests ?? 0) &&
    yacht.min_duration_hr <= (requirements.duration_hr ?? 0) &&
    (requirements.budget_total == null || yacht.rate_hr * (requirements.duration_hr ?? 0) <= requirements.budget_total)
  );
  const candidates = requirements.requested_yacht_name
    ? eligible.filter((yacht) => yacht.yacht_name.toLowerCase() === requirements.requested_yacht_name?.trim().toLowerCase())
    : eligible;
  if (requirements.requested_yacht_name && candidates.length === 0) throw new Error(`Requested yacht “${requirements.requested_yacht_name}” is not eligible.`);
  if (candidates.length === 0) throw new Error('No catalog yacht meets the requested location, capacity, duration, and budget.');

  const agent = createReactAgent({
    llm: getVertexModel(), tools: [], name: 'charter_planning_agent',
    prompt: 'Choose one yacht only from eligible_yachts and one theme from themes. Use their exact IDs. Provide a forecast assessment and safety protocols. If current marine data is unavailable, label the forecast an estimate to verify with the harbor authority. Never invent catalog facts.',
    responseFormat: PlanResultSchema,
  });
  const result = await agent.invoke({ messages: [new HumanMessage(JSON.stringify({ requirements, eligible_yachts: candidates, themes }, null, 2))] });
  const planned = PlanResultSchema.parse(result.structuredResponse);
  const yacht = candidates.find((item) => item.id === planned.selected_yacht_id);
  const theme = themes.find((item) => item.id === planned.selected_theme_id);
  if (!yacht) throw new Error('Planner selected a yacht outside the eligible catalog results.');
  if (!theme) throw new Error('Planner selected a theme outside the theme catalog.');
  return { requirements, yacht, theme, marine_forecast: planned.marine_forecast, safety_protocols: planned.safety_protocols, total_cost: yacht.rate_hr * (requirements.duration_hr ?? 0) };
}
