import pool from '../db.js';
import { generateListingEmbedding } from '../src/services/embedding.service.js';

// Currently set to false as pgvector is not available.
// If set to true, it would require the 'embedding' column on the 'listings' table.
const IS_PGVECTOR_ENABLED = false;
const BATCH_SIZE = 50;
const DELAY_MS = 1000;

const delay = (ms) => new Promise(res => setTimeout(res, ms));

const runBackfill = async () => {
  console.log("==================================================");
  console.log("SEMANTIC EMBEDDING BACKFILL");
  console.log("==================================================");

  if (!IS_PGVECTOR_ENABLED) {
    console.warn("[WARNING] 'IS_PGVECTOR_ENABLED' is false.");
    console.warn("The database does not currently support pgvector.");
    console.warn("Backfill is running in dry-run mode (simulating batches and formatting) to protect the DB.");
  }

  try {
    // In a real scenario, this would be: 
    // SELECT l.id, l.title, l.description, l.condition, c.name as category_name FROM listings l LEFT JOIN categories c ON l.category_id = c.id WHERE l.embedding IS NULL
    const query = `
      SELECT l.id, l.title, l.description, l.condition, c.name as category_name 
      FROM listings l 
      LEFT JOIN categories c ON l.category_id = c.id
      ORDER BY l.id ASC
    `;
    const result = await pool.query(query);
    const listings = result.rows;

    console.log(`Found ${listings.length} listings to process.`);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < listings.length; i += BATCH_SIZE) {
      const batch = listings.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)...`);

      // Process batch sequentially to strictly control rate limits
      for (const listing of batch) {
        try {
          if (IS_PGVECTOR_ENABLED) {
            // Real execution
            const vector = await generateListingEmbedding(listing);
            if (vector) {
              await pool.query('UPDATE listings SET embedding = $1 WHERE id = $2', [JSON.stringify(vector), listing.id]);
              succeeded++;
            } else {
              failed++;
            }
          } else {
            // Dry run execution
            succeeded++;
          }
        } catch (error) {
          console.error(`[Listing ${listing.id}] Error:`, error.message);
          failed++;
        }
        processed++;
      }

      console.log(`Batch complete. Pausing for ${DELAY_MS}ms to respect API rate limits...`);
      if (i + BATCH_SIZE < listings.length) {
        await delay(DELAY_MS);
      }
    }

    console.log("\n==================================================");
    console.log("BACKFILL COMPLETE");
    console.log("==================================================");
    console.log(`Processed: ${processed}`);
    console.log(`Succeeded: ${succeeded}`);
    console.log(`Failed:    ${failed}`);

  } catch (error) {
    console.error("Backfill failed:", error);
  } finally {
    pool.end();
  }
};

runBackfill();
