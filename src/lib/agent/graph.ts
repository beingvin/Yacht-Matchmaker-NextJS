import { BaseMessage, HumanMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import fs from 'fs';
import path from 'path';
import { z } from 'zod/v3';

let cachedVertexModel: ChatVertexAI | null = null;
let cachedModelKey: string | null = null;

export function getVertexModel(maxTokens = 4096): ChatVertexAI {
  const modelName = process.env.VERTEX_MODEL;
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION;

  if (!modelName || !keyFile || !project || !location) {
    throw new Error(
      'Vertex AI requires VERTEX_MODEL, GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CLOUD_PROJECT, and GOOGLE_CLOUD_LOCATION.'
    );
  }

  const keyPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), keyFile);
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Vertex AI credentials file was not found at ${keyPath}.`);
  }

  const cacheKey = `${modelName}:${keyPath}:${project}:${location}:${maxTokens}`;
  if (cachedVertexModel && cachedModelKey === cacheKey) return cachedVertexModel;

  cachedVertexModel = new ChatVertexAI({
    authOptions: { keyFile: keyPath },
    model: modelName,
    temperature: 0.3,
    maxOutputTokens: maxTokens,
    location,
  });
  cachedModelKey = cacheKey;
  return cachedVertexModel;
}

export interface Yacht {
  id: string;
  yacht_name: string;
  size_ft: number;
  type: string;
  max_capacity: number;
  crew: number;
  location: string;
  rate_hr: number;
  min_duration_hr: number;
  routes: string[];
  boarding_point: string;
  photos: string[];
  occasion: string[];
  features: string[];
  inclusions: string[];
  food_included: boolean;
  vibe: string[];
}

export interface Theme {
  id: string;
  theme_name: string;
  vibe_tags: string[];
  occasion_tags: string[];
  decor: string[];
  music_keywords: string[];
  mood_description: string;
  food_and_drinks: string[];
}

const RequirementsSchema = z.object({
  location: z.enum(['Goa', 'Mumbai']).optional(),
  date: z.string().optional(),
  start_time: z.string().optional(),
  duration_hr: z.number().optional(),
  guests: z.number().optional(),
  occasion: z.string().optional(),
  budget_total: z.number().optional(),
  requested_yacht_name: z.string().optional(),
});

type UserRequirements = z.infer<typeof RequirementsSchema>;

interface ItineraryPlan {
  requirements: UserRequirements;
  yacht: Yacht;
  theme: Theme;
  marine_forecast: string;
  safety_protocols: string[];
  total_cost: number;
}

function loadCatalog(): { yachts: Yacht[]; themes: Theme[] } {
  const dataDir = path.join(process.cwd(), 'data');
  return {
    yachts: JSON.parse(fs.readFileSync(path.join(dataDir, 'yacht_data.json'), 'utf-8')),
    themes: JSON.parse(fs.readFileSync(path.join(dataDir, 'theme_catalog.json'), 'utf-8')),
  };
}

function modelText(content: BaseMessage['content']): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

const yachtCheckerTool = tool(
  async ({ location, guests, yacht_name }) => {
    const { yachts } = loadCatalog();
    const normalizedName = yacht_name?.trim().toLowerCase();
    const matches = yachts.filter((yacht) => {
      if (location && yacht.location.toLowerCase() !== location.toLowerCase()) return false;
      if (guests && yacht.max_capacity < guests) return false;
      if (normalizedName && !yacht.yacht_name.toLowerCase().includes(normalizedName)) return false;
      return true;
    });

    return JSON.stringify({ yachts: matches });
  },
  {
    name: 'yacht_checker',
    description:
      'Look up yacht catalog details such as capacity, location, rates, routes, boarding point, photos, features, inclusions, and occasions. Use this for yacht questions. The catalog does not contain live booking availability. Do not invent catalog facts.',
    schema: z.object({
      location: z.enum(['Goa', 'Mumbai']).optional(),
      guests: z.number().optional(),
      yacht_name: z.string().optional(),
    }),
  }
);

async function interpretRequirements(conversation: string): Promise<UserRequirements> {
  const interpreterAgent = createReactAgent({
    llm: getVertexModel(),
    tools: [],
    name: 'booking_requirements_interpreter',
    prompt:
      'You are the booking requirements interpreter. Extract only details stated or clearly implied by the guest conversation. Omit every missing field. Do not guess, infer defaults, or invent dates, times, guest counts, budget, occasion, or a preferred yacht. Extract a requested yacht only when the guest expresses that preference; do not mistake a concierge recommendation for the guest’s choice.',
    responseFormat: RequirementsSchema,
  });
  const result = await interpreterAgent.invoke({ messages: [new HumanMessage(conversation)] });
  return RequirementsSchema.parse(result.structuredResponse);
}

async function planItinerary(requirements: UserRequirements): Promise<ItineraryPlan> {
  const { yachts, themes } = loadCatalog();
  const eligibleYachts = yachts.filter((yacht) => {
    if (yacht.location.toLowerCase() !== requirements.location?.toLowerCase()) return false;
    if (yacht.max_capacity < (requirements.guests ?? 0)) return false;
    if (yacht.min_duration_hr > (requirements.duration_hr ?? 0)) return false;
    if (
      requirements.budget_total != null &&
      yacht.rate_hr * (requirements.duration_hr ?? 0) > requirements.budget_total
    ) {
      return false;
    }
    return true;
  });

  const candidates = requirements.requested_yacht_name
    ? eligibleYachts.filter(
        (yacht) => yacht.yacht_name.toLowerCase() === requirements.requested_yacht_name?.trim().toLowerCase()
      )
    : eligibleYachts;

  if (requirements.requested_yacht_name && candidates.length === 0) {
    throw new Error(`The requested yacht "${requirements.requested_yacht_name}" is not eligible for these requirements.`);
  }

  if (candidates.length === 0) {
    throw new Error('No yacht in the catalog meets the requested location, capacity, duration, and budget.');
  }

  const planSchema = z.object({
    selected_yacht_id: z.string(),
    selected_theme_id: z.string(),
    marine_forecast: z.string(),
    safety_protocols: z.array(z.string()),
  });
  const plannerAgent = createReactAgent({
    llm: getVertexModel(),
    tools: [],
    name: 'charter_planning_agent',
    prompt:
      'You are the yacht planning agent. Choose one yacht only from the supplied eligible candidates and one theme from the supplied theme catalog. Use each selected item ID exactly. Provide a forecast assessment for the requested date and location, and safety protocols. If current marine data is unavailable to you, clearly say the forecast is an estimate that must be verified with the harbor authority. Never invent catalog facts.',
    responseFormat: planSchema,
  });
  const result = await plannerAgent.invoke({
    messages: [
      new HumanMessage(
        JSON.stringify(
          {
            requirements,
            eligible_yachts: candidates,
            themes,
          },
          null,
          2
        )
      ),
    ],
  });
  const planned = planSchema.parse(result.structuredResponse);

  const yacht = candidates.find((candidate) => candidate.id === planned.selected_yacht_id);
  if (!yacht) throw new Error('The planning agent selected a yacht outside the eligible catalog results.');
  const theme = themes.find((candidate) => candidate.id === planned.selected_theme_id);
  if (!theme) throw new Error('The planning agent selected a theme outside the theme catalog.');

  return {
    requirements,
    yacht,
    theme,
    marine_forecast: planned.marine_forecast,
    safety_protocols: planned.safety_protocols,
    total_cost: yacht.rate_hr * (requirements.duration_hr ?? 0),
  };
}

async function presentItinerary(plan: ItineraryPlan): Promise<string> {
  const presenterAgent = createReactAgent({
    llm: getVertexModel(8192),
    tools: [],
    name: 'charter_itinerary_presenter',
    prompt: `You are the itinerary presentation agent. Write a complete, polished yacht itinerary using only the supplied plan data. The client parses the following exact Markdown fields, so reproduce the heading and labels exactly and keep each summary field on its own line:
