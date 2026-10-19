import fs from 'fs';
import path from 'path';
import pool from '../db.js';

// Configuration
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'listings');

async function reapOrphanedImages() {
  console.log('Starting orphaned image cleanup...');
  let scanned;
  let referenced = 0;
  let orphaned = 0;
  let deleted = 0;
  let failed = 0;

  try {
    // 1. Verify directory exists
    if (!fs.existsSync(UPLOADS_DIR)) {
      console.log(`Upload directory does not exist at ${UPLOADS_DIR}. Nothing to clean.`);
      process.exit(0);
    }

    // 2. Scan physical files
    const files = fs.readdirSync(UPLOADS_DIR);
    scanned = files.length;
    
    if (scanned === 0) {
      console.log('No files found in upload directory.');
    } else {
      console.log(`Scanned ${scanned} files on disk. Identifying database references...`);

      // 3. Query database for all valid image references
      const result = await pool.query('SELECT image_url FROM listing_images');
      // Convert database rows to a Set of basenames to avoid path issues
      const validFilenames = new Set(result.rows.map(row => path.basename(row.image_url)));
      
      // 4. Determine orphans and delete
      for (const file of files) {
        if (validFilenames.has(file)) {
          referenced++;
        } else {
          orphaned++;
          const physicalPath = path.join(UPLOADS_DIR, file);
          try {
            fs.unlinkSync(physicalPath);
            deleted++;
            console.log(`Deleted orphaned file: ${file}`);
          } catch (err) {
            failed++;
            console.error(`Failed to delete orphaned file ${file}:`, err.message);
          }
        }
      }
    }

    console.log('\n=== Cleanup Summary ===');
    console.log(`Scanned:    ${scanned}`);
    console.log(`Referenced: ${referenced}`);
    console.log(`Orphaned:   ${orphaned}`);
    console.log(`Deleted:    ${deleted}`);
    console.log(`Failed:     ${failed}`);

  } catch (error) {
    console.error('Fatal error during cleanup execution:', error);
  } finally {
    // Graceful exit
    await pool.end();
    process.exit(0);
  }
}

// Ensure the script executes automatically when run
reapOrphanedImages();
