import React, { useState, useRef, useEffect } from 'react';
import { formatCurrency } from '../../utils/formatCurrency';
import './AIChatbot.css';

const AIChatbot = ({ listingId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, error]);

  const handleOpen = () => {
    setIsOpen(true);
    if (messages.length === 0) {
      setMessages([
        {
          role: 'assistant',
          content: "Hi! I'm your UniSwap Marketplace Assistant. What are you looking for?"
        }
      ]);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token') || ''; // Assuming token is stored in localStorage
      
      const requestBody = { message: userMessage };
      if (listingId) {
        requestBody.context = { listingId: parseInt(listingId, 10) };
      }

      // Append up to last 10 messages as history
      if (messages.length > 0) {
        // Strip out the first greeting if it's the default and only keep safe fields
        const recentMessages = messages
          .filter(m => m.content !== "Hi! I'm your UniSwap Marketplace Assistant. What are you looking for?")
          .slice(-10)
          .map(m => ({
            role: m.role,
            content: m.content,
            listings: m.listings ? m.listings.map(l => ({
              id: l.id,
              title: l.title,
              price: l.price,
              condition: l.condition
            })) : undefined
          }));
        if (recentMessages.length > 0) {
          requestBody.history = recentMessages;
        }
      }

      const response = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.status === 400) {
        throw new Error('Please enter a valid message.');
      } else if (response.status === 401) {
        throw new Error('Please log in to use UniSwap AI.');
      } else if (response.status === 503) {
        throw new Error('UniSwap AI is temporarily unavailable. Please try again.');
      } else if (!response.ok) {
        throw new Error('Something went wrong. Please try again.');
      }

      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          listings: data.listings
        }
      ]);

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chatbot-container">
      {!isOpen && (
        <button className="chatbot-button" onClick={handleOpen} aria-label="Open AI Assistant">
          <svg fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 5.97 2 10.87c0 2.68 1.4 5.06 3.6 6.64-.13.97-.61 2.85-2.05 4.14 0 0-.1.1-.06.2.03.11.14.15.25.15 2.14 0 4.1-.78 5.6-2.07 1.25.33 2.6.5 4 .5 5.52 0 10-3.97 10-8.87S17.52 2 12 2z"/>
          </svg>
        </button>
      )}

      {isOpen && (
        <div className="chatbot-panel">
          <div className="chatbot-header">
            <div className="chatbot-header-text">
              <h3>UniSwap AI</h3>
              <p>Marketplace Assistant</p>
            </div>
            <button className="chatbot-close-btn" onClick={handleClose} aria-label="Close chat">
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chatbot-message ${msg.role}`}>
                <div className="chatbot-message-content">
                  {msg.content}
                </div>
                {msg.listings && msg.listings.length > 0 && (
                  <div className="chatbot-listings">
                    {msg.listings.map((listing) => (
                      <div key={listing.id} className="chatbot-listing-card">
                        <div className="chatbot-listing-content">
                          <h4 className="chatbot-listing-title">{listing.title}</h4>
                          <p className="chatbot-listing-price">{formatCurrency(listing.price)}</p>
                          <div className="chatbot-listing-meta">
                            <span>{listing.condition}</span>
                            <span>•</span>
                            <span>{listing.category_name}</span>
                          </div>
                          <p className="chatbot-listing-desc">{listing.description}</p>
                        </div>
                        <button 
                          className="chatbot-listing-btn"
                          onClick={() => window.location.href = `/listings/${listing.id}`}
                        >
                          View Listing
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="chatbot-loading">
                <span>AI is thinking</span>
                <div className="chatbot-dot"></div>
                <div className="chatbot-dot"></div>
                <div className="chatbot-dot"></div>
              </div>
            )}
            
            {error && (
              <div className="chatbot-error">
                {error}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input-container">
            <textarea
              className="chatbot-textarea"
              placeholder="Ask me anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button 
              className="chatbot-send-btn" 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              aria-label="Send message"
            >
              <svg fill="currentColor" viewBox="0 0 24 24">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatbot;
