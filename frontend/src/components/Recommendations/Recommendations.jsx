import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';
import './Recommendations.css';

const Recommendations = () => {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/recommendations', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.status === 401) {
          setIsAuthenticated(false);
          setIsLoading(false);
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to fetch recommendations');
        }

        const json = await response.json();
        setRecommendations(json.data || []);
      } catch (err) {
        setError(err.message || 'An error occurred while fetching recommendations.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecommendations();
  }, []);

  if (!isAuthenticated) {
    return null; // Do not render if unauthenticated
  }

  if (error) {
    return (
      <div className="recommendations-container">
        <h2 className="recommendations-title">Recommended for You</h2>
        <div className="recommendations-error">{error}</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="recommendations-container">
        <h2 className="recommendations-title">Recommended for You</h2>
        <div className="recommendations-loading">Loading recommendations...</div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="recommendations-container">
        <h2 className="recommendations-title">Recommended for You</h2>
        <div className="recommendations-empty">No recommendations available at this time.</div>
      </div>
    );
  }

  return (
    <div className="recommendations-container">
      <h2 className="recommendations-title">Recommended for You</h2>
      <div className="recommendations-grid">
        {recommendations.map(listing => (
          <div key={listing.id} className="recommendation-card">
            <div className="recommendation-card-header">
              <span className="recommendation-category">{listing.category_name}</span>
              <span className="recommendation-condition">{listing.condition}</span>
            </div>
            <h3 className="recommendation-title">{listing.title}</h3>
            <p className="recommendation-price">{formatCurrency(listing.price)}</p>
            <p className="recommendation-description">
              {listing.description?.length > 100 ? `${listing.description.substring(0, 100)}...` : listing.description}
            </p>
            <div className="recommendation-reason">
              <small>✨ {listing.reason} (Score: {listing.score})</small>
            </div>
            <a href={`/listings/${listing.id}`} className="recommendation-btn">View Listing</a>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Recommendations;
