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

// Kiểm tra 5 quân liên tiếp theo 4 hướng: ngang, dọc, 2 đường chéo
function checkWin(board, r, c, mark) {
  const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
  for (const [dr, dc] of dirs) {
    let count = 1;
    for (const s of [1, -1]) {
      let i = r + dr * s;
      let j = c + dc * s;
      while (board[i]?.[j] === mark) {
        count++;
        i += dr * s;
        j += dc * s;
      }
    }
    if (count >= 5) return true;
  }
  return false;
}

io.on("connection", (socket) => {
  console.log("Có người kết nối:", socket.id);

  // Tạo phòng
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

  // Vào phòng
  socket.on("joinRoom", ({ roomId, name }, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ error: "Phòng không tồn tại" });
    if (room.players.length >= 2) return cb({ error: "Phòng đã đầy" });
    room.players.push({ id: socket.id, name, mark: "O" });
    socket.join(roomId);
    cb({ roomId, mark: "O" });
    io.to(roomId).emit("gameStart", { players: room.players, turn: room.turn });
  });

  // Đánh một nước
  socket.on("move", ({ roomId, row, col }) => {
    const room = rooms[roomId];
    if (!room || room.over) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.mark !== room.turn) return; // sai lượt
    if (room.board[row]?.[col] !== null) return; // ô đã có quân hoặc ngoài bàn

    room.board[row][col] = player.mark;
    room.moves++;
    room.turn = player.mark === "X" ? "O" : "X";
    io.to(roomId).emit("moved", {
      row,
      col,
      mark: player.mark,
      nextTurn: room.turn,
    });

    if (checkWin(room.board, row, col, player.mark)) {
      room.over = true;
      io.to(roomId).emit("gameOver", { winner: player.mark });
    } else if (room.moves === SIZE * SIZE) {
      room.over = true;
      io.to(roomId).emit("gameOver", { winner: "draw" });
    }
  });

  // Chơi lại
  socket.on("restart", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) return;
    Object.assign(room, { board: newBoard(), turn: "X", moves: 0, over: false });
    io.to(roomId).emit("gameStart", { players: room.players, turn: "X" });
  });

  // Người chơi thoát
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