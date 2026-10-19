import pool from './db.js';

const targetCategories = [
  'Electronics',
  'Books & Study Material',
  'Furniture',
  'Hostel Essentials',
  'Clothing & Accessories',
  'Sports & Fitness',
  'Cycles & Vehicles',
  'Notes & Stationery',
  'Other'
];

const seedCategories = async () => {
  try {
    for (const name of targetCategories) {
      await pool.query(`
        INSERT INTO categories (name) 
        VALUES ($1) 
        ON CONFLICT (name) DO NOTHING
      `, [name]);
      console.log(`Ensured category: ${name}`);
    }
  } catch (err) {
    console.error('Error seeding categories:', err);
  } finally {
    pool.end();
  }
};

seedCategories();
