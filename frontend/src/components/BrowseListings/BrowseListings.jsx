import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';
import {
  SORT_OPTIONS,
  MAX_SEARCH_LENGTH,
  buildListingsQuery,
  parseBrowseFilters,
  buildBrowseUrl,
} from '../../utils/listingHelpers';
import './BrowseListings.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Public page: browse and search available listings using GET /listings.
// Filters are kept in the page URL (/browse?search=...&category=...&sort=...&page=...)
// so results can be bookmarked and survive a reload.
const BrowseListings = () => {
  const [filters, setFilters] = useState(() => parseBrowseFilters(window.location.search));
  const [searchInput, setSearchInput] = useState(filters.search);
  const [categories, setCategories] = useState([]);
  const [listings, setListings] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Categories for the filter dropdown (public endpoint)
  useEffect(() => {
    fetch(API_BASE_URL + '/categories')
      .then(res => (res.ok ? res.json() : []))
      .then(data => {
        const list = Array.isArray(data) ? data : [];
        setCategories(list);
        // A category id from the URL that no longer exists would filter silently while
        // the dropdown shows "All categories", so drop it once the real list is known
        setFilters(prev => (prev.category && list.length > 0 && !list.some(cat => String(cat.id) === prev.category)
          ? { ...prev, category: '', page: 1 }
          : prev));
      })
      .catch(() => setCategories([]));
  }, []);

  // Fetch listings whenever the applied filters change
  useEffect(() => {
    const controller = new AbortController();
    window.history.replaceState(null, '', buildBrowseUrl(filters));

    const fetchListings = async () => {
      let movedToLastPage = false;
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE_URL}/listings?${buildListingsQuery(filters)}`, { signal: controller.signal });
        const data = await res.json().catch(() => ({})); // e.g. an HTML error page from a proxy
        if (!res.ok) {
          throw new Error(Array.isArray(data.errors) ? data.errors.join(' ') : (data.message || 'Failed to load listings.'));
        }
        // A bookmarked page number beyond the last page returns an empty page;
        // jump to the last page that has results instead of showing "no listings"
        const lastPage = data.pagination?.totalPages || 1;
        if ((data.data || []).length === 0 && data.pagination?.total > 0 && filters.page > lastPage) {
          movedToLastPage = true; // stay in the loading state until that request finishes
          setFilters(prev => ({ ...prev, page: lastPage }));
          return;
        }
        setListings(data.data || []);
        setPagination(data.pagination || null);
      } catch (err) {
        if (err.name === 'AbortError') return; // a newer request replaced this one
        // fetch() itself rejects with a TypeError when the server cannot be reached
        setError(err instanceof TypeError ? 'Could not reach the UniSwap server. Please try again.' : (err.message || 'Failed to load listings.'));
        setListings([]);
        setPagination(null);
      } finally {
        if (!controller.signal.aborted && !movedToLastPage) setIsLoading(false);
      }
    };

    fetchListings();
    return () => controller.abort();
  }, [filters]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setFilters(prev => ({ ...prev, search: searchInput.trim(), page: 1 }));
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setFilters(prev => ({ ...prev, search: '', page: 1 }));
  };

  const goToPage = (page) => {
    setFilters(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="browse-container">
      <h1 className="browse-title">Browse Listings</h1>

      <form className="browse-filters" onSubmit={handleSearchSubmit} role="search">
        <input
          type="search"
          className="browse-search-input"
          placeholder="Search by title or description"
          value={searchInput}
          maxLength={MAX_SEARCH_LENGTH}
          onChange={e => setSearchInput(e.target.value)}
          aria-label="Search listings"
        />
        <button type="submit" className="browse-search-btn">Search</button>

        <select
          className="browse-select"
          value={filters.category}
          onChange={e => setFilters(prev => ({ ...prev, category: e.target.value, page: 1 }))}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={String(cat.id)}>{cat.name}</option>
          ))}
        </select>

        <select
          className="browse-select"
          value={filters.sort}
          onChange={e => setFilters(prev => ({ ...prev, sort: e.target.value, page: 1 }))}
          aria-label="Sort listings"
        >
          {SORT_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </form>

      {filters.search && (
        <p className="browse-active-search">
          Results for "<strong>{filters.search}</strong>"
          <button type="button" className="browse-clear-btn" onClick={handleClearSearch}>Clear</button>
        </p>
      )}

      {isLoading && <div className="browse-status">Loading listings...</div>}

      {!isLoading && error && <div className="browse-error">{error}</div>}

      {!isLoading && !error && listings.length === 0 && (
        <div className="browse-status">
          {filters.search || filters.category ? 'No listings match your search.' : 'No listings are available yet.'}
        </div>
      )}

      {!isLoading && !error && listings.length > 0 && (
        <>
          <p className="browse-count">
            {pagination ? `${pagination.total} listing${pagination.total === 1 ? '' : 's'} found` : ''}
          </p>
          <div className="browse-grid">
            {listings.map(listing => (
              <div key={listing.id} className="browse-card">
                <div className="browse-card-header">
                  <span>{listing.category_name || 'Uncategorized'}</span>
                  <span>{listing.condition}</span>
                </div>
                <h3 className="browse-card-title">{listing.title}</h3>
                <p className="browse-card-price">{formatCurrency(listing.price)}</p>
                <p className="browse-card-description">
                  {listing.description?.length > 100 ? `${listing.description.substring(0, 100)}...` : listing.description}
                </p>
                <a href={`/listings/${listing.id}`} className="browse-card-btn">View Listing</a>
              </div>
            ))}
          </div>

          {pagination && pagination.totalPages > 1 && (
            <nav className="browse-pagination" aria-label="Pagination">
              <button type="button" onClick={() => goToPage(filters.page - 1)} disabled={filters.page <= 1}>
                &larr; Previous
              </button>
              <span>Page {pagination.page} of {pagination.totalPages}</span>
              <button type="button" onClick={() => goToPage(filters.page + 1)} disabled={!pagination.hasNextPage}>
                Next &rarr;
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
};

export default BrowseListings;
