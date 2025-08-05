// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const presentationRoutes = require('./routes/presentations');
const db = require('./db');

const app = express();
const server = http.createServer(app);

const io = require('./socket').init(server);

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173'
];
app.use(cors({ origin: allowedOrigins }));

app.use(express.json());
app.use('/api/presentations', presentationRoutes);

app.get('/', (req, res) => {
  res.send('Presentation API is running!');
});

const presentationRooms = {};

io.on('connection', (socket) => {
    const { nickname } = socket.handshake.query;
    console.log(`${nickname} connected:`, socket.id);

    socket.on('join_presentation', ({ presentationId }) => {
        socket.join(presentationId);
        if (!presentationRooms[presentationId]) {
            presentationRooms[presentationId] = [];
        }
        if (!presentationRooms[presentationId].find(user => user.id === socket.id)) {
            presentationRooms[presentationId].push({ id: socket.id, nickname });
        }
        io.to(presentationId).emit('update_user_list', presentationRooms[presentationId]);
    });

    socket.on('update_elements', async ({ presentationId, slideId, elements }) => {
        try {
            await db.query('UPDATE slides SET content = $1 WHERE id = $2', [JSON.stringify(elements), slideId]);
            socket.to(presentationId).emit('update_elements', elements);
        } catch (err) {
            console.error('Error updating elements in DB:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log(`${nickname} disconnected:`, socket.id);
        for (const presentationId in presentationRooms) {
            const userIndex = presentationRooms[presentationId].findIndex(user => user.id === socket.id);
            if (userIndex !== -1) {
                presentationRooms[presentationId].splice(userIndex, 1);
                io.to(presentationId).emit('update_user_list', presentationRooms[presentationId]);
            }
        }
    });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});