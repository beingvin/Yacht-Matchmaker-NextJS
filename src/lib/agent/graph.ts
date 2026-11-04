import { Annotation, StateGraph, END, START } from '@langchain/langgraph';
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages';
import { ChatVertexAI } from '@langchain/google-vertexai';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

let cachedVertexModel: ChatVertexAI | null = null;
let cachedModelKey: string | null = null;

export function getVertexModel(maxTokens = 4096): ChatVertexAI | null {
  const modelName = process.env.VERTEX_MODEL || process.env.GEMINI_MODEL;
  if (!modelName) return null;

  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
    ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.GOOGLE_APPLICATION_CREDENTIALS)
    : path.resolve(process.cwd(), 'gcp-key.json');

  if (!fs.existsSync(keyPath)) {
    return null;
  }

  const cacheKey = `${modelName}:${keyPath}:${process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'}:${maxTokens}`;
  if (cachedVertexModel && cachedModelKey === cacheKey) {
    return cachedVertexModel;
  }

  try {
    cachedVertexModel = new ChatVertexAI({
      authOptions: {
        keyFile: keyPath,
      },
      model: modelName,
      temperature: 0.3,
      maxOutputTokens: maxTokens,
      location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    });
    cachedModelKey = cacheKey;
    return cachedVertexModel;
  } catch (err) {
    console.error('Failed to initialize ChatVertexAI:', err);
    return null;
  }
}

// Seed data interfaces
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

export interface ThemeTemplate {
  id: string;
  theme_name: string;
  vibe_tags: string[];
  occasion_tags: string[];
  decor: string[];
  music_keywords: string[];
  mood_description: string;
  food_and_drinks: string[];
}

export interface UserRequirements {
  location: string;
  date: string;
  start_time: string;
  duration_hr: number;
  guests: number;
  occasion: string;
  budget_total?: number;
}

// State Definition
export const YachtAgentAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
  user_requirements: Annotation<UserRequirements | any>({ reducer: (_, y) => y }),
  matched_yacht_data: Annotation<Yacht | any>({ reducer: (_, y) => y }),
  matched_theme_data: Annotation<ThemeTemplate | any>({ reducer: (_, y) => y }),
  safety_summary: Annotation<string | undefined>({ reducer: (_, y) => y }),
  combined_plan_data: Annotation<any>({ reducer: (_, y) => y }),
  final_itinerary: Annotation<string | undefined>({ reducer: (_, y) => y }),
  action_type: Annotation<'chat' | 'pipeline'>({ reducer: (_, y) => y, default: () => 'chat' }),
  response_text: Annotation<string | undefined>({ reducer: (_, y) => y }),
});

export type YachtAgentState = typeof YachtAgentAnnotation.State;

// Helper to load seed data
function loadSeedData(): { yachts: Yacht[]; themes: ThemeTemplate[] } {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const yachtsRaw = fs.readFileSync(path.join(dataDir, 'yacht_data.json'), 'utf-8');
    const themesRaw = fs.readFileSync(path.join(dataDir, 'theme_templates.json'), 'utf-8');
    return {
      yachts: JSON.parse(yachtsRaw),
      themes: JSON.parse(themesRaw),
    };
  } catch (err) {
    console.error('Error loading seed data:', err);
    return { yachts: [], themes: [] };
  }
}

