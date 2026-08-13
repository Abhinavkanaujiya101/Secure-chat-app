import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;
const socket = io(BACKEND_URL);

const isSameUser = (name1, name2) => {
  if (!name1 || !name2) return false;
  return name1.trim().toLowerCase() === name2.trim().toLowerCase();
};

const EMOJI_CATEGORIES = {
  'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥸', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🫣', '🤭', '🫢', '🫡', '🤫', '🫠', '🤥', '😶', '🫥', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '😵‍💫', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕'],
  'Gestures': ['👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🫱', '🫲', '🫵'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟'],
  'Food/Activities': ['🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥗', '🍲', '🍜', '🍣', '🍱', '🥟', '🍤', '🍙', '🍨', '🍩', '🍪', '🎂', '🍫', '🍬', '🍺', '🍻', '🥂', '🍷', '🥃', '☕', '🥤', '⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🏓', '🏸', '🥋', '🥊', '🎯', '🎮', '🕹️', '🎰'],
  'Objects/Travel': ['💡', '🔑', '🔒', '🔓', '🔍', '📱', '💻', '🖥️', '⌨️', '🖱️', '📷', '📹', '📺', '📻', '🎙️', '⏳', '⌚', '⏰', '🚀', '🚗', '🚕', '🚙', '🚌', '🏎️', '🚓', '🚑', '🚒', '🚲', '🛵', '🏍️', '🛩️', '✈️', '⛵', '🗺️', '🧭', '🎇', '🎆', '🎈', '🎉', '🎊']
};

const CATEGORY_ICONS = {
  'Smileys': '😀',
  'Gestures': '👍',
  'Hearts': '❤️',
  'Food/Activities': '🍔',
  'Objects/Travel': '💡'
};

