import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';
import './MyListings.css';

const MyListings = () => {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchMyListings = async () => {
      if (!token) {
        setError('Please login to view your listings.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/users/me/listings', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setListings(data.data || []);
        } else {
          setError(data.message || 'Failed to load your listings');
        }
      } catch {
        setError('Network error loading listings');
      } finally {
        setLoading(false);
      }
    };
    fetchMyListings();
  }, [token]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/listings/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setListings(prev => prev.filter(l => l.id !== id));
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to delete listing');
      }
    } catch {
      alert('Network error deleting listing');
    }
  };

  const handleEdit = async (listing) => {
    const newPrice = window.prompt(`Enter new price (₹) for "${listing.title}":`, listing.price);
    if (newPrice === null) return;
    
    const parsedPrice = parseFloat(newPrice);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      alert('Invalid price');
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/listings/${listing.id}`, {
        // Use PATCH as per backend routes, even though prompt said PUT
        method: 'PATCH',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ price: parsedPrice })
      });
      if (res.ok) {
        setListings(prev => prev.map(l => l.id === listing.id ? { ...l, price: parsedPrice } : l));
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to update listing');
      }
    } catch {
      alert('Network error updating listing');
    }
  };

  if (loading) return <div className="my-listings-container"><div className="spinner"></div></div>;
  if (error) return <div className="my-listings-container error">{error}</div>;

  return (
    <div className="my-listings-container">
      <div className="my-listings-header">
        <h2>My Listings</h2>
        <a href="/create-listing" className="btn-create-new">Create New</a>
      </div>
      
      {listings.length === 0 ? (
        <p>You haven't created any listings yet.</p>
      ) : (
        <div className="my-listings-grid">
          {listings.map(l => (
            <div key={l.id} className="my-listing-card">
              <div className="my-listing-image-container">
                {l.image_url ? (
                  <img src={`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${l.image_url}`} alt={l.title} className="my-listing-img" />
                ) : (
                  <div className="my-listing-no-img">No Image</div>
                )}
                {l.status === 'sold' && <span className="my-listing-badge sold">Sold</span>}
                {l.status === 'available' && <span className="my-listing-badge available">Available</span>}
              </div>
              <div className="my-listing-details">
                <h3>{l.title}</h3>
                <p className="my-listing-price">{formatCurrency(l.price)}</p>
                <p className="my-listing-meta">{l.category_name} • {l.condition}</p>
                <p className="my-listing-date">Listed on: {new Date(l.created_at).toLocaleDateString()}</p>
              </div>
              <div className="my-listing-actions">
                <a href={`/listings/${l.id}`} className="btn-view">View</a>
                {l.status === 'available' && (
                  <>
                    <button className="btn-edit" onClick={() => handleEdit(l)}>Edit Price</button>
                    <button className="btn-delete" onClick={() => handleDelete(l.id, l.title)}>Delete</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyListings;