// Helper: extract booking details from user utterances as baseline
export function extractBookingDetailsFromTexts(userTexts: string[]): Partial<UserRequirements> {
  const details: Partial<UserRequirements> = {};
  const lowerAll = userTexts.join('\n').toLowerCase();

  for (let i = userTexts.length - 1; i >= 0; i--) {
    const t = userTexts[i].toLowerCase();
    if (t.includes('mumbai') && !t.includes('goa')) {
      details.location = 'Mumbai';
      break;
    } else if (t.includes('goa') && !t.includes('mumbai')) {
      details.location = 'Goa';
      break;
    } else if (t.includes('mumbai') && t.includes('goa')) {
      details.location = t.lastIndexOf('mumbai') > t.lastIndexOf('goa') ? 'Mumbai' : 'Goa';
      break;
    }
  }

  const guestMatch =
    lowerAll.match(/(\d+)\s*(?:guests?|people|persons?|pax|adults?)/i) ||
    lowerAll.match(/(?:party of)\s*(\d+)/i) ||
    lowerAll.match(/(?:for)\s*(\d+)\s*(?:guests?|people|persons?|pax|adults?)/i);

  if (guestMatch) {
    details.guests = parseInt(guestMatch[1], 10);
  }

  const durationMatch = lowerAll.match(/(\d+)\s*(?:hours?|hrs?)/i);
  if (durationMatch) {
    details.duration_hr = parseInt(durationMatch[1], 10);
  }

  const timeMatch =
    lowerAll.match(/(?:at|from)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i) ||
    lowerAll.match(/(\d{1,2}:\d{2})/);
  if (timeMatch) {
    details.start_time = timeMatch[1].trim();
  }

  const dateMatch =
    lowerAll.match(/\b(202\d-\d{2}-\d{2})\b/) ||
    lowerAll.match(/\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(?:202\d)?)\b/i) ||
    lowerAll.match(/\b(today|tomorrow|this saturday|this sunday|next saturday|next sunday|saturday|sunday|friday)\b/i);

  if (dateMatch) {
    details.date = dateMatch[1];
  }

  if (lowerAll.includes('birthday')) details.occasion = 'Birthday party';
  else if (lowerAll.includes('anniversary')) details.occasion = 'Anniversary celebration';
  else if (lowerAll.includes('sunset')) details.occasion = 'Sunset cruise';
  else if (lowerAll.includes('bachelor') || lowerAll.includes('bachelorette')) details.occasion = 'Bachelor party';
  else if (lowerAll.includes('corporate')) details.occasion = 'Corporate charter';
  else if (lowerAll.includes('family')) details.occasion = 'Family hangout';

  const budgetMatch = lowerAll.match(/\b(?:₹|rs\.?|inr|budget)\s*[:=]?\s*₹?\s*([\d,]+)\b/i);
  if (budgetMatch) {
    details.budget_total = parseInt(budgetMatch[1].replace(/,/g, ''), 10);
  }

  return details;
}

export function extractBookingDetails(text: string): Partial<UserRequirements> {
  return extractBookingDetailsFromTexts([text]);
}

/**
 * 1. supervisorNode:
 * 100% LLM-driven luxury concierge interaction.
 * Ariel converses dynamically with guests, recommends yachts from the catalog,
 * checks boundaries, gathers requirements, and routes to 'pipeline' when the guest confirms.
 */
export async function supervisorNode(state: YachtAgentState): Promise<Partial<YachtAgentState>> {
  const model = getVertexModel();
  if (!model) {
    throw new Error('Vertex AI model is not configured. Please check your GOOGLE_APPLICATION_CREDENTIALS and VERTEX_MODEL.');
  }

  const messages = state.messages;
  const lastMessage = messages[messages.length - 1];
  const lastUserText = lastMessage ? lastMessage.content.toString().trim() : '';
  const lowerUserText = lastUserText.toLowerCase();

  const userMessages = messages.filter((m) => m._getType() === 'human' || (m as any).sender === 'user');
  const userTexts = userMessages.map((m) => m.content.toString());
  const extractedDetails = extractBookingDetailsFromTexts(userTexts);

  const isConfirming =
    /\b(yes|proceed|confirm|go ahead|sure|sounds good|book it|do it)\b/i.test(lowerUserText) ||
    /\b(generate|create|prepare|make|build|provide|send|view|show)\b.*\bitinerar/i.test(lowerUserText) ||
    lowerUserText.includes('proceed with itinerary') ||
    lowerUserText.includes('confirm booking');

  // Trigger planning pipeline when user confirms
  if (isConfirming && (extractedDetails.location || extractedDetails.guests || messages.length > 2)) {
    return {
      action_type: 'pipeline',
      user_requirements: extractedDetails,
    };
  }

  // Load catalog for dynamic LLM grounding
  const { yachts } = loadSeedData();
  const fleetCatalog = yachts.map((y) => ({
    name: y.yacht_name,
    location: y.location,
    type: y.type,
    capacity: y.max_capacity,
    rate_hr: `₹${y.rate_hr.toLocaleString('en-IN')}/hr`,
    features: y.features,
    routes: y.routes,
    boarding: y.boarding_point,
  }));

  const systemPrompt = new SystemMessage(
`You are Ariel, the premier luxury concierge for an elite yacht charter house operating exclusively in Mumbai and Goa.
Your Persona: Refined, articulate, warm, deeply hospitable, and genuinely knowledgeable about high-end nautical luxury.

Available Fleet in Catalog:
${JSON.stringify(fleetCatalog, null, 2)}

Operating Principles:
1. Destination Boundary: We operate EXCLUSIVELY in Mumbai and Goa. If guests inquire about any other location (e.g. Dubai, Kerala, Maldives), courteously explain our exclusive focus on Mumbai and Goa coastlines and warmly invite them to experience one of these two premier destinations.
2. Capacity Guidance: Maximum capacity is 20 guests in Goa, and 30 guests in Mumbai. For larger gatherings, suggest our signature VIP Flotilla experience where multiple coordinated vessels cruise together.
3. Engaging & Personalized Consultation:
   - Recommend specific yachts by name from the catalog based on their party size, location, and occasion.
   - Mention real boarding points, scenic routes (e.g., Mandovi River to Grand Island in Goa, or Gateway of India past Mandwa in Mumbai), and amenities.
   - Naturally gather missing details: Location (Goa or Mumbai), Date, Preferred Start Time, Duration (hours), Guest Count, and Occasion.
4. Call to Action:
   - When key details (location, guests, occasion) are shared, summarize the suggested plan and invite them to confirm (e.g., "Shall I prepare your bespoke charter itinerary?").
5. Tone: Elegant, hospitable, concise, and luxurious. Never invent non-existent yachts or robotic confirmation forms.`
  );

  const cleanMessages = messages.map((m) => {
    if (m._getType() === 'human' || (m as any).sender === 'user') {
      return new HumanMessage(m.content.toString());
    }
    return new AIMessage(m.content.toString());
  });

  const aiResponse = await model.invoke([systemPrompt, ...cleanMessages]);
  const reply = aiResponse.content.toString();

  return {
    action_type: 'chat',
    response_text: reply,
    messages: [new AIMessage(reply)],
  };
}