function App() {
  const [view, setView] = useState('home'); // home, create, join, waiting, chat
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [otherUser, setOtherUser] = useState('');
  const [error, setError] = useState('');
  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState('Smileys');

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (view === 'chat') {
      scrollToBottom();
    }
  }, [messages, view]);

  // Socket events setup
  useEffect(() => {
    socket.on('user-joined', (data) => {
      console.log('user-joined:', data);
      if (!isSameUser(data.username, username)) {
        setOtherUser(data.username);
        setView('chat');
        
        // Add a system log message
        setMessages(prev => [
          ...prev,
          {
            id: Date.now() + Math.random(),
            text: `${data.username} joined the chat`,
            username: 'System',
            timestamp: new Date().toISOString(),
            type: 'system'
          }
        ]);
      }
    });

    socket.on('chat-ready', (data) => {
      console.log('chat-ready:', data);
      const partner = data.users.find(u => !isSameUser(u, username));
      if (partner) {
        setOtherUser(partner);
      }
      setView('chat');
    });

    socket.on('chat-history', (history) => {
      setMessages(history);
    });

    socket.on('new-message', (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setPartnerIsTyping(false);
    });

    socket.on('user-left', (data) => {
      console.log('user-left:', data);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          text: data.message,
          username: 'System',
          timestamp: new Date().toISOString(),
          type: 'system'
        }
      ]);
      setOtherUser('');
      setPartnerIsTyping(false);
    });

    socket.on('system-message', (data) => {
      console.log('system-message:', data);
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          text: data.message,
          username: 'System',
          timestamp: data.timestamp || new Date().toISOString(),
          type: 'system'
        }
      ]);
    });

    socket.on('user-typing', (data) => {
      if (!isSameUser(data.username, username)) {
        setPartnerIsTyping(data.isTyping);
      }
    });

    socket.on('error', (err) => {
      setError(err.message || 'An error occurred');
    });

    return () => {
      socket.off('user-joined');
      socket.off('chat-ready');
      socket.off('chat-history');
      socket.off('new-message');
      socket.off('user-left');
      socket.off('system-message');
      socket.off('user-typing');
      socket.off('error');
    };
  }, [username]);

  const createRoom = async () => {
    setError('');
    if (!username || username.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() })
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setRoomCode(data.code);
        setView('waiting');
        socket.emit('join-chat', { code: data.code, username: username.trim() });
      }
    } catch (err) {
      setError('Failed to create room. Make sure backend is running.');
    }
  };

  const joinRoom = async () => {
    setError('');
    if (!username || username.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    if (!code || code.trim().length !== 6) {
      setError('Enter a valid 6-digit code');
      return;
    }

    try {
      const res = await fetch(`${BACKEND_URL}/api/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), username: username.trim() })
      });
      
      const data = await res.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        setRoomCode(code.trim());
        setOtherUser(data.creator);
        socket.emit('join-chat', { code: code.trim(), username: username.trim() });
        setView('chat');
      }
    } catch (err) {
      setError('Failed to join room. Check code and connection.');
    }
  };

  const sendMessage = () => {
    if (input.trim()) {
      socket.emit('send-message', { text: input.trim() });
      socket.emit('typing', false);
      setInput('');
      setShowEmojiPicker(false);
    }
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
    
    // Emit typing indicator
    socket.emit('typing', true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', false);
    }, 1500);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit: 2MB (2 * 1024 * 1024 bytes)
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError('File is too large. Max size allowed is 2MB.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result;
      
      // Emit file payload
      socket.emit('send-message', {
        text: file.name,
        fileData: {
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64Data
        }
      });
    };
    reader.onerror = () => {
      setError('Error reading file.');
    };
    reader.readAsDataURL(file);

    // Clear input selection
    e.target.value = null;
  };

  const handleEmojiClick = (emoji) => {
    setInput(prev => prev + emoji);
  };

  const leaveChat = () => {
    socket.disconnect();
    socket.connect();
    setView('home');
    setRoomCode('');
    setMessages([]);
    setOtherUser('');
    setInput('');
    setPartnerIsTyping(false);
    setShowEmojiPicker(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="app-container">
      {view === 'home' && (
        <div className="glass-card">
          <h1 className="gradient-title">🔐 Secure Chat</h1>
          <p className="subtitle">Instant end-to-end encrypted room sessions</p>
          
          {error && <div className="error-banner">{error}</div>}
          
          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="input-label" htmlFor="nameInput">Enter your name</label>
            <input
              id="nameInput"
              className="form-input"
              placeholder="e.g. Alice"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          
          <button
            className="btn-primary"
            onClick={() => setView('create')}
            disabled={username.trim().length < 2}
          >
            Create New Room
          </button>
          
          <div style={{ textAlign: 'center', margin: '18px 0', color: '#9ca3af', fontSize: '14px', fontWeight: 600 }}>OR</div>
          
          <button
            className="btn-secondary"
            onClick={() => setView('join')}
            style={{ marginTop: 0 }}
          >
            Join with Code
          </button>
        </div>
      )}
      
      {view === 'create' && (
        <div className="glass-card">
          <h1 className="gradient-title">Create Room</h1>
          <p className="subtitle">Generate a temporary room code</p>
          
          {error && <div className="error-banner">{error}</div>}
          
          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="input-label" htmlFor="createNameInput">Confirm your name</label>
            <input
              id="createNameInput"
              className="form-input"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          
          <button
            className="btn-primary"
            onClick={createRoom}
            disabled={username.trim().length < 2}
          >
            Generate 6-Digit Code
          </button>
          
          <button
            className="btn-secondary"
            onClick={() => setView('home')}
          >
            Back
          </button>
        </div>
      )}
      
      {view === 'join' && (
        <div className="glass-card">
          <h1 className="gradient-title">Join Room</h1>
          <p className="subtitle">Enter the room code shared with you</p>
          
          {error && <div className="error-banner">{error}</div>}
          
          <div className="input-group" style={{ marginBottom: '16px' }}>
            <label className="input-label" htmlFor="joinNameInput">Your name</label>
            <input
              id="joinNameInput"
              className="form-input"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          
          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="input-label" htmlFor="joinCodeInput">6-digit room code</label>
            <input
              id="joinCodeInput"
              className="form-input"
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              style={{ textAlign: 'center', letterSpacing: '8px', fontWeight: 'bold', fontSize: '20px' }}
            />
          </div>
          
          <button
            className="btn-primary"
            onClick={joinRoom}
            disabled={username.trim().length < 2 || code.length !== 6}
          >
            Join Chat
          </button>
          
          <button
            className="btn-secondary"
            onClick={() => setView('home')}
          >
            Back
          </button>
        </div>
      )}
      
      {view === 'waiting' && (
        <div className="glass-card" style={{ textAlign: 'center' }}>
          <h1 className="gradient-title">Room Created!</h1>
          <p className="subtitle">Share this code with your chat partner</p>
          
          <div className="code-box">
            <div className="code-text">{roomCode}</div>
          </div>
          
          <p style={{ color: '#4b5563', marginBottom: '24px', fontSize: '15px', fontWeight: '500' }}>
            Waiting for someone to join...
          </p>
          
          <button
            className="btn-primary"
            onClick={copyCode}
          >
            {copied ? '✅ Code Copied!' : '📋 Copy Code'}
          </button>
          
          <button
            className="btn-secondary"
            onClick={leaveChat}
          >
            Cancel
          </button>
        </div>
      )}
      
      {view === 'chat' && (
        <div className="chat-window">
          {/* Header */}
          <div className="chat-header">
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>Room: {roomCode}</h2>
              <p style={{ fontSize: '13px', opacity: 0.9, marginTop: '2px', fontWeight: '500' }}>
                You: {username} | Partner: {otherUser || 'Waiting...'}
              </p>
            </div>
            <button className="leave-btn" onClick={leaveChat}>
              Leave
            </button>
          </div>
          
          {/* Messages */}
          <div className="chat-messages">
            {error && <div className="error-banner">{error}</div>}
            {messages.map((msg) => {
              if (msg.type === 'system' || msg.username === 'System') {
                return (
                  <div key={msg.id} className="message-bubble system">
                    {msg.text}
                  </div>
                );
              }
              const isMe = isSameUser(msg.username, username);
              
              // Helper to format file size
              const formatFileSize = (bytes) => {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const dm = 1;
                const sizes = ['Bytes', 'KB', 'MB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
              };

              return (
                <div
                  key={msg.id}
                  className={`message-bubble ${isMe ? 'my' : 'their'}`}
                >
                  <div className="bubble-sender">
                    {isMe ? 'You' : msg.username}
                  </div>
                  
                  {msg.type === 'file' && msg.fileData ? (
                    msg.fileData.type.startsWith('image/') ? (
                      <div>
                        <a href={msg.fileData.data} target="_blank" rel="noopener noreferrer">
                          <img
                            src={msg.fileData.data}
                            alt={msg.fileData.name}
                            className="chat-image-preview"
                          />
                        </a>
                        <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.8, fontStyle: 'italic' }}>
                          📸 {msg.fileData.name} ({formatFileSize(msg.fileData.size)})
                        </div>
                      </div>
                    ) : (
                      <div className="file-attachment-card">
                        <div className="file-icon">📄</div>
                        <div className="file-info">
                          <div className="file-name" title={msg.fileData.name}>
                            {msg.fileData.name}
                          </div>
                          <div className="file-size">
                            {formatFileSize(msg.fileData.size)}
                          </div>
                        </div>
                        <a
                          href={msg.fileData.data}
                          download={msg.fileData.name}
                          className="file-download-link"
                          title="Download file"
                        >
                          ⬇️
                        </a>
                      </div>
                    )
                  ) : (
                    <div>{msg.text}</div>
                  )}

                  <div className="bubble-time">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              );
            })}
            
            {partnerIsTyping && (
              <div className="typing-box">
                <span>{otherUser || 'Someone'} is typing</span>
                <span style={{ marginLeft: '4px', display: 'inline-flex' }}>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                  <span className="typing-dot"></span>
                </span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          {/* Input Bar */}
          <div className="chat-input-bar" style={{ position: 'relative' }}>
            {showEmojiPicker && (
              <div className="emoji-popover">
                <div className="emoji-categories-bar">
                  {Object.keys(EMOJI_CATEGORIES).map(cat => (
                    <button
                      key={cat}
                      className={`category-tab ${activeEmojiCategory === cat ? 'active' : ''}`}
                      onClick={() => setActiveEmojiCategory(cat)}
                      title={cat}
                    >
                      {CATEGORY_ICONS[cat]}
                    </button>
                  ))}
                </div>
                <div className="emoji-grid">
                  {EMOJI_CATEGORIES[activeEmojiCategory].map(emoji => (
                    <button
                      key={emoji}
                      className="emoji-item"
                      onClick={() => handleEmojiClick(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              className="icon-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              title="Add emoji"
            >
              😀
            </button>

            <button
              className="icon-btn"
              onClick={triggerFileSelect}
              title="Attach file (Max 2MB)"
            >
              📎
            </button>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />

            <input
              className="chat-input-field"
              placeholder="Type a message..."
              value={input}
              onChange={handleInputChange}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              onClick={() => setShowEmojiPicker(false)}
            />
            <button className="send-btn" onClick={sendMessage}>
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;