import { tool } from '@langchain/core/tools';
import { z } from 'zod/v3';
import { loadCatalog } from '../data/catalog';

export const yachtCheckerTool = tool(async ({ location, guests, yacht_name }) => {
  const { yachts } = loadCatalog();
  const normalizedName = yacht_name?.trim().toLowerCase();
  const matches = yachts.filter((yacht) => {
    if (location && yacht.location.toLowerCase() !== location.toLowerCase()) return false;
    if (guests && yacht.max_capacity < guests) return false;
    if (normalizedName && !yacht.yacht_name.toLowerCase().includes(normalizedName)) return false;
    return true;
  });
  return JSON.stringify({ yachts: matches });
}, {
  name: 'yacht_checker',
  description: 'Look up yacht catalog details such as capacity, location, rates, routes, boarding point, photos, features, inclusions, and occasions. Use this for yacht questions. The catalog does not contain live booking availability. Do not invent catalog facts.',
  schema: z.object({ location: z.string().optional(), guests: z.number().optional(), yacht_name: z.string().optional() }),
});
