import { ChatVertexAI } from '@langchain/google-vertexai';
import fs from 'fs';
import path from 'path';

let cachedVertexModel: ChatVertexAI | null = null;
let cachedModelKey: string | null = null;

export function getVertexModel(maxTokens = 4096): ChatVertexAI {
  const modelName = process.env.VERTEX_MODEL;
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION;
  if (!modelName || !keyFile || !project || !location) {
    throw new Error('Vertex AI requires VERTEX_MODEL, GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_CLOUD_PROJECT, and GOOGLE_CLOUD_LOCATION.');
  }
  const keyPath = path.resolve(/*turbopackIgnore: true*/ process.cwd(), keyFile);
  if (!fs.existsSync(keyPath)) throw new Error(`Vertex AI credentials file was not found at ${keyPath}.`);
  const cacheKey = `${modelName}:${keyPath}:${project}:${location}:${maxTokens}`;
  if (cachedVertexModel && cachedModelKey === cacheKey) return cachedVertexModel;
  cachedVertexModel = new ChatVertexAI({ authOptions: { keyFile: keyPath }, model: modelName, temperature: 0.3, maxOutputTokens: maxTokens, location });
  cachedModelKey = cacheKey;
  return cachedVertexModel;
}
