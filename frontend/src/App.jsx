import React from 'react';
import Navbar from './components/Navbar/Navbar';
import AIChatbot from './components/AIChatbot/AIChatbot';
import Recommendations from './components/Recommendations/Recommendations';
import ListingDetail from './components/ListingDetail/ListingDetail';
import Transactions from './components/Transactions/Transactions';
import Favorites from './components/Favorites/Favorites';
import CreateListing from './components/CreateListing/CreateListing';
import MyListings from './components/MyListings/MyListings';
import Messages from './components/Messages/Messages';
import BrowseListings from './components/BrowseListings/BrowseListings';
import './App.css';

function App() {
  const path = window.location.pathname;

  let content;
  
  const listingMatch = path.match(/^\/listings\/(\d+)\/?$/);
  
  if (listingMatch) {
    const listingId = listingMatch[1];
    content = <ListingDetail listingId={listingId} />;
  } else if (path === '/transactions') {
    content = <Transactions />;
  } else if (path === '/favorites') {
    content = <Favorites />;
  } else if (path === '/create-listing') {
    content = <CreateListing />;
  } else if (path === '/my-listings') {
    content = <MyListings />;
  } else if (path === '/messages') {
    content = <Messages />;
  } else if (/^\/browse\/?$/.test(path)) {
    content = <BrowseListings />;
  } else {
    // Home Page Route
    content = (
      <>
        <div className="home-header" style={{marginBottom: '2rem'}}>
          <h1 style={{fontSize: '2rem', color: '#111827', margin: '0 0 0.5rem 0'}}>Welcome to UniSwap</h1>
          <p style={{color: '#4b5563', fontSize: '1.1rem', margin: '0'}}>The secure C2C university marketplace for buying and selling student essentials.</p>
          <a href="/browse" style={{display: 'inline-block', marginTop: '1rem', color: '#2563eb', fontWeight: 600, textDecoration: 'none'}}>Browse all listings &rarr;</a>
        </div>
        <Recommendations />
      </>
    );
  }

  return (
    <div className="app-main-wrapper">
      <Navbar />
      <div className="app-container" style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
        {content}
        <AIChatbot listingId={listingMatch ? listingMatch[1] : undefined} />
      </div>
    </div>
  );
}

export default App;
