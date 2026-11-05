import { z } from 'zod/v3';

export interface Yacht {
  id: string; yacht_name: string; size_ft: number; type: string; max_capacity: number; crew: number;
  location: string; rate_hr: number; min_duration_hr: number; routes: string[]; boarding_point: string;
  photos: string[]; occasion: string[]; features: string[]; inclusions: string[]; food_included: boolean; vibe: string[];
}

export interface Theme {
  id: string; theme_name: string; vibe_tags: string[]; occasion_tags: string[]; decor: string[];
  music_keywords: string[]; mood_description: string; food_and_drinks: string[];
}

export const RequirementsSchema = z.object({
  location: z.enum(['Goa', 'Mumbai']).optional(), date: z.string().optional(), start_time: z.string().optional(),
  duration_hr: z.number().optional(), guests: z.number().optional(), occasion: z.string().optional(),
  budget_total: z.number().optional(), requested_yacht_name: z.string().optional(),
});
export type UserRequirements = z.infer<typeof RequirementsSchema>;

export interface ItineraryPlan {
  requirements: UserRequirements; yacht: Yacht; theme: Theme; marine_forecast: string;
  safety_protocols: string[]; total_cost: number;
}

export const PlanResultSchema = z.object({
  selected_yacht_id: z.string(), selected_theme_id: z.string(), marine_forecast: z.string(), safety_protocols: z.array(z.string()),
});