/**
 * 2. needsInterpreterNode:
 * Uses Vertex AI structured output to parse guest requirements from the full chat history.
 */
export async function needsInterpreterNode(state: YachtAgentState): Promise<Partial<YachtAgentState>> {
  const model = getVertexModel();
  const userMessages = state.messages.filter((m) => m._getType() === 'human' || (m as any).sender === 'user');
  const userTexts = userMessages.map((m) => m.content.toString());
  const heuristic = extractBookingDetailsFromTexts(userTexts);

  let requirements: UserRequirements = {
    location: heuristic.location || 'Goa',
    date: heuristic.date || 'Upcoming Weekend',
    start_time: heuristic.start_time || '17:00',
    duration_hr: heuristic.duration_hr || 3,
    guests: heuristic.guests || 6,
    occasion: heuristic.occasion || 'Luxury Sunset Cruise',
  };

  if (model) {
    try {
      const requirementsSchema = z.object({
        location: z.enum(['Goa', 'Mumbai']).catch('Goa').describe("Destination, either 'Goa' or 'Mumbai'"),
        date: z.string().describe("Extracted charter date or spoken date"),
        start_time: z.string().describe("Charter departure time (e.g. 17:00 or 5pm)"),
        duration_hr: z.number().describe("Duration in hours (e.g. 2, 3, 4)"),
        guests: z.number().describe("Number of guests"),
        occasion: z.string().describe("Occasion or type of celebration"),
        budget_total: z.number().optional().describe("Budget in INR if specified"),
      });

      const structuredModel = model.withStructuredOutput(requirementsSchema);
      const fullConversation = state.messages.map((m) => `${m._getType()}: ${m.content.toString()}`).join('\n');
      const parsed = await structuredModel.invoke(
        `Extract the guest's yacht charter requirements from this conversation:\n\n${fullConversation}`
      );

      if (parsed) {
        if (parsed.location) requirements.location = parsed.location;
        if (parsed.date) requirements.date = parsed.date;
        if (parsed.start_time) requirements.start_time = parsed.start_time;
        if (parsed.duration_hr) requirements.duration_hr = parsed.duration_hr;
        if (parsed.guests) requirements.guests = parsed.guests;
        if (parsed.occasion) requirements.occasion = parsed.occasion;
        if (parsed.budget_total) requirements.budget_total = parsed.budget_total;
      }
    } catch (err) {
      console.warn('AI interpreter fallback to heuristic extraction:', err);
    }
  }

  return {
    user_requirements: requirements,
  };
}

