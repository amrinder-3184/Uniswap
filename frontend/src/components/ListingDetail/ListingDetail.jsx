import React, { useState, useEffect } from 'react';
import SimilarListings from '../SimilarListings/SimilarListings';
import { formatCurrency } from '../../utils/formatCurrency';
import { buildImageSrc, isListingInFavorites } from '../../utils/listingHelpers';
import './ListingDetail.css';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const ListingDetail = ({ listingId }) => {
  const [listing, setListing] = useState(null);
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchListingData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const fetchPromises = [
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/listings/${listingId}`),
          fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/listings/${listingId}/images`)
        ];

        if (token) {
          fetchPromises.push(
            fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/users/me', { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/favorites', { headers: { 'Authorization': `Bearer ${token}` } })
          );
        }

        const responses = await Promise.all(fetchPromises);
        const [listingRes, imagesRes, meRes, favRes] = responses;

        if (listingRes.status === 404) throw new Error('Listing not found');
        if (!listingRes.ok) throw new Error('Failed to load listing details');

        const listingData = await listingRes.json();
        setListing(listingData);

        if (imagesRes && imagesRes.ok) {
          const imagesData = await imagesRes.json();
          setImages(imagesData.data || []);
        }

        if (token && meRes && meRes.ok) {
          const meData = await meRes.json();
          setCurrentUser(meData);
        }

        if (token && favRes && favRes.ok) {
          const favData = await favRes.json();
          // GET /favorites items use `id` for the listing id (there is no listing_id field)
          setIsFavorited(isListingInFavorites(favData.data, listingData.id));
        }

      } catch (err) {
        setError(err.message || 'An unexpected error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (listingId) fetchListingData();
  }, [listingId, token]);

  const requireAuth = () => {
    if (!token) {
      alert("Please login to perform this action.");
      return false;
    }
    return true;
  };

  const handleFavoriteToggle = async () => {
    if (!requireAuth()) return;
    setActionLoading(true);
    try {
      const method = isFavorited ? 'DELETE' : 'POST';
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/favorites/${listingId}`, {
        method,
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to update favorites');
      setIsFavorited(!isFavorited);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuyNow = async () => {
    if (!requireAuth()) return;
    if (!window.confirm(`Are you sure you want to buy ${listing.title} for ${formatCurrency(listing.price)}?`)) return;
    
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/listings/${listingId}/buy`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Purchase failed');
      
      setActionMessage({ type: 'success', text: 'Purchase successful!' });
      setListing(prev => ({ ...prev, status: 'sold' }));
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessageSeller = () => {
    if (!requireAuth()) return;
    // We navigate to /messages. 
    // Creating the initial message requires sending from the UI.
    window.location.href = `/messages?listing_id=${listingId}`;
  };

  const handleImageUpload = async (e) => {
    if (!requireAuth()) return;
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 5 * 1024 * 1024) {
      setActionMessage({ type: 'error', text: 'File exceeds 5MB limit.' });
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/listings/${listingId}/images`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.message || 'Image upload failed');
      
      setImages(prev => [...prev, data]);
      setActionMessage({ type: 'success', text: 'Image uploaded successfully.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
      e.target.value = ''; // Reset input
    }
  };

  const handleImageDelete = async (imageId) => {
    if (!requireAuth()) return;
    if (!window.confirm('Are you sure you want to delete this image?')) return;

    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/listings/${listingId}/images/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete image');
      }
      
      setImages(prev => prev.filter(img => img.id !== imageId));
      setActionMessage({ type: 'success', text: 'Image deleted successfully.' });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="listing-detail-container loading">
        <div className="spinner"></div>
        <p>Loading listing details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="listing-detail-container error">
        <h2>Oops!</h2>
        <p>{error}</p>
        <a href="/" className="back-btn">&larr; Back to Marketplace</a>
      </div>
    );
  }

  if (!listing) return null;

  const isSeller = currentUser && String(currentUser.id) === String(listing.seller_id);

  return (
    <div className="listing-detail-wrapper">
      <div className="listing-detail-container">
        <a href="/" className="back-btn">&larr; Back to Marketplace</a>
        
        {actionMessage && (
          <div className={`action-alert ${actionMessage.type}`}>
            {actionMessage.text}
          </div>
        )}

        <div className="listing-detail-content">
          <div className="listing-images-section">
            {images.length > 0 ? (
              <div className="listing-main-image-container">
                <div style={{ position: 'relative' }}>
                  <img src={buildImageSrc(API_BASE_URL, images[0])} alt={listing.title} className="listing-main-image" />
                  {isSeller && (
                    <button 
                      onClick={() => handleImageDelete(images[0].id)} 
                      style={{ position: 'absolute', top: 5, right: 5, background: 'red', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px' }}
                      disabled={actionLoading}
                    >
                      Delete
                    </button>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="listing-thumbnails">
                    {images.slice(1).map(img => (
                      <div key={img.id} style={{ position: 'relative', display: 'inline-block' }}>
                        <img src={buildImageSrc(API_BASE_URL, img)} alt="thumbnail" className="listing-thumbnail" />
                        {isSeller && (
                          <button 
                            onClick={() => handleImageDelete(img.id)} 
                            style={{ position: 'absolute', top: 0, right: 0, background: 'red', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 4px', fontSize: '10px' }}
                            disabled={actionLoading}
                          >
                            X
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="listing-no-image"><span>No Images Available</span></div>
            )}
            
            {isSeller && images.length < 5 && (
              <div className="image-upload-section" style={{ marginTop: '15px', padding: '10px', border: '1px dashed #ccc', borderRadius: '6px' }}>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold' }}>Upload Image ({images.length}/5)</p>
                <input type="file" accept="image/jpeg, image/png, image/webp" onChange={handleImageUpload} disabled={actionLoading} />
                <p style={{ fontSize: '12px', color: '#666', margin: '5px 0 0 0' }}>Max size 5MB. JPEG, PNG, WEBP.</p>
              </div>
            )}
          </div>

          <div className="listing-info-section">
            <div className="listing-header">
              <span className="listing-category">{listing.category_name || 'Uncategorized'}</span>
              {listing.status === 'sold' && <span className="listing-badge sold">Sold</span>}
              {listing.status === 'available' && <span className="listing-badge available">Available</span>}
            </div>
            
            <h1 className="listing-title">{listing.title}</h1>
            <p className="listing-price">{formatCurrency(listing.price)}</p>
            
            <div className="listing-meta">
              <p><strong>Condition:</strong> {listing.condition}</p>
              <p><strong>Seller:</strong> {listing.seller_name || 'Anonymous'}</p>
              <p><strong>Listed:</strong> {new Date(listing.created_at).toLocaleDateString()}</p>
            </div>

            <div className="listing-description">
              <h3>Description</h3>
              <p>{listing.description}</p>
            </div>

            <div className="listing-actions">
              <button 
                className="btn-buy" 
                disabled={listing.status === 'sold' || isSeller || actionLoading}
                onClick={handleBuyNow}
              >
                {listing.status === 'sold' ? 'Out of Stock' : (isSeller ? 'Your Listing' : 'Buy Now')}
              </button>
              
              {!isSeller && (
                <button className="btn-message" onClick={handleMessageSeller} disabled={actionLoading}>
                  Message Seller
                </button>
              )}

              <button 
                className={`btn-favorite ${isFavorited ? 'active' : ''}`} 
                onClick={handleFavoriteToggle}
                disabled={actionLoading}
              >
                {isFavorited ? '♥ Favorited' : '♡ Favorite'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <SimilarListings listingId={listingId} />
      {/* The AI chatbot is rendered once for every page in App.jsx, which already
          passes this listing's id as context, so it is not rendered again here */}
    </div>
  );
};

export default ListingDetail;
