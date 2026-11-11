import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();
app.use(cors());
app.get("/", (req, res) => res.send("X-O Arena server đang chạy"));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const SIZE = 15;
const TURN_TIME = 30; // số giây mỗi lượt của người
const EMOJIS = ["👍", "😂", "😮", "😡", "🔥", "👏"];
const AVATARS = [
  "🦊", "🐧", "🐱", "🐶", "🐼", "🐰",
  "🐸", "🦉", "🐯", "🐨", "🦄", "🐙",
];
const LEVELS = { easy: "Dễ", normal: "Vừa", hard: "Khó" };
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
const rooms = {};

const cleanAvatar = (a, fallback) => (AVATARS.includes(a) ? a : fallback);
const cleanName = (n) => String(n || "Người chơi").trim().slice(0, 16) || "Người chơi";
const newBoard = () =>
  Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
const newRoomId = () => Math.random().toString(36).slice(2, 7).toUpperCase();

// Trả về danh sách ô thắng (>= 5 quân liên tiếp), hoặc null nếu chưa thắng
function checkWin(board, r, c, mark) {
  for (const [dr, dc] of DIRS) {
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

/* ================= AI: CHẤM ĐIỂM TỪNG Ô TRỐNG ================= */

// Điểm cho một chuỗi: count quân liên tiếp, open đầu còn trống
function patternScore(count, open) {
  if (count >= 5) return 100000;
  if (open === 0) return 0;
  if (count === 4) return open === 2 ? 10000 : 1000;
  if (count === 3) return open === 2 ? 1000 : 100;
  if (count === 2) return open === 2 ? 100 : 10;
  return open === 2 ? 10 : 1;
}

// Điểm nếu `mark` đánh vào ô (r, c), cộng cả 4 hướng
function cellScore(board, r, c, mark) {
  let total = 0;
  for (const [dr, dc] of DIRS) {
    let count = 1;
    let open = 0;
    for (const s of [1, -1]) {
      let i = r + dr * s;
      let j = c + dc * s;
      while (board[i]?.[j] === mark) {
        count++;
        i += dr * s;
        j += dc * s;
      }
      if (board[i]?.[j] === null) open++;
    }
    total += patternScore(count, open);
  }
  return total;
}

// Chỉ xét các ô trống nằm sát (trong 2 ô) quân đã đánh
function candidateCells(board) {
  const seen = new Set();
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === null) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const i = r + dr;
          const j = c + dc;
          const key = i * SIZE + j;
          if (board[i]?.[j] === null && !seen.has(key)) {
            seen.add(key);
            cells.push([i, j]);
          }
        }
      }
    }
  }
  return cells;
}

