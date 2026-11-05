# Yacht Matchmaker - Lite

AI-powered luxury yacht charter concierge for the coastlines of Mumbai and Goa, built with Next.js App Router, Tailwind CSS, LangGraph, and Google Cloud Vertex AI (`gemini-2.5-flash`).

## Agent workflow

- The Ariel supervisor is a LangGraph ReAct agent with two tools: `yacht_checker` for catalog facts and `itinerary_generator` for itinerary requests.
- The itinerary tool runs three separate LangGraph agents: a booking requirements interpreter, a charter planner, and an itinerary presenter.
- The interpreter returns structured JSON and leaves missing details null. The supervisor asks the guest for missing information; the generator does not fill it with defaults.
- The planner selects from the yacht and theme catalogs, and the presenter returns Markdown using the summary labels parsed by the UI.
- Agent or model failures are surfaced as errors. The itinerary workflow has no canned itinerary or model fallback.

The curated theme data in `data/theme_catalog.json` is input inventory for planning, not an itinerary response template.

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
