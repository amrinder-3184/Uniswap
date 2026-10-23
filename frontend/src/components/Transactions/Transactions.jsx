import React, { useState, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';
import './Transactions.css';

const Transactions = () => {
  const [purchases, setPurchases] = useState([]);
  const [sales, setSales] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view transactions.');
        setIsLoading(false);
        return;
      }

      try {
        const [purchasesRes, salesRes] = await Promise.all([
          fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/transactions/purchases', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/transactions/sales', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);

        if (!purchasesRes.ok || !salesRes.ok) {
          throw new Error('Failed to fetch transactions');
        }

        const purchasesData = await purchasesRes.json();
        const salesData = await salesRes.json();

        setPurchases(purchasesData.data || []);
        setSales(salesData.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  if (isLoading) return <div className="transactions-loading">Loading transactions...</div>;
  if (error) return <div className="transactions-error">{error}</div>;

  return (
    <div className="transactions-container">
      <h2>Your Transactions</h2>
      
      <div className="transactions-grid">
        <div className="transactions-column">
          <h3>Purchases ({purchases.length})</h3>
          {purchases.length === 0 ? (
            <p className="transactions-empty">No purchases yet.</p>
          ) : (
            purchases.map(t => (
              <div key={t.id} className="transaction-card purchase">
                <div className="transaction-header">
                  <span className="transaction-date">{new Date(t.created_at).toLocaleDateString()}</span>
                  <span className="transaction-price">{formatCurrency(t.purchase_price)}</span>
                </div>
                <div className="transaction-details">
                  <h4>{t.listing_title || 'Listing Unavailable'}</h4>
                  {t.listing_id ? (
                    <a href={`/listings/${t.listing_id}`}>View Listing</a>
                  ) : (
                    <span className="deleted-tag">Listing Deleted</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="transactions-column">
          <h3>Sales ({sales.length})</h3>
          {sales.length === 0 ? (
            <p className="transactions-empty">No sales yet.</p>
          ) : (
            sales.map(t => (
              <div key={t.id} className="transaction-card sale">
                <div className="transaction-header">
                  <span className="transaction-date">{new Date(t.created_at).toLocaleDateString()}</span>
                  <span className="transaction-price">{formatCurrency(t.purchase_price)}</span>
                </div>
                <div className="transaction-details">
                  <h4>{t.listing_title || 'Listing Unavailable'}</h4>
                  {t.listing_id ? (
                    <a href={`/listings/${t.listing_id}`}>View Listing</a>
                  ) : (
                    <span className="deleted-tag">Listing Deleted</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Transactions;
