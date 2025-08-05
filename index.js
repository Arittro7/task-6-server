require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const presentationRoutes = require('./routes/presentations');

const app = express();
const server = http.createServer(app);

const io = require('./socket').init(server);

const presentationRooms = {};

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(express.json());
app.use('/api/presentations', presentationRoutes);

app.get('/', (req, res) => {
  res.send('Presentation API is running!');
});

// connect🔌
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  const { nickname } = socket.handshake.query;

  socket.on('join_presentation', ({ presentationId }) => {
    socket.join(presentationId);
    console.log(`${nickname} (${socket.id}) joined presentation ${presentationId}`);

    if (!presentationRooms[presentationId]) {
      presentationRooms[presentationId] = [];
    }

    if (!presentationRooms[presentationId].find(user => user.id === socket.id)) {
      presentationRooms[presentationId].push({ id: socket.id, nickname });
    }

    io.to(presentationId).emit('update_user_list', presentationRooms[presentationId]);
  });

  // update
  socket.on('update_elements', async ({ presentationId, slideId, elements }) => {
    try {

      await db.query(
        'UPDATE slides SET content = $1 WHERE id = $2',
        [JSON.stringify(elements), slideId]
      );

      socket.to(presentationId).emit('update_elements', elements);
    } catch (err) {
      console.error('Error updating elements in DB:', err);
    }
  });

  // ❌
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
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