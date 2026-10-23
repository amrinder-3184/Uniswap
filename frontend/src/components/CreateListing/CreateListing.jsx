import React, { useState, useEffect } from 'react';
import './CreateListing.css';

const CreateListing = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/categories')
      .then(res => res.json())
      .then(data => setCategories(data))
      .catch(err => console.error('Failed to load categories', err));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const token = localStorage.getItem('token');
    
    if (!token) {
      setError('You must be logged in to create a listing.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/listings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          description,
          price: parseFloat(price),
          condition,
          category_id: parseInt(categoryId, 10)
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        window.location.href = `/listings/${data.id}`;
      } else {
        if (data.errors && Array.isArray(data.errors)) {
          setError(data.errors.join(' '));
        } else {
          setError(data.message || 'Failed to create listing');
        }
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-listing-container">
      <h2>Create Listing</h2>
      {error && <div className="create-error">{error}</div>}
      <form onSubmit={handleSubmit} className="create-form">
        <div className="form-group">
          <label>Title</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="e.g. MacBook Air M1" />
        </div>
        
        <div className="form-group">
          <label>Price (₹)</label>
          <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required placeholder="0.00" />
        </div>

        <div className="form-group">
          <label>Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
            <option value="" disabled>Select a category</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Condition</label>
          <select value={condition} onChange={(e) => setCondition(e.target.value)} required>
            <option value="" disabled>Select condition</option>
            <option value="New">New</option>
            <option value="Like New">Like New</option>
            <option value="Good">Good</option>
            <option value="Fair">Fair</option>
            <option value="Poor">Poor</option>
          </select>
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows="5" placeholder="Describe your item..."></textarea>
        </div>

        <button type="submit" className="create-submit" disabled={loading}>
          {loading ? 'Creating...' : 'Post Listing'}
        </button>
      </form>
    </div>
  );
};

export default CreateListing;