### Booking Summary & Curated Charter Itinerary
- **Location:** value
- **Date:** value
- **Time:** value
- **Duration:** value
- **Guests:** value

Include sections for vessel allocation, theme and ambiance, pricing and inclusions, safety and marine forecast, and yacht photos. Include a Markdown image for every supplied yacht photo URL. State the hourly rate and total cost accurately. Do not add unsupported services or facts. Return only the itinerary Markdown.`,
  });
  const response = await presenterAgent.invoke({
    messages: [new HumanMessage(JSON.stringify(plan, null, 2))],
  });
  const responseMessage = [...response.messages]
    .reverse()
    .find((message) => message._getType() === 'ai' && !(message as { tool_calls?: unknown[] }).tool_calls?.length);
  if (!responseMessage) throw new Error('The itinerary presenter agent returned no final message.');

  const itinerary = modelText(responseMessage.content).trim();
  const requiredFields = [
    /^### Booking Summary & Curated Charter Itinerary$/m,
    /^- \*\*Location:\*\* .+$/m,
    /^- \*\*Date:\*\* .+$/m,
    /^- \*\*Time:\*\* .+$/m,
    /^- \*\*Duration:\*\* .+$/m,
    /^- \*\*Guests:\*\* .+$/m,
  ];
  if (requiredFields.some((pattern) => !pattern.test(itinerary))) {
    throw new Error('The presenter agent did not return the required itinerary format.');
  }
  for (const photo of plan.yacht.photos) {
    const escapedPhoto = photo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`!\\[[^\\]]*\\]\\(${escapedPhoto}\\)`).test(itinerary)) {
      throw new Error(`The presenter agent omitted the catalog photo ${photo}.`);
    }
  }
  return itinerary;
}

const itineraryGeneratorTool = tool(
  async ({ conversation, supervisor_selected_yacht }) => {
    const extractedRequirements = await interpretRequirements(conversation);
    const requirements = {
      ...extractedRequirements,
      requested_yacht_name: supervisor_selected_yacht || extractedRequirements.requested_yacht_name,
    };
    const requiredFields: (keyof UserRequirements)[] = [
      'location',
      'date',
      'start_time',
      'duration_hr',
      'guests',
      'occasion',
    ];
    const missing = requiredFields.filter((field) => requirements[field] == null || requirements[field] === '');

    if (missing.length > 0) {
      return JSON.stringify({ status: 'needs_details', missing, requirements });
    }

    const plan = await planItinerary(requirements);
    return await presentItinerary(plan);
  },
  {
    name: 'itinerary_generator',
    description:
      'Generate a charter itinerary only when the guest explicitly asks for one. It runs the requirements interpreter, yacht/theme/forecast planner, and itinerary presenter AI agents. It asks for missing details instead of guessing.',
    schema: z.object({
      conversation: z.string().describe('The relevant guest and concierge conversation to interpret.'),
      supervisor_selected_yacht: z
        .string()
        .optional()
        .describe('A yacht the supervisor already selected from yacht_checker. Omit it to let the planner choose.'),
    }),
  }
);

export function createYachtAgentGraph() {
  const supervisor = getVertexModel();
  return createReactAgent({
    llm: supervisor,
    tools: [yachtCheckerTool, itineraryGeneratorTool],
    name: 'yacht_concierge_supervisor',
    prompt:
      'You are Ariel, a warm and knowledgeable yacht charter concierge for Mumbai and Goa. Converse naturally and gather the guest’s location, date, start time, duration, guest count, and occasion. Use yacht_checker for yacht facts and never invent inventory details or live availability. Call itinerary_generator only after the guest explicitly asks you to prepare an itinerary; include the full conversation in its input and pass supervisor_selected_yacht only when you have selected that yacht from yacht_checker. Omit supervisor_selected_yacht otherwise. If the generator reports missing details, ask the guest for those details and wait. When it returns an itinerary, pass the complete itinerary back unchanged as your answer. Do not claim a booking has been made.',
  });
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