/**
 * 3. plannerNode:
 * Uses Vertex AI structured output to match the ideal yacht, theme,
 * and generate live coastal marine forecast and safety protocols.
 */
export async function plannerNode(state: YachtAgentState): Promise<Partial<YachtAgentState>> {
  const model = getVertexModel();
  const { yachts, themes } = loadSeedData();
  const req: UserRequirements = state.user_requirements;
  const locLower = (req.location || 'goa').toLowerCase();
  const guests = req.guests || 6;

  const matchingYachts = yachts.filter(
    (y) => y.location.toLowerCase() === locLower && y.max_capacity >= guests
  );
  const candidates = matchingYachts.length > 0 ? matchingYachts : yachts.filter((y) => y.location.toLowerCase() === locLower);
  const fallbackYacht = candidates[0] || yachts[0];

  let selectedYacht: Yacht = fallbackYacht;
  let selectedTheme: ThemeTemplate = themes[0];
  let safetySummary = '';

  if (model) {
    try {
      const planSchema = z.object({
        selected_yacht_id: z.string().describe("ID of the single best matching yacht from the candidates"),
        selected_theme_id: z.string().describe("ID of the single best celebration theme from the catalog"),
        marine_forecast: z.string().describe("Authentic coastal marine and weather forecast for this destination and timing"),
        safety_protocols: z.array(z.string()).describe("5 mandatory safety protocols tailored to the vessel and guests"),
      });

      const structuredPlanner = model.withStructuredOutput(planSchema);
      const planResult = await structuredPlanner.invoke(
`You are the Lead Yacht Master & Celebration Designer.
Select the single best yacht and celebration theme for this charter, and provide coastal marine conditions and safety protocols.

Guest Requirements:
- Location: ${req.location}
- Guests: ${req.guests}
- Occasion: ${req.occasion}
- Duration: ${req.duration_hr} hours
- Timing: ${req.start_time} on ${req.date}

Candidate Yachts:
${JSON.stringify(candidates.map((y) => ({ id: y.id, name: y.yacht_name, type: y.type, capacity: y.max_capacity, rate: y.rate_hr, features: y.features, routes: y.routes })), null, 2)}

Theme Catalog:
${JSON.stringify(themes.map((t) => ({ id: t.id, name: t.theme_name, vibes: t.vibe_tags, occasions: t.occasion_tags, decor: t.decor })), null, 2)}`
      );

      if (planResult.selected_yacht_id) {
        const foundYacht = yachts.find((y) => y.id === planResult.selected_yacht_id);
        if (foundYacht) selectedYacht = foundYacht;
      }

      if (planResult.selected_theme_id) {
        const foundTheme = themes.find((t) => t.id === planResult.selected_theme_id);
        if (foundTheme) selectedTheme = foundTheme;
      }

      const forecast = planResult.marine_forecast || `${req.location} coastal waters: calm sea state, light breeze, optimal cruising visibility.`;
      const protocols = Array.isArray(planResult.safety_protocols) && planResult.safety_protocols.length > 0
        ? planResult.safety_protocols
        : [
            'Mandatory safety briefing by the Captain & First Mate prior to departure.',
            'Certified life jackets provided and accessible for all passengers.',
            'Strict no-swimming policy after twilight or beyond designated calm anchorages.',
            'Footwear protocol: soft boat deck shoes or barefoot on teak decks.',
            'Zero-litter eco-marine policy in compliance with coastal sanctuary regulations.',
          ];

      safetySummary = `**Coastal Marine Forecast:** ${forecast}\n\n**Mandatory Safety Protocols:**\n${protocols.map((p: string, idx: number) => `${idx + 1}. ${p}`).join('\n')}`;
    } catch (err) {
      console.warn('AI planner error, using catalog fallback:', err);
    }
  }

  if (!safetySummary) {
    const defaultForecast = locLower === 'goa'
      ? '28°C clear coastal skies, mild NW breeze at 8 knots, calm sea state with 0.5m swell, excellent visibility.'
      : '30°C partly cloudy harbor breeze, WSW wind at 10 knots, slight chop with 0.8m swell, optimal cruising conditions.';

    safetySummary = `**Coastal Marine Forecast:** ${defaultForecast}\n\n**Mandatory Safety Protocols:**\n1. Mandatory safety briefing by Captain prior to departure.\n2. Certified life jackets accessible for all guests.\n3. Safe navigation within designated coastal corridors.\n4. Soft deck shoes or barefoot on teak surfaces.\n5. Eco-friendly coastal compliance.`;
  }

  return {
    matched_yacht_data: selectedYacht,
    matched_theme_data: selectedTheme,
    safety_summary: safetySummary,
  };
}

