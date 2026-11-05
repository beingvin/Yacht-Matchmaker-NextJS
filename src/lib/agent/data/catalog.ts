import fs from 'fs';
import path from 'path';
import type { Theme, Yacht } from '../state';

export function loadCatalog(): { yachts: Yacht[]; themes: Theme[] } {
  const dataDir = path.join(process.cwd(), 'data');
  return {
    yachts: JSON.parse(fs.readFileSync(path.join(dataDir, 'yacht_data.json'), 'utf-8')),
    themes: JSON.parse(fs.readFileSync(path.join(dataDir, 'theme_templates.json'), 'utf-8')),
  };
}
