import React, { useState, useEffect, useCallback, useRef } from 'react';
import './Messages.css';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  const token = localStorage.getItem('token');
  // Id of the most recent thread request, so a slow response for a previously
  // clicked conversation cannot overwrite the messages of the one now selected
  const latestThreadRequest = useRef(0);

  // Defined before the effect below that calls it, and memoised on token so the
  // effect can list it as a dependency without re-running on every render
  const loadThread = useCallback(async (conv) => {
    const requestId = ++latestThreadRequest.current;
    setActiveThread(conv);
    setThreadLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/messages/${conv.listing_id}/${conv.other_user_id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (requestId !== latestThreadRequest.current) return; // a newer conversation was selected
      if (res.ok) {
        setThreadMessages(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (requestId === latestThreadRequest.current) setThreadLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const init = async () => {
      if (!token) {
        setError('Please login to view messages.');
        setLoading(false);
        return;
      }
      
      try {
        const userRes = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/users/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          setCurrentUser(userData);
        }

        const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/messages', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        
        if (res.ok) {
          const convs = data.data || [];
          setConversations(convs);

          const params = new URLSearchParams(window.location.search);
          const queryListingId = params.get('listing_id');
          if (queryListingId) {
            const existingConv = convs.find(c => String(c.listing_id) === String(queryListingId));
            if (existingConv) {
              loadThread(existingConv);
            } else {
              // Create a draft conversation state
              const draftConv = {
                listing_id: Number(queryListingId),
                listing_title: 'New Conversation (Draft)',
                other_user_id: null // Backend determines this
              };
              setActiveThread(draftConv);
            }
          }
        } else {
          setError(data.message || 'Failed to fetch conversations');
        }
      } catch {
        setError('Network error loading messages');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [token, loadThread]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeThread || sending) return;

    setSending(true);
    try {
      // The backend POST /messages only takes listing_id and content
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          listing_id: activeThread.listing_id,
          content: newMessage
        })
      });

      const data = await res.json();
      if (res.ok) {
        setThreadMessages(prev => [...prev, data]);
        setNewMessage('');
        
        let targetOtherUser = activeThread.other_user_id;
        if (!targetOtherUser) {
           targetOtherUser = String(data.receiver_id) === String(currentUser?.id) ? data.sender_id : data.receiver_id;
           setActiveThread(prev => ({ ...prev, other_user_id: targetOtherUser }));
        }

        // Update the conversations list latest_message
        setConversations(prev => {
          const exists = prev.find(c => c.listing_id === activeThread.listing_id && c.other_user_id === targetOtherUser);
          if (exists) {
            return prev.map(c => {
              if (c.listing_id === activeThread.listing_id && c.other_user_id === targetOtherUser) {
                return { ...c, latest_message: data.content, latest_message_at: data.created_at };
              }
              return c;
            });
          } else {
            return [{
              listing_id: activeThread.listing_id,
              listing_title: activeThread.listing_title,
              other_user_id: targetOtherUser,
              latest_message: data.content,
              latest_message_at: data.created_at
            }, ...prev];
          }
        });
      } else {
        alert(data.message || 'Failed to send message');
      }
    } catch {
      alert('Network error sending message');
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="messages-container"><div className="spinner"></div></div>;
  if (error) return <div className="messages-container error">{error}</div>;

  return (
    <div className="messages-container">
      <div className="messages-layout">
        <div className="conversations-sidebar">
          <h3>Your Conversations</h3>
          {conversations.length === 0 ? (
            <p className="no-conversations">No messages yet.</p>
          ) : (
            conversations.map((conv, idx) => (
              <div 
                key={`${conv.listing_id}-${conv.other_user_id}-${idx}`}
                className={`conversation-card ${activeThread?.listing_id === conv.listing_id && activeThread?.other_user_id === conv.other_user_id ? 'active' : ''}`}
                onClick={() => loadThread(conv)}
              >
                <h4>{conv.listing_title}</h4>
                <p className="latest-message">{conv.latest_message}</p>
                <small>{new Date(conv.latest_message_at).toLocaleString()}</small>
              </div>
            ))
          )}
        </div>
        
        <div className="thread-main">
          {activeThread ? (
            <>
              <div className="thread-header">
                <h3>{activeThread.listing_title}</h3>
                <a href={`/listings/${activeThread.listing_id}`}>View Listing</a>
              </div>
              
              <div className="thread-messages">
                {threadLoading ? (
                  <div className="spinner"></div>
                ) : (
                  threadMessages.map(msg => {
                    const isMe = String(msg.sender_id) === String(currentUser?.id);
                    return (
                      <div key={msg.id} className={`message-bubble ${isMe ? 'sent' : 'received'}`}>
                        <div className="message-content">{msg.content}</div>
                        <div className="message-time">{new Date(msg.created_at).toLocaleTimeString()}</div>
                      </div>
                    );
                  })
                )}
              </div>
              
              <form className="message-input-area" onSubmit={handleSend}>
                <input 
                  type="text" 
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)} 
                  placeholder="Type a message..." 
                  disabled={sending}
                />
                <button type="submit" disabled={sending || !newMessage.trim()}>Send</button>
              </form>
            </>
          ) : (
            <div className="no-thread-selected">
              <p>Select a conversation to view messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Messages;