/**
 * 4. compilerNode:
 * Transparent rate and duration compilation.
 */
export async function compilerNode(state: YachtAgentState): Promise<Partial<YachtAgentState>> {
  const yacht: Yacht = state.matched_yacht_data;
  const req: UserRequirements = state.user_requirements;
  const ratePerHour = yacht?.rate_hr || 18000;
  const duration = req?.duration_hr || 3;
  const totalCost = ratePerHour * duration;

  const combinedPlan = {
    requirements: req,
    yacht: yacht,
    theme: state.matched_theme_data,
    safety: state.safety_summary,
    total_cost: totalCost,
    rate_per_hour: ratePerHour,
    duration_hr: duration,
  };

  return {
    combined_plan_data: combinedPlan,
  };
}

/**
 * 5. presenterNode:
 * 100% LLM-composed luxury charter itinerary document.
 * Generates an evocative narrative, customized timeline, pricing breakdown,
 * and photo gallery tailored exclusively to the guest.
 */
export async function presenterNode(state: YachtAgentState): Promise<Partial<YachtAgentState>> {
  const model = getVertexModel(8192);
  const plan = state.combined_plan_data;
  const req: UserRequirements = plan.requirements;
  const yacht: Yacht = plan.yacht;
  const theme: ThemeTemplate = plan.theme;

  const locationCity = req.location.charAt(0).toUpperCase() + req.location.slice(1);
  const totalCostFormatted = `₹${plan.total_cost.toLocaleString('en-IN')}`;
  const rateFormatted = `₹${plan.rate_per_hour.toLocaleString('en-IN')}/hr`;

  const photosMarkdown = (yacht.photos || [])
    .map((p) => `![${yacht.yacht_name}](${p})`)
    .join('\n\n');

  if (model) {
    try {
      const presentationPrompt = `You are Ariel, the lead luxury charter concierge.
Compose a breathtaking, bespoke luxury charter itinerary document for your guest.

Input Data:
- Location: ${locationCity}
- Date: ${req.date}
- Start Time: ${req.start_time}
- Duration: ${req.duration_hr} hours
- Guests: ${req.guests} Guests
- Occasion: ${req.occasion}
- Selected Vessel: ${yacht.yacht_name} (${yacht.size_ft}ft ${yacht.type}, Boarding at ${yacht.boarding_point})
- Routes: ${yacht.routes.join(' -> ')}
- Vessel Features: ${yacht.features.join(', ')}
- Inclusions: ${yacht.inclusions.join(', ')}
- Event Theme: ${theme.theme_name}
- Theme Decor: ${theme.decor.join(', ')}
- Music Style: ${theme.music_keywords.join(', ')}
- Refreshments: ${theme.food_and_drinks.join(', ')}
- Pricing: ${totalCostFormatted} all-inclusive (${rateFormatted} for ${req.duration_hr} hours)
- Safety & Marine Forecast:
${plan.safety}

Format Requirements:
1. MUST begin IMMEDIATELY with this EXACT header on line 1 without any greeting or title beforehand:
### 📝 Booking Summary & Curated Charter Itinerary

- **Location:** ${locationCity}
- **Date:** ${req.date}
- **Time:** ${req.start_time}
- **Duration:** ${req.duration_hr} hours
- **Guests:** ${req.guests} Guests

---

2. Followed by elegant sections:
- #### ⚓ Vessel Allocation (Describe ${yacht.yacht_name}, boarding jetty, cruising route, crew, and amenities)
- #### ✨ Event Theme & Ambiance (Describe ${theme.theme_name}, decor, musical atmosphere, and gourmet refreshments)
- #### ⏱️ Minute-by-Minute Timeline (Create a bespoke, personalized timeline starting at ${req.start_time} through departure with unique moments for ${req.occasion})
- #### 💎 Pricing & Inclusions
Format the pricing breakdown as a strict Markdown table with separate lines for every row and empty lines before and after:

| Description | Price (₹) |
| :--- | :--- |
| Vessel Charter (${yacht.yacht_name}, ${req.duration_hr} hrs) | ${rateFormatted} |
| Master Captain & Dedicated Crew | Included |
| Theme & Bespoke Styling (${theme.theme_name}) | Included |
| Refreshments & Hospitality | Included |
| **Total All-Inclusive** | **${totalCostFormatted}** |

- #### 🛡️ Safety Advisory & Coastal Forecast (Incorporate the provided forecast and safety protocols)
- #### 📸 Yacht Photos
${photosMarkdown}

Compose with utmost elegance, nautical luxury, and sophistication.`;

      const aiResponse = await model.invoke(presentationPrompt);
      let doc = aiResponse.content.toString();

      // Normalize collapsed table rows if any
      doc = doc.replace(/\|\s*\|\s*/g, '|\n| ');

      const summaryIdx = doc.indexOf('### 📝 Booking Summary');
      if (summaryIdx > 0) {
        doc = doc.slice(summaryIdx);
      }

      return {
        final_itinerary: doc,
        response_text: doc,
        messages: [new AIMessage(doc)],
      };
    } catch (err) {
      console.warn('AI presenter error, using structured fallback:', err);
    }
  }

  // Fallback only if model completely unavailable
  const fallbackDocument =
`### 📝 Booking Summary & Curated Charter Itinerary

- **Location:** ${locationCity}
- **Date:** ${req.date}
- **Time:** ${req.start_time}
- **Duration:** ${req.duration_hr} hours
- **Guests:** ${req.guests} Guests

---

#### ⚓ Vessel Allocation
- **Vessel Name:** **${yacht.yacht_name}** (${yacht.size_ft}ft ${yacht.type})
- **Boarding Jetty:** ${yacht.boarding_point}
- **Cruising Route:** ${yacht.routes.map((r) => r.toUpperCase()).join(' ➔ ')}
- **Crew Onboard:** Licensed Master Captain and ${yacht.crew} dedicated service crew
- **Vessel Amenities:** ${yacht.features.join(', ')}

---

#### ✨ Event Theme & Ambiance
- **Curated Theme:** **${theme.theme_name}**
- **Ambiance Profile:** ${theme.mood_description}
- **Decor Elements:** ${theme.decor.join(', ')}
- **Acoustic Signature:** ${theme.music_keywords.join(' • ')}
- **Refreshments Included:** ${theme.food_and_drinks.join(', ')}

---

#### 💎 Pricing & Inclusions
| Component | Details | Amount |
| :--- | :--- | :--- |
| **Vessel Charter** | ${yacht.yacht_name} (${req.duration_hr} hrs @ ${rateFormatted}) | ${totalCostFormatted} |
| **Master Crew & Fuel** | Certified Captain, First Mate, and Coastal Fuel | *Included* |
| **Theme & Decor** | ${theme.theme_name} bespoke arrangement | *Included* |
| **Hospitality Service** | ${yacht.inclusions.join(', ')} | *Included* |
| **Total Charter Fee** | **All-Inclusive Luxury Charter** | **${totalCostFormatted}** |

---

#### 🛡️ Safety Advisory & Coastal Forecast
${plan.safety}

---

### 📸 Yacht Photos
${photosMarkdown}`;

  return {
    final_itinerary: fallbackDocument,
    response_text: fallbackDocument,
    messages: [new AIMessage(fallbackDocument)],
  };
}

// Graph Edges and Compilation
export function createYachtAgentGraph() {
  const workflow = new StateGraph(YachtAgentAnnotation)
    .addNode('supervisor', supervisorNode)
    .addNode('needs_interpreter', needsInterpreterNode)
    .addNode('planner', plannerNode)
    .addNode('compiler', compilerNode)
    .addNode('presenter', presenterNode)
    .addEdge(START, 'supervisor')
    .addConditionalEdges('supervisor', (state) =>
      state.action_type === 'pipeline' ? 'needs_interpreter' : END
    )
    .addEdge('needs_interpreter', 'planner')
    .addEdge('planner', 'compiler')
    .addEdge('compiler', 'presenter')
    .addEdge('presenter', END);

  return workflow.compile();
}
