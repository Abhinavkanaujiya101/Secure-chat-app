const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: {
    origin: "*",  // Allow all origins
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e7 // 10MB limit to support image and file attachments
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Store rooms in memory
const rooms = {};
const usedCodes = new Set();

// Generate 6-digit code
function generateCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms[code] || usedCodes.has(code));
  return code;
}

// Create room API
app.post('/api/create', (req, res) => {
  const { username } = req.body;
  
  if (!username || username.length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }
  
  const code = generateCode();
  rooms[code] = {
    creator: username,
    joiner: null,
    locked: false,
    messages: [],
    createdAt: new Date(),
    sockets: []  // Store socket IDs of users in this room
  };
  
  console.log(`Room ${code} created by ${username}`);
  res.json({ code, username });
});

// Join room API
app.post('/api/join', (req, res) => {
  const { code, username } = req.body;
  
  if (!rooms[code]) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  if (rooms[code].locked) {
    return res.status(400).json({ error: 'Room already taken' });
  }
  
  if (rooms[code].creator === username) {
    return res.status(400).json({ error: 'Use different name' });
  }
  
  rooms[code].joiner = username;
  rooms[code].locked = true;
  usedCodes.add(code);
  
  console.log(`${username} joined room ${code}`);
  res.json({ success: true, creator: rooms[code].creator });
});

// Real-time chat with Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join chat room
  socket.on('join-chat', ({ code, username }) => {
    console.log(`User ${username} joining chat room ${code}`);
    
    if (!rooms[code]) {
      socket.emit('error', { message: 'Room not found' });
      return;
    }
    
    // Verify user is authorized
    if (username !== rooms[code].creator && username !== rooms[code].joiner) {
      socket.emit('error', { message: 'Unauthorized access' });
      return;
    }
    
    // Join socket room
    socket.join(code);
    socket.roomCode = code;
    socket.username = username;
    
    // Store socket in room
    if (!rooms[code].sockets) rooms[code].sockets = [];
    rooms[code].sockets.push(socket.id);
    
    // Notify others in the room
    socket.to(code).emit('user-joined', {
      username: username,
      message: `${username} joined the chat`
    });
    
    // Send welcome message
    socket.emit('system-message', {
      message: `Welcome to chat room ${code}!`,
      timestamp: new Date()
    });
    
    // Send chat history
    socket.emit('chat-history', rooms[code].messages);
    
    // If both users are now connected, notify them
    const room = rooms[code];
    const roomSockets = io.sockets.adapter.rooms.get(code);
    
    if (roomSockets && roomSockets.size === 2) {
      io.to(code).emit('chat-ready', {
        message: 'Chat is ready! Both users are connected.',
        users: [room.creator, room.joiner]
      });
    }
    
    console.log(`${username} joined chat room ${code}. Total in room: ${roomSockets ? roomSockets.size : 0}`);
  });
  
  // Handle messages
  socket.on('send-message', ({ text, fileData }) => {
    const code = socket.roomCode;
    const username = socket.username;
    
    if (!code || !username) {
      console.log('No room or username');
      return;
    }
    
    // Check if either text is present or a file is being sent
    if ((!text || text.trim().length === 0) && !fileData) return;
    
    const room = rooms[code];
    if (!room) return;
    
    // Create message object
    const message = {
      id: Date.now(),
      text: text ? text.trim() : '',
      username: username,
      timestamp: new Date().toISOString(),
      type: fileData ? 'file' : 'chat',
      fileData: fileData || null
    };
    
    // Store message
    room.messages.push(message);
    
    // Limit messages to last 100
    if (room.messages.length > 100) {
      room.messages = room.messages.slice(-100);
    }
    
    // Broadcast to everyone in the room (including sender)
    io.to(code).emit('new-message', message);
    
    if (fileData) {
      console.log(`File message from ${username} in ${code}: ${fileData.name} (${fileData.type})`);
    } else {
      console.log(`Message from ${username} in ${code}: ${text.substring(0, 50)}...`);
    }
  });
  
  // Typing indicator
  socket.on('typing', (isTyping) => {
    const code = socket.roomCode;
    if (code) {
      socket.to(code).emit('user-typing', {
        username: socket.username,
        isTyping: isTyping
      });
    }
  });
  
  // Disconnection handling
  socket.on('disconnect', () => {
    const code = socket.roomCode;
    const username = socket.username;
    
    if (code && username) {
      // Remove socket from room
      const room = rooms[code];
      if (room && room.sockets) {
        room.sockets = room.sockets.filter(id => id !== socket.id);
      }
      
      // Notify others in room
      socket.to(code).emit('user-left', {
        username: username,
        message: `${username} left the chat`
      });
      
      console.log(`${username} disconnected from room ${code}`);
      
      // Clean up room if empty
      setTimeout(() => {
        const roomSockets = io.sockets.adapter.rooms.get(code);
        if (!roomSockets || roomSockets.size === 0) {
          delete rooms[code];
          console.log(`Room ${code} cleaned up`);
        }
      }, 5000);
    }
    
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket ready for real-time chat`);
});