import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const SIZE = 15;
const TURN_TIME = 30; // số giây mỗi lượt
const EMOJIS = ["👍", "😂", "😮", "😡", "🔥", "👏"];
const AVATARS = [
  "🦊", "🐧", "🐱", "🐶", "🐼", "🐰",
  "🐸", "🦉", "🐯", "🐨", "🦄", "🐙",
];
const cleanAvatar = (a, fallback) => (AVATARS.includes(a) ? a : fallback);
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

// Bắt đầu đếm giờ cho lượt hiện tại; hết giờ thì người đang tới lượt thua
function startTurnTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    if (rooms[roomId] !== room || room.over) return;
    const winner = room.turn === "X" ? "O" : "X";
    room.over = true;
    room.scores[winner]++;
    io.to(roomId).emit("gameOver", {
      winner,
      reason: "timeout",
      scores: room.scores,
    });
  }, TURN_TIME * 1000 + 500);
}

io.on("connection", (socket) => {
  console.log("Có người kết nối:", socket.id);

  // Tạo phòng
  socket.on("createRoom", ({ name, avatar }, cb) => {
    const roomId = Math.random().toString(36).slice(2, 7).toUpperCase();
    rooms[roomId] = {
      players: [{ id: socket.id, name, mark: "X", avatar: cleanAvatar(avatar, "🦊") }],
      board: newBoard(),
      turn: "X",
      moves: 0,
      over: false,
      scores: { X: 0, O: 0 },
      timer: null,
    };
    socket.join(roomId);
    cb({ roomId, mark: "X" });
  });

  // Vào phòng
  socket.on("joinRoom", ({ roomId, name, avatar }, cb) => {
    const room = rooms[roomId];
    if (!room) return cb({ error: "Phòng không tồn tại" });
    if (room.players.length >= 2) return cb({ error: "Phòng đã đầy" });
    room.players.push({ id: socket.id, name, mark: "O", avatar: cleanAvatar(avatar, "🐧") });
    socket.join(roomId);
    cb({ roomId, mark: "O" });
    io.to(roomId).emit("gameStart", {
      players: room.players,
      turn: room.turn,
      scores: room.scores,
      timeLeft: TURN_TIME,
    });
    startTurnTimer(roomId);
  });

  // Đánh một nước
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
      timeLeft: TURN_TIME,
    });

    const line = checkWin(room.board, row, col, player.mark);
    if (line) {
      room.over = true;
      clearTimeout(room.timer);
      room.scores[player.mark]++;
      io.to(roomId).emit("gameOver", {
        winner: player.mark,
        line,
        scores: room.scores,
      });
    } else if (room.moves === SIZE * SIZE) {
      room.over = true;
      clearTimeout(room.timer);
      io.to(roomId).emit("gameOver", { winner: "draw", scores: room.scores });
    } else {
      startTurnTimer(roomId);
    }
  });

  // Chơi lại (giữ nguyên tỉ số)
  socket.on("restart", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.over || room.players.length < 2) return;
    Object.assign(room, { board: newBoard(), turn: "X", moves: 0, over: false });
    io.to(roomId).emit("gameStart", {
      players: room.players,
      turn: "X",
      scores: room.scores,
      timeLeft: TURN_TIME,
    });
    startTurnTimer(roomId);
  });

  // Chat trong phòng
  socket.on("chat", ({ roomId, text }) => {
    const room = rooms[roomId];
    if (!room) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    const clean = String(text || "").trim().slice(0, 200);
    if (!clean) return;
    io.to(roomId).emit("chat", {
      name: player.name,
      mark: player.mark,
      text: clean,
    });
  });

  // Biểu cảm bay (chỉ nhận emoji nằm trong danh sách cho phép)
  socket.on("reaction", ({ roomId, emoji }) => {
    const room = rooms[roomId];
    if (!room || !EMOJIS.includes(emoji)) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    io.to(roomId).emit("reaction", { emoji, mark: player.mark });
  });

  // Người chơi thoát
  socket.on("disconnect", () => {
    for (const [roomId, room] of Object.entries(rooms)) {
      if (room.players.some((p) => p.id === socket.id)) {
        clearTimeout(room.timer);
        socket.to(roomId).emit("opponentLeft");
        delete rooms[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Server chạy ở cổng " + PORT));