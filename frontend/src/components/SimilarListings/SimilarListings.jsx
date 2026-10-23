import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';
import './SimilarListings.css';

const SimilarListings = ({ listingId }) => {
  const [listings, setListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSimilarListings = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/listings/${listingId}/similar`);

        if (!response.ok) {
          throw new Error('Failed to fetch similar listings');
        }

        const json = await response.json();
        setListings(json.data || []);
      } catch (err) {
        setError(err.message || 'An error occurred while fetching similar listings.');
      } finally {
        setIsLoading(false);
      }
    };

    if (listingId) {
      fetchSimilarListings();
    }
  }, [listingId]);

  if (error) {
    return (
      <div className="similar-listings-container">
        <h2 className="similar-listings-title">Similar Listings</h2>
        <div className="similar-listings-error">{error}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="similar-listings-container">
        <h2 className="similar-listings-title">Similar Listings</h2>
        <div className="similar-listings-loading">Loading similar listings...</div>
      </div>
    );
  }

  if (listings.length === 0) {
    return (
      <div className="similar-listings-container">
        <h2 className="similar-listings-title">Similar Listings</h2>
        <div className="similar-listings-empty">No similar listings available at this time.</div>
      </div>
    );
  }

  return (
    <div className="similar-listings-container">
      <h2 className="similar-listings-title">Similar Listings</h2>
      <div className="similar-listings-grid">
        {listings.map(listing => (
          <div key={listing.id} className="similar-listing-card">
            <div className="similar-listing-card-header">
              <span className="similar-listing-category">{listing.category_name}</span>
              <span className="similar-listing-condition">{listing.condition}</span>
            </div>
            <h3 className="similar-listing-title">{listing.title}</h3>
            <p className="similar-listing-price">{formatCurrency(listing.price)}</p>
            <p className="similar-listing-description">
              {listing.description?.length > 100 ? `${listing.description.substring(0, 100)}...` : listing.description}
            </p>
            <div className="similar-listing-reason">
              <small>✨ {listing.reason} (Score: {listing.score})</small>
            </div>
            <a href={`/listings/${listing.id}`} className="similar-listing-btn">View Listing</a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimilarListings;
