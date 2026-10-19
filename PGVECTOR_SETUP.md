# Semantic Search & pgvector Readiness

The hybrid semantic search logic and embedding integration layer are implemented, but currently inactive due to the environment lacking the PostgreSQL `vector` extension. 

When the database environment can support `pgvector`, follow these exact steps to enable Semantic Search.

## 1. Current Status
*   **Feature Flag**: `IS_PGVECTOR_ENABLED = false`
*   **Database Extension**: Missing.
*   **Semantic Search**: Safely bypassing vector operations, falling back to pure V1 ILIKE Keyword Search.

## 2. Required Setup Steps

### Step 2.1: Enable the Extension
Execute the following on your PostgreSQL instance:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 2.2: Apply Schema Migration
Add the `embedding` column to the `listings` table. The model (`text-embedding-3-small`) requires **1536** dimensions.
```sql
ALTER TABLE listings ADD COLUMN embedding vector(1536);
```

### Step 2.3: Add an HNSW Index (Optional but Recommended)
For high-performance semantic search over large datasets:
```sql
CREATE INDEX ON listings USING hnsw (embedding vector_cosine_ops);
```

### Step 2.4: Enable the Feature Flag
In `src/services/listing.service.js` and `scripts/backfill-embeddings.js`, switch:
```javascript
const IS_PGVECTOR_ENABLED = true;
```

### Step 2.5: Execute the Backfill
Run the controlled backfill script to calculate vectors for all existing listings. It processes in safe batches of 50 to prevent OpenAI API throttling.
```bash
node scripts/backfill-embeddings.js
```

## 3. Embedding Architecture
*   **Model**: OpenAI `text-embedding-3-small`
*   **Dimensions**: 1536 (Float)
*   **Format Pipeline**: `Title: {title} | Category: {category} | Condition: {condition} | Description: {description}`
*   **Sensitive Data Protection**: Fields like `password_hash`, `email`, and `seller_id` are completely stripped from the text injection boundary before transit to OpenAI.

## 4. Search Behavior (When Enabled)
The `listing.service.js` calculates a hybrid score mathematically bridging keyword density and semantic distance. 
*   **Equation**: `ORDER BY (0.5 * keyword_match_flag) + (0.5 * (1 - cosine_distance))`
*   **Authoritative Constraints**: Mandatory marketplace states (`status = 'available'`) are executed strictly prior to vector ranking, ensuring AI semantic interpretations cannot resurrect sold items.
