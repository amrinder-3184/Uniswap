// Unit tests for src/utils/listingHelpers.js using Node's built-in test runner
// (no extra dependencies). Run with: npm test
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildImageSrc,
  isListingInFavorites,
  buildListingsQuery,
  parseBrowseFilters,
  buildBrowseUrl,
  DEFAULT_SORT,
} from '../src/utils/listingHelpers.js';

const API = 'http://localhost:3000';

// Shapes copied from the backend source (uniswap-backend):
// listingImage.service.js -> SELECT id, listing_id, image_url, display_order, created_at
const IMAGE_FROM_API = {
  id: 1,
  listing_id: 7,
  image_url: '/uploads/listings/listing-1791813569509-a8be64ab7ac5.png',
  display_order: 1,
  created_at: '2026-10-12T10:00:00.000Z',
};
// favorite.service.js -> SELECT l.id, l.title, ..., f.created_at AS favorited_at (no listing_id)
const FAVORITES_FROM_API = [
  { id: 7, title: 'Engineering Mathematics textbook', price: '399.50', condition: 'Used', category_id: 1, category_name: 'Books', favorited_at: '2026-10-12T10:00:00.000Z' },
  { id: 12, title: 'Desk lamp', price: '300.00', condition: 'New', category_id: 2, category_name: 'Electronics', favorited_at: '2026-10-12T10:00:00.000Z' },
];

describe('buildImageSrc (bug fix: images use image_url, not url)', () => {
  test('builds the full URL from the image_url field returned by the API', () => {
    assert.equal(buildImageSrc(API, IMAGE_FROM_API), 'http://localhost:3000/uploads/listings/listing-1791813569509-a8be64ab7ac5.png');
  });

  test('the old code path (image.url) would have produced a broken URL', () => {
    assert.equal(IMAGE_FROM_API.url, undefined);
    assert.equal(`${API}${IMAGE_FROM_API.url}`, 'http://localhost:3000undefined');
  });

  test('works with the object returned by POST /listings/:id/images (same shape)', () => {
    const uploaded = { id: 2, listing_id: 7, image_url: '/uploads/listings/listing-2.webp', display_order: 2, created_at: '2026-10-12T10:00:00.000Z' };
    assert.equal(buildImageSrc(API, uploaded), 'http://localhost:3000/uploads/listings/listing-2.webp');
  });

  test('returns null instead of a broken URL when image_url is missing', () => {
    assert.equal(buildImageSrc(API, { id: 3 }), null);
    assert.equal(buildImageSrc(API, null), null);
    assert.equal(buildImageSrc(API, { image_url: '' }), null);
  });
});

describe('isListingInFavorites (bug fix: favorites use id, not listing_id)', () => {
  test('detects a favorited listing by the favorite\'s id field', () => {
    assert.equal(isListingInFavorites(FAVORITES_FROM_API, 7), true);
    assert.equal(isListingInFavorites(FAVORITES_FROM_API, 12), true);
  });

  test('returns false for a listing that is not favorited', () => {
    assert.equal(isListingInFavorites(FAVORITES_FROM_API, 99), false);
  });

  test('matches a string id from the URL against numeric API ids', () => {
    assert.equal(isListingInFavorites(FAVORITES_FROM_API, '7'), true);
  });

  test('the old check (f.listing_id) never matched, so the heart always showed "not favorited"', () => {
    assert.equal(FAVORITES_FROM_API.some((f) => f.listing_id === 7), false);
  });

  test('handles empty or missing data safely', () => {
    assert.equal(isListingInFavorites([], 7), false);
    assert.equal(isListingInFavorites(undefined, 7), false);
    assert.equal(isListingInFavorites(FAVORITES_FROM_API, undefined), false);
  });
});

describe('buildListingsQuery (GET /listings parameters)', () => {
  test('defaults: newest first, page 1, 12 per page, no search or category', () => {
    assert.equal(buildListingsQuery(), 'sortBy=created_at&order=desc&page=1&limit=12');
  });

  test('includes trimmed search, category, sort and page', () => {
    const query = new URLSearchParams(buildListingsQuery({ search: '  maths book ', category: '3', sort: 'price-asc', page: 2 }));
    assert.equal(query.get('search'), 'maths book');
    assert.equal(query.get('category'), '3');
    assert.equal(query.get('sortBy'), 'price');
    assert.equal(query.get('order'), 'asc');
    assert.equal(query.get('page'), '2');
  });

  test('omits a blank search (the backend rejects search=" ")', () => {
    assert.equal(new URLSearchParams(buildListingsQuery({ search: '   ' })).has('search'), false);
  });

  test('only sends sortBy/order values the backend accepts', () => {
    const query = new URLSearchParams(buildListingsQuery({ sort: 'password_hash-asc' }));
    assert.equal(query.get('sortBy'), 'created_at');
    assert.equal(query.get('order'), 'desc');
  });

  test('caps search at the backend limit of 200 characters', () => {
    assert.equal(new URLSearchParams(buildListingsQuery({ search: 'a'.repeat(250) })).get('search').length, 200);
  });

  test('falls back to page 1 for invalid page numbers', () => {
    for (const page of [0, -1, 1.5, 'abc']) {
      assert.equal(new URLSearchParams(buildListingsQuery({ page })).get('page'), '1');
    }
  });

  test('encodes special characters safely', () => {
    const query = buildListingsQuery({ search: "a&b=c' OR 1=1" });
    assert.equal(new URLSearchParams(query).get('search'), "a&b=c' OR 1=1");
  });
});

describe('browse page URL state', () => {
  test('parses filters from the page URL', () => {
    assert.deepEqual(parseBrowseFilters('?search=lamp&category=2&sort=price-desc&page=3'), { search: 'lamp', category: '2', sort: 'price-desc', page: 3 });
  });

  test('ignores invalid values', () => {
    assert.deepEqual(parseBrowseFilters('?category=abc&sort=bogus&page=-4'), { search: '', category: '', sort: DEFAULT_SORT, page: 1 });
  });

  test('round-trips through buildBrowseUrl, leaving out defaults', () => {
    const filters = { search: 'lamp', category: '2', sort: 'price-desc', page: 3 };
    const url = buildBrowseUrl(filters);
    assert.equal(url, '/browse?search=lamp&category=2&sort=price-desc&page=3');
    assert.deepEqual(parseBrowseFilters(url.slice('/browse'.length)), filters);
    assert.equal(buildBrowseUrl({}), '/browse');
  });
});
