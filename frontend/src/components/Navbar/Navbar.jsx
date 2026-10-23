import React, { useState, useEffect } from 'react';
import './Navbar.css';

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/users/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setUser(data);
        else localStorage.removeItem('token');
      })
      .catch(() => {});
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setShowLogin(false);
        window.location.reload(); // Reload to refresh contexts
      } else {
        setError(data.message || 'Login failed');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Account created successfully. Please log in.');
        setIsRegistering(false);
        setPassword('');
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('Network error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/';
  };

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <a href="/">UniSwap</a>
      </div>
      <div className="nav-links">
        {user ? (
          <>
            <a href="/" className="nav-link">Home</a>
            <a href="/browse" className="nav-link">Browse</a>
            <a href="/create-listing" className="nav-link">Sell</a>
            <a href="/my-listings" className="nav-link">My Listings</a>
            <a href="/favorites" className="nav-link">Favorites</a>
            <a href="/messages" className="nav-link">Messages</a>
            <a href="/transactions" className="nav-link">Transactions</a>
            <span className="nav-user">Hi, {user.name}</span>
            <button onClick={handleLogout} className="nav-btn">Logout</button>
          </>
        ) : (
          <>
            <a href="/" className="nav-link">Home</a>
            <a href="/browse" className="nav-link">Browse</a>
            <button className="nav-btn" onClick={() => setShowLogin(!showLogin)}>Login</button>
          </>
        )}
      </div>

      {showLogin && !user && (
        <div className="login-modal">
          <form className="login-form" onSubmit={isRegistering ? handleRegister : handleLogin}>
            <h3>{isRegistering ? 'Create Account' : 'Login'}</h3>
            {successMsg && <div className="login-success">{successMsg}</div>}
            {error && <div className="login-error">{error}</div>}
            
            {isRegistering && (
              <input type="text" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} required />
            )}
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required />
            
            <div className="login-actions">
              <button type="submit" className="login-submit">{isRegistering ? 'Sign Up' : 'Sign In'}</button>
              <button type="button" className="login-cancel" onClick={() => { setShowLogin(false); setIsRegistering(false); setSuccessMsg(''); setError(''); }}>Cancel</button>
            </div>

            <div style={{marginTop: '15px', textAlign: 'center', fontSize: '0.85rem'}}>
              {isRegistering ? (
                <span>Already have an account? <a href="#" style={{color: '#2563eb', textDecoration: 'none'}} onClick={(e) => { e.preventDefault(); setIsRegistering(false); setError(''); }}>Log in</a></span>
              ) : (
                <span>Don't have an account? <a href="#" style={{color: '#2563eb', textDecoration: 'none'}} onClick={(e) => { e.preventDefault(); setIsRegistering(true); setSuccessMsg(''); setError(''); }}>Sign Up</a></span>
              )}
            </div>
          </form>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