function aiPickMove(board, aiMark, level) {
  const human = aiMark === "X" ? "O" : "X";
  const cells = candidateCells(board);
  const mid = Math.floor(SIZE / 2);
  if (cells.length === 0) return [mid, mid]; // bàn trống thì đánh giữa

  const defW = { easy: 0.6, normal: 0.9, hard: 1.1 }[level] ?? 0.9;
  const noise = { easy: 0.5, normal: 0.15, hard: 0.02 }[level] ?? 0.15;

  const scored = cells.map(([r, c]) => {
    const attack = cellScore(board, r, c, aiMark);
    const defend = cellScore(board, r, c, human);
    const center = 14 - (Math.abs(r - mid) + Math.abs(c - mid)); // ưu tiên gần giữa
    const score = (attack + defend * defW) * (1 + Math.random() * noise) + center;
    return { r, c, attack, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Có nước thắng ngay thì luôn đánh
  const win = scored.find((s) => s.attack >= 100000);
  if (win) return [win.r, win.c];

  // Mức Dễ: thỉnh thoảng đi hơi ngẫu nhiên
  if (level === "easy" && Math.random() < 0.3) {
    const pick = scored[Math.floor(Math.random() * Math.min(6, scored.length))];
    return [pick.r, pick.c];
  }
  return [scored[0].r, scored[0].c];
}

/* ================= LƯỢT CHƠI VÀ ĐỒNG HỒ ================= */

// Đếm giờ cho người; lượt của máy thì không đếm
function startTurnTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;
  clearTimeout(room.timer);
  if (room.ai && room.turn === room.ai.mark) return;
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

// Máy suy nghĩ rồi đánh sau một lúc
function botTurn(roomId) {
  const room = rooms[roomId];
  if (!room?.ai || room.over || room.turn !== room.ai.mark) return;
  clearTimeout(room.botTimer);
  room.botTimer = setTimeout(() => {
    if (rooms[roomId] !== room || room.over || room.turn !== room.ai.mark) return;
    const [r, c] = aiPickMove(room.board, room.ai.mark, room.ai.level);
    applyMove(roomId, room.ai.mark, r, c);
  }, 500 + Math.random() * 600);
}

// Đặt quân, báo cho cả phòng, kiểm tra thắng/hòa, chuyển lượt
function applyMove(roomId, mark, row, col) {
  const room = rooms[roomId];
  if (!room) return;
  room.board[row][col] = mark;
  room.moves++;
  room.turn = mark === "X" ? "O" : "X";
  io.to(roomId).emit("moved", {
    row,
    col,
    mark,
    nextTurn: room.turn,
    timeLeft: TURN_TIME,
  });

  const line = checkWin(room.board, row, col, mark);
  if (line) {
    room.over = true;
    clearTimeout(room.timer);
    room.scores[mark]++;
    io.to(roomId).emit("gameOver", { winner: mark, line, scores: room.scores });
  } else if (room.moves === SIZE * SIZE) {
    room.over = true;
    clearTimeout(room.timer);
    io.to(roomId).emit("gameOver", { winner: "draw", scores: room.scores });
  } else {
    startTurnTimer(roomId);
    botTurn(roomId);
  }
}

io.on("connection", (socket) => {
  console.log("Có người kết nối:", socket.id);

    // Tạo phòng chờ người thật (người tạo phòng chọn quân X hoặc O)
  socket.on("createRoom", ({ name, avatar, mark }, cb) => {
    const myMark = mark === "O" ? "O" : "X";
    const roomId = newRoomId();
    rooms[roomId] = {
      players: [
        {
          id: socket.id,
          name: cleanName(name),
          mark: myMark,
          avatar: cleanAvatar(avatar, myMark === "X" ? "🦊" : "🐧"),
        },
      ],
      board: newBoard(),
      turn: "X",
      moves: 0,
      over: false,
      scores: { X: 0, O: 0 },
      timer: null,
      ai: null,
    };
    socket.join(roomId);
    cb({ roomId, mark: myMark });
  });

  // Tạo phòng chơi với máy: vào chơi ngay (người chọn X hoặc O, máy cầm quân còn lại)
  socket.on("createAIRoom", ({ name, avatar, level, mark }, cb) => {
    const lv = LEVELS[level] ? level : "normal";
    const myMark = mark === "O" ? "O" : "X";
    const botMark = myMark === "X" ? "O" : "X";
    const roomId = newRoomId();
    const room = {
      players: [
        {
          id: socket.id,
          name: cleanName(name),
          mark: myMark,
          avatar: cleanAvatar(avatar, "🦊"),
        },
        { id: "AI", name: "Máy (" + LEVELS[lv] + ")", mark: botMark, avatar: "🤖" },
      ],
      board: newBoard(),
      turn: "X",
      moves: 0,
      over: false,
      scores: { X: 0, O: 0 },
      timer: null,
      ai: { mark: botMark, level: lv },
    };
    rooms[roomId] = room;
    socket.join(roomId);
    cb({ roomId, mark: myMark });
    io.to(roomId).emit("gameStart", {
      players: room.players,
      turn: "X",
      scores: room.scores,
      timeLeft: TURN_TIME,
      vsAI: true,
    });
    startTurnTimer(roomId);
    botTurn(roomId); // nếu máy cầm X thì máy đi trước
  });

  // Vào phòng: nhận quân còn lại so với người tạo phòng
  socket.on("joinRoom", ({ roomId, name, avatar }, cb) => {
    const room = rooms[roomId];
    if (!room || room.ai) return cb({ error: "Phòng không tồn tại" });
    if (room.players.length >= 2) return cb({ error: "Phòng đã đầy" });
    const joinMark = room.players[0].mark === "X" ? "O" : "X";
    room.players.push({
      id: socket.id,
      name: cleanName(name),
      mark: joinMark,
      avatar: cleanAvatar(avatar, joinMark === "X" ? "🦊" : "🐧"),
    });
    socket.join(roomId);
    cb({ roomId, mark: joinMark });
    io.to(roomId).emit("gameStart", {
      players: room.players,
      turn: room.turn,
      scores: room.scores,
      timeLeft: TURN_TIME,
      vsAI: false,
    });
    startTurnTimer(roomId);
  });
  
  // Người chơi đánh một nước
  socket.on("move", ({ roomId, row, col }) => {
    const room = rooms[roomId];
    if (!room || room.over) return;
    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.mark !== room.turn) return;
    if (room.board[row]?.[col] !== null) return;
    applyMove(roomId, player.mark, row, col);
  });

  // Chơi lại (giữ nguyên tỉ số)
  socket.on("restart", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room || !room.over || room.players.length < 2) return;
    clearTimeout(room.botTimer);
    Object.assign(room, { board: newBoard(), turn: "X", moves: 0, over: false });
    io.to(roomId).emit("gameStart", {
      players: room.players,
      turn: "X",
      scores: room.scores,
      timeLeft: TURN_TIME,
      vsAI: !!room.ai,
    });
    startTurnTimer(roomId);
        botTurn(roomId);
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
        clearTimeout(room.botTimer);
        socket.to(roomId).emit("opponentLeft");
        delete rooms[roomId];
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Server chạy ở cổng " + PORT));