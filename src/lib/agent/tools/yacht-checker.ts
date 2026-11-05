import { tool } from '@langchain/core/tools';
import { z } from 'zod/v3';
import { loadCatalog } from '../data/catalog';

export const yachtCheckerTool = tool(
  async ({ location, guests, yacht_name }) => {
    const { yachts } = loadCatalog();
    const name = yacht_name?.trim().toLowerCase();
    const matches = yachts.filter((yacht) =>
      (!location || yacht.location.toLowerCase() === location.toLowerCase()) &&
      (!guests || yacht.max_capacity >= guests) &&
      (!name || yacht.yacht_name.toLowerCase().includes(name))
    );
    return JSON.stringify({ yachts: matches });
  },
  {
    name: 'yacht_checker',
    description: 'Look up catalog capacity, location, rates, routes, boarding, photos, features, inclusions, and occasions. No live booking availability is stored. Do not invent facts.',
    schema: z.object({ location: z.enum(['Goa', 'Mumbai']).optional(), guests: z.number().optional(), yacht_name: z.string().optional() }),
  }
);
