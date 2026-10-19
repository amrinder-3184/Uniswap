import OpenAI from 'openai';
import '../config/env.js';

// We export the client so it can be mocked in tests
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'mock-key',
  timeout: 10000 // Explicit 10s timeout
});

const EXPECTED_DIMENSIONS = 1536;
const EMBEDDING_MODEL = "text-embedding-3-small";

export const validateEmbedding = (vector) => {
  if (!Array.isArray(vector)) {
    throw new Error("Embedding is not a valid array");
  }
  if (vector.length !== EXPECTED_DIMENSIONS) {
    throw new Error(`Embedding has incorrect dimensions: expected ${EXPECTED_DIMENSIONS}, got ${vector.length}`);
  }
  for (const val of vector) {
    if (typeof val !== 'number' || isNaN(val)) {
      throw new Error("Embedding contains non-numeric values");
    }
  }
  return vector;
};

export const getEmbedding = async (text) => {
  if (!text || typeof text !== 'string') return null;
  const sanitizedText = text.trim().substring(0, 8000);
  if (!sanitizedText) return null;
  
  try {
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: sanitizedText,
      encoding_format: "float",
    });
    
    return validateEmbedding(response.data[0].embedding);
  } catch (error) {
    // Log internally but do not crash the application
    console.error("[Embedding Service] Failed:", error.message);
    return null;
  }
};

export const formatListingForEmbedding = (listing) => {
  // Ensure strict exclusion of sensitive fields.
  // Explicitly mapping allowed fields protects against arbitrary object injection.
  const title = listing.title ? String(listing.title).trim() : 'Unknown';
  const category = listing.category_name ? String(listing.category_name).trim() : 'Unknown';
  const condition = listing.condition ? String(listing.condition).trim() : 'Unknown';
  const description = listing.description ? String(listing.description).trim() : '';

  return `Title: ${title} | Category: ${category} | Condition: ${condition} | Description: ${description}`.trim();
};

export const generateListingEmbedding = async (listing) => {
  if (!listing) return null;
  const formattedText = formatListingForEmbedding(listing);
  return await getEmbedding(formattedText);
};

export const generateQueryEmbedding = async (query) => {
  return await getEmbedding(query);
};


