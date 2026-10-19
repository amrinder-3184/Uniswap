import * as embeddingService from './src/services/embedding.service.js';
import * as listingService from './src/services/listing.service.js';

// Mock OpenAI implementation
const mockOpenAI = {
  embeddings: {
    create: async ({ input, model }) => {
      if (input === 'FAIL') throw new Error("Mock API Failure");
      if (input === 'BAD_DIMENSION') {
        return { data: [{ embedding: new Array(10).fill(0.1) }] }; // Wrong dimension
      }
      if (input === 'BAD_TYPE') {
        return { data: [{ embedding: new Array(1536).fill('string') }] }; // Non-numeric
      }
      // Return a valid 1536 dimension vector
      return { data: [{ embedding: new Array(1536).fill(0.01) }] };
    }
  }
};

// Override the module's client
embeddingService.openai.embeddings = mockOpenAI.embeddings;

const runTests = async () => {
  let passed = 0;
  let failed = 0;

  const assert = (condition, name) => {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${name}`);
      failed++;
    }
  };

  console.log("==================================================");
  console.log("EMBEDDING PIPELINE EVALUATION");
  console.log("==================================================");

  // A, B, C: Formatting, nulls, sensitive fields
  const mockListing = {
    title: '  Test Laptop  ',
    description: null,
    category_name: undefined,
    condition: 'Used',
    seller_id: 99,
    password_hash: 'secret'
  };
  const formatted = embeddingService.formatListingForEmbedding(mockListing);
  assert(formatted === "Title: Test Laptop | Category: Unknown | Condition: Used | Description:", "A/B: Formats correctly with nulls/undefined");
  assert(!formatted.includes('secret') && !formatted.includes('99'), "C: Excludes sensitive fields (password, seller_id)");

  // D: Valid Response
  const validVector = await embeddingService.getEmbedding("A perfectly normal query");
  assert(Array.isArray(validVector) && validVector.length === 1536, "D: Returns valid 1536 dimension vector");

  // E, F: Rejections
  let caughtWrongDim = false;
  try {
    await embeddingService.getEmbedding("BAD_DIMENSION");
  } catch (e) {
    caughtWrongDim = true; // Wait, getEmbedding catches and returns null.
  }
  const badDimRes = await embeddingService.getEmbedding("BAD_DIMENSION");
  assert(badDimRes === null, "E: Safely rejects incorrect dimensions and returns null");

  const badTypeRes = await embeddingService.getEmbedding("BAD_TYPE");
  assert(badTypeRes === null, "F: Safely rejects non-numeric vectors and returns null");

  // G: Failure handling
  const failRes = await embeddingService.getEmbedding("FAIL");
  assert(failRes === null, "G: OpenAI embedding failure gracefully returns null");

  // H: Query embedding
  const queryRes = await embeddingService.generateQueryEmbedding("test query");
  assert(Array.isArray(queryRes), "H: Abstraction generates query embedding correctly");

  // N: Keyword Search Fallback Still Works
  try {
    const searchRes = await listingService.getListings(null, 1, 10, 'gaming');
    assert(searchRes.data !== undefined, "N: Existing keyword search operates safely without pgvector");
  } catch (e) {
    console.error(e);
    assert(false, "N: Keyword search crashed");
  }

  console.log("==================================================");
  console.log("EVALUATION SUMMARY");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  process.exit(failed > 0 ? 1 : 0);
};

runTests().catch(console.error);
