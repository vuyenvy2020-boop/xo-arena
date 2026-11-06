import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const SIZE = 15;
const rooms = {};

const newBoard = () =>
  Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

// Trả về danh sách ô thắng (>= 5 quân liên tiếp), hoặc null nếu chưa thắng
function checkWin(board, r, c, mark) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    const line = [[r, c]];
    for (const s of [1, -1]) {
      let i = r + dr * s;
      let j = c + dc * s;
      while (board[i]?.[j] === mark) {
        line.push([i, j]);
        i += dr * s;
        j += dc * s;
      }
    }
    if (line.length >= 5) return line;
  }
  return null;
}

io.on("connection", (socket) => {
  console.log("Có người kết nối:", socket.id);

  socket.on("createRoom", ({ name }, cb) => {
    const roomId = Math.random().toString(36).slice(2, 7).toUpperCase();
    rooms[roomId] = {
      players: [{ id: socket.id, name, mark: "X" }],
      board: newBoard(),
      turn: "X",
      moves: 0,
      over: false,
    };
    socket.join(roomId);
    cb({ roomId, mark: "X" });
  });

  socket.on("joinRoom", ({ roomId, name }, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ error: "Phòng không tồn tại" });
    if (room.players.length >= 2) return cb({ error: "Phòng đã đầy" });
    room.players.push({ id: socket.id, name, mark: "O" });
    socket.join(roomId);
    cb({ roomId, mark: "O" });
    io.to(roomId).emit("gameStart", { players: room.players, turn: room.turn });
  });

  socket.on("move", ({ roomId, row, col }) => {
    const room = rooms[roomId];
    if (!room || room.over) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.mark !== room.turn) return;
    if (room.board[row]?.[col] !== null) return;

    room.board[row][col] = player.mark;
    room.moves++;
    room.turn = player.mark === "X" ? "O" : "X";
    io.to(roomId).emit("moved", {
      row,
      col,
      mark: player.mark,
      nextTurn: room.turn,
    });

    const line = checkWin(room.board, row, col, player.mark);
    if (line) {
      room.over = true;
      io.to(roomId).emit("gameOver", { winner: player.mark, line });
    } else if (room.moves === SIZE * SIZE) {
      room.over = true;
      io.to(roomId).emit("gameOver", { winner: "draw" });
    }
  });

  socket.on("restart", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    Object.assign(room, { board: newBoard(), turn: "X", moves: 0, over: false });
    io.to(roomId).emit("gameStart", { players: room.players, turn: "X" });
  });

  socket.on("disconnect", () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players.some((p) => p.id === socket.id)) {
        socket.to(roomId).emit("opponentLeft");
        delete rooms[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Server chạy ở cổng " + PORT));