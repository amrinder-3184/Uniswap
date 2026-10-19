-- UniSwap database schema.
--
-- Mirrors the structure of the live development database (verified with
-- pg_dump --schema-only). Every statement uses IF NOT EXISTS, so running this
-- file against a database that already has these tables changes nothing and
-- never deletes data. It contains no DROP or TRUNCATE statements.
--
-- Apply with:  psql -d <database> -f schema.sql

-- Users must exist before anything that references them
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(50) DEFAULT 'student',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS listings (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    condition VARCHAR(100) NOT NULL,
    seller_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id INT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold'))
);

CREATE TABLE IF NOT EXISTS listing_images (
    id SERIAL PRIMARY KEY,
    listing_id INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorites (
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    listing_id INT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_not_self_message CHECK (sender_id <> receiver_id)
);

-- Transactions keep their history when a user or listing is deleted (SET NULL)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    listing_id INT REFERENCES listings(id) ON DELETE SET NULL,
    buyer_id INT REFERENCES users(id) ON DELETE SET NULL,
    seller_id INT REFERENCES users(id) ON DELETE SET NULL,
    purchase_price NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images (listing_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), listing_id);
CREATE INDEX IF NOT EXISTS idx_messages_listing ON messages (listing_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages (sender_id);

CREATE INDEX IF NOT EXISTS idx_transactions_buyer ON transactions (buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_listing ON transactions (listing_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller ON transactions (seller_id);
