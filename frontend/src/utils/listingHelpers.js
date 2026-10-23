// Small pure helpers that translate backend API responses for the UI.
// They take the API base URL as an argument instead of reading import.meta.env,
// so they can be unit-tested with plain Node (see tests/).

// GET /listings/:id/images returns objects shaped like
// { id, listing_id, image_url: "/uploads/listings/<file>", display_order, created_at }.
// image_url is a path on the backend, so it must be prefixed with the API base URL.
export const buildImageSrc = (apiBaseUrl, image) => {
  if (!image || typeof image.image_url !== 'string' || image.image_url === '') return null;
  return `${apiBaseUrl}${image.image_url}`;
};

// GET /favorites returns listing objects where `id` IS the listing id:
// { id, title, description, price, condition, category_id, category_name, favorited_at }.
// There is no listing_id field. Ids are compared as strings because the listing id
// from the URL is a string while the API returns numbers.
export const isListingInFavorites = (favorites, listingId) => {
  if (!Array.isArray(favorites) || listingId === undefined || listingId === null) return false;
  return favorites.some((favorite) => String(favorite.id) === String(listingId));
};

// Sort choices offered by the browse page, limited to what GET /listings accepts
// (sortBy: price | created_at | title, order: asc | desc).
export const SORT_OPTIONS = [
  { value: 'created_at-desc', label: 'Newest first', sortBy: 'created_at', order: 'desc' },
  { value: 'created_at-asc', label: 'Oldest first', sortBy: 'created_at', order: 'asc' },
  { value: 'price-asc', label: 'Price: low to high', sortBy: 'price', order: 'asc' },
  { value: 'price-desc', label: 'Price: high to low', sortBy: 'price', order: 'desc' },
  { value: 'title-asc', label: 'Title: A to Z', sortBy: 'title', order: 'asc' },
];

export const DEFAULT_SORT = SORT_OPTIONS[0].value;
export const LISTINGS_PER_PAGE = 12;
export const MAX_SEARCH_LENGTH = 200; // backend rejects longer search terms

// Builds the query string for GET /listings. Empty values are left out, because
// the backend rejects a blank `search` and validates every parameter it receives.
export const buildListingsQuery = ({ search = '', category = '', sort = DEFAULT_SORT, page = 1, limit = LISTINGS_PER_PAGE } = {}) => {
  const params = new URLSearchParams();
  const trimmedSearch = String(search).trim();
  if (trimmedSearch !== '') params.set('search', trimmedSearch.slice(0, MAX_SEARCH_LENGTH));
  if (category !== '' && category !== null && category !== undefined) params.set('category', String(category));

  const sortOption = SORT_OPTIONS.find((option) => option.value === sort) || SORT_OPTIONS[0];
  params.set('sortBy', sortOption.sortBy);
  params.set('order', sortOption.order);

  const pageNumber = Number.isInteger(Number(page)) && Number(page) > 0 ? Number(page) : 1;
  params.set('page', String(pageNumber));
  params.set('limit', String(limit));
  return params.toString();
};

// Reads browse filters from a URL query string (e.g. window.location.search),
// so search results can be bookmarked and survive a page reload.
export const parseBrowseFilters = (queryString = '') => {
  const params = new URLSearchParams(queryString);
  const sort = params.get('sort');
  const page = Number(params.get('page'));
  return {
    search: params.get('search') || '',
    category: /^[1-9]\d*$/.test(params.get('category') || '') ? params.get('category') : '',
    sort: SORT_OPTIONS.some((option) => option.value === sort) ? sort : DEFAULT_SORT,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
};

// The browse page's own URL (/browse?...) for the given filters, omitting defaults
export const buildBrowseUrl = ({ search = '', category = '', sort = DEFAULT_SORT, page = 1 } = {}) => {
  const params = new URLSearchParams();
  if (String(search).trim() !== '') params.set('search', String(search).trim());
  if (category) params.set('category', String(category));
  if (sort && sort !== DEFAULT_SORT) params.set('sort', sort);
  if (page > 1) params.set('page', String(page));
  const query = params.toString();
  return query ? `/browse?${query}` : '/browse';
};
