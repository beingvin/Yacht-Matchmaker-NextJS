# Yacht Matchmaker - Lite

AI-powered luxury yacht charter concierge for the destinations listed in the yacht catalog, built with Next.js App Router, Tailwind CSS, LangGraph, and Google Cloud Vertex AI (`gemini-2.5-flash`).

## Agent workflow

- The Ariel supervisor is a LangGraph ReAct agent with two tools: `yacht_checker` for catalog facts and `itinerary_generator` for itinerary requests.
- The itinerary tool runs three separate LangGraph agents: a booking requirements interpreter, a charter planner, and an itinerary presenter.
- The interpreter returns structured JSON and leaves missing details null. The supervisor asks the guest for missing information; the generator does not fill it with defaults.
- The planner selects from the yacht and theme catalogs, and the presenter returns Markdown using the summary labels parsed by the UI.
- Agent or model failures are surfaced as errors. The itinerary workflow has no canned itinerary or model fallback.

Yacht inventory is loaded from `data/yacht_data.json`, and curated theme inventory, including each theme's recommended timing, is loaded from `data/theme_templates.json`. Theme data guides planning; it is not an itinerary response template. Yacht photos are served from the matching paths under `public/`.

## Getting Started

First, ensure your environment variables are configured in `.env.local`:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./gcp-key.json
GOOGLE_CLOUD_PROJECT=gen-lang-client-0879227859
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-flash
```

Then run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to experience the luxury yacht concierge.
