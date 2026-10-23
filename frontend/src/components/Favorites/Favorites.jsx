import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';
import './Favorites.css';

const Favorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view favorites.');
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/favorites', {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) throw new Error('Failed to fetch favorites');

        const data = await res.json();
        setFavorites(data.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  if (isLoading) return <div className="favorites-loading">Loading favorites...</div>;
  if (error) return <div className="favorites-error">{error}</div>;

  return (
    <div className="favorites-container">
      <h2>Your Favorites</h2>
      
      {favorites.length === 0 ? (
        <p className="favorites-empty">You haven't favorited any listings yet.</p>
      ) : (
        <div className="favorites-grid">
          {favorites.map(f => (
            <div key={f.id} className="favorite-card">
              <h3 className="favorite-title">{f.title || 'Listing Unavailable'}</h3>
              {f.price && <p className="favorite-price">{formatCurrency(f.price)}</p>}
              
              {f.id ? (
                <a href={`/listings/${f.id}`} className="favorite-btn">View Listing</a>
              ) : (
                <span className="favorite-deleted">Listing Deleted</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Favorites;
