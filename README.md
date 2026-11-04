# Yacht Matchmaker - Lite

AI-powered luxury yacht charter concierge for the coastlines of Mumbai and Goa, built with Next.js App Router, Tailwind CSS, LangGraph, and Google Cloud Vertex AI (`gemini-2.5-flash`).

## Getting Started

First, ensure your environment variables are configured in `.env.local`:

```bash
GOOGLE_APPLICATION_CREDENTIALS=./gcp-key.json
GOOGLE_CLOUD_PROJECT=gen-lang-client-0879227859
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_MODEL=gemini-2.5-flash
GEMINI_MODEL=gemini-2.5-flash
```

Then run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to experience the luxury yacht concierge.
