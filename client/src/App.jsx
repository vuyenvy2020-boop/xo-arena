import { useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./socket";
import "./App.css";

const SIZE = 15;
const TURN_TIME = 30; // phải khớp với TURN_TIME ở server
const EMOJIS = ["👍", "😂", "😮", "😡", "🔥", "👏"];
const CONFETTI_COLORS = ["#ff5c8a", "#4de1ff", "#facc15", "#8b5cf6", "#34d399"];
const emptyBoard = () =>
  Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

/* ---------- Âm thanh tự tạo, không cần file ---------- */
let audioCtx;
let soundOn = true;
function beep(freq, dur = 0.1, type = "sine") {
  if (!soundOn) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch {
    /* trình duyệt chặn âm thanh thì bỏ qua */
  }
}

/* ---------- Quân X và O vẽ bằng SVG ---------- */
function Mark({ type }) {
  if (type === "X")
    return (
      <svg viewBox="0 0 24 24" className="mark x">
        <path d="M5 5 L19 19" />
        <path d="M19 5 L5 19" />
      </svg>
    );
  if (type === "O")
    return (
      <svg viewBox="0 0 24 24" className="mark o">
        <circle cx="12" cy="12" r="7.5" />
      </svg>
    );
  return null;
}

/* ---------- Avatar: chữ cái đầu của tên ---------- */
function Avatar({ name, mark }) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  return <div className={"avatar " + mark}>{letter}</div>;
}

/* ---------- Khung nền chung có hình trang trí bay lơ lửng ---------- */
const DECO = [
  { t: "x", x: "6%", y: "10%", s: "70px", d: "0s" },
  { t: "o", x: "85%", y: "14%", s: "90px", d: "1.2s" },
  { t: "o", x: "12%", y: "70%", s: "80px", d: "2.4s" },
  { t: "x", x: "80%", y: "72%", s: "100px", d: "0.6s" },
  { t: "x", x: "46%", y: "86%", s: "50px", d: "1.8s" },
  { t: "o", x: "50%", y: "6%", s: "46px", d: "3s" },
];

function Shell({ children }) {
  return (
    <div className="app">
      <div className="deco" aria-hidden="true">
        {DECO.map((d, i) => (
          <span
            key={i}
            className={"deco-item deco-" + d.t}
            style={{ left: d.x, top: d.y, fontSize: d.s, animationDelay: d.d }}
          >
            {d.t === "x" ? "X" : "O"}
          </span>
        ))}
      </div>
      <main className="content">{children}</main>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home"); // home | waiting | playing
  const [name, setName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [roomId, setRoomId] = useState("");
  const [myMark, setMyMark] = useState(null);
  const [players, setPlayers] = useState([]);
  const [board, setBoard] = useState(emptyBoard());
  const [turn, setTurn] = useState("X");
  const [result, setResult] = useState(null);
  const [reason, setReason] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [winLine, setWinLine] = useState([]);
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scores, setScores] = useState({ X: 0, O: 0 });
  const [timeLeft, setTimeLeft] = useState(TURN_TIME);
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [reactions, setReactions] = useState([]);
  const chatRef = useRef(null);

  // Các mảnh pháo giấy, tạo một lần
  const confetti = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        dur: 2.5 + Math.random() * 2,
        size: 8 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      })),
    []
  );

  /* ----- Nhận sự kiện từ server ----- */
  useEffect(() => {
    socket.on("gameStart", ({ players, turn, scores, timeLeft }) => {
      setPlayers(players);
      setBoard(emptyBoard());
      setTurn(turn);
      setScores(scores || { X: 0, O: 0 });
      setTimeLeft(timeLeft ?? TURN_TIME);
      setResult(null);
      setReason(null);
      setLastMove(null);
      setWinLine([]);
      setScreen("playing");
      beep(660, 0.12);
    });
    socket.on("moved", ({ row, col, mark, nextTurn, timeLeft }) => {
      setBoard((b) =>
        b.map((r, i) => r.map((c, j) => (i === row && j === col ? mark : c)))
      );
      setTurn(nextTurn);
      setTimeLeft(timeLeft ?? TURN_TIME);
      setLastMove([row, col]);
      beep(mark === "X" ? 520 : 390, 0.09);
    });
    socket.on("gameOver", ({ winner, line, reason, scores }) => {
      setResult(winner);
      setReason(reason || null);
      setWinLine(line || []);
      if (scores) setScores(scores);
    });
    socket.on("chat", (msg) => {
      setMessages((m) => [...m.slice(-49), msg]);
    });
    socket.on("reaction", ({ emoji, mark }) => {
      const id = Date.now() + Math.random();
      const left = 10 + Math.random() * 80;
      setReactions((r) => [...r, { id, emoji, mark, left }]);
      setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2500);
    });
    socket.on("opponentLeft", () => {
      alert("Đối thủ đã thoát");
      window.location.reload();
    });
    return () => {
      socket.off("gameStart");
      socket.off("moved");
      socket.off("gameOver");
      socket.off("chat");
      socket.off("reaction");
      socket.off("opponentLeft");
    };
  }, []);

  /* ----- Đếm ngược mỗi giây ----- */
  useEffect(() => {
    if (screen !== "playing" || result) return;
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [screen, result]);

  // Tiếng tít cảnh báo 5 giây cuối (chỉ với người đang tới lượt)
  useEffect(() => {
    if (screen === "playing" && !result && turn === myMark && timeLeft > 0 && timeLeft <= 5) {
      beep(880, 0.06, "square");
    }
  }, [timeLeft]);

  // Âm thanh khi có kết quả
  useEffect(() => {
    if (!result) return;
    if (result === "draw") beep(440, 0.25);
    else if (result === myMark) {
      beep(784, 0.15);
      setTimeout(() => beep(988, 0.3), 150);
    } else {
      beep(330, 0.2);
      setTimeout(() => beep(220, 0.35), 180);
    }
  }, [result, myMark]);

  // Chat tự cuộn xuống tin mới nhất
  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight });
  }, [messages]);

  /* ----- Các hành động ----- */
  const toggleMute = () => {
    soundOn = !soundOn;
    setMuted(!soundOn);
  };

  const createRoom = () => {
    if (!name.trim()) return alert("Nhập tên trước nhé");
    socket.emit("createRoom", { name: name.trim() }, ({ roomId, mark }) => {
      setRoomId(roomId);
      setMyMark(mark);
      setScreen("waiting");
    });
  };

  const joinRoom = () => {
    if (!name.trim()) return alert("Nhập tên trước nhé");
    socket.emit(
      "joinRoom",
      { roomId: roomInput.trim().toUpperCase(), name: name.trim() },
      (res) => {
        if (res.error) return alert(res.error);
        setRoomId(res.roomId);
        setMyMark(res.mark);
      }
    );
  };

  const play = (row, col) => {
    if (turn !== myMark || board[row][col] || result) return;
    socket.emit("move", { roomId, row, col });
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    socket.emit("chat", { roomId, text });
    setChatInput("");
  };

  const sendReaction = (emoji) => socket.emit("reaction", { roomId, emoji });

  /* ---------- Màn hình Home ---------- */
  if (screen === "home")
    return (
      <Shell>
        <div className="card">
          <h1 className="logo">
            <span className="lx">X</span>-<span className="lo">O</span> Arena
          </h1>
          <p className="tagline">Đấu caro trực tuyến, đủ 5 quân liên tiếp là thắng</p>
          <input
            placeholder="Nhập tên của bạn"
            maxLength={16}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="btn primary" onClick={createRoom}>
            Tạo phòng mới
          </button>
          <div className="divider">
            <span>hoặc</span>
          </div>
          <div className="join-row">
            <input
              className="code"
              placeholder="MÃ PHÒNG"
              maxLength={5}
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
            />
            <button className="btn" onClick={joinRoom}>
              Vào phòng
            </button>
          </div>
        </div>
      </Shell>
    );

    /* ---------- Phòng chờ ---------- */
  if (screen === "waiting")
    return (
      <Shell>
        <div className="night" aria-hidden="true">
          {/* Kho hình dùng lại: hoa, lá, bó hoa */}
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <defs>
              <symbol id="flower" viewBox="0 0 100 100">
                <g fill="currentColor">
                  <ellipse cx="50" cy="26" rx="14" ry="22" />
                  <ellipse cx="50" cy="26" rx="14" ry="22" transform="rotate(72 50 50)" />
                  <ellipse cx="50" cy="26" rx="14" ry="22" transform="rotate(144 50 50)" />
                  <ellipse cx="50" cy="26" rx="14" ry="22" transform="rotate(216 50 50)" />
                  <ellipse cx="50" cy="26" rx="14" ry="22" transform="rotate(288 50 50)" />
                </g>
                <circle cx="50" cy="50" r="12" fill="#facc15" />
                <circle cx="50" cy="50" r="12" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="2" />
              </symbol>

              <symbol id="leaf" viewBox="0 0 60 100">
                <path d="M30 2 C58 30 58 70 30 98 C2 70 2 30 30 2 Z" fill="currentColor" />
                <path d="M30 10 L30 92" stroke="#fff" strokeOpacity="0.35" strokeWidth="2" fill="none" />
              </symbol>

              <symbol id="bouquet" viewBox="0 0 240 260">
                <g fill="none" stroke="#3fae7a" strokeWidth="4" strokeLinecap="round">
                  <path d="M20 260 C40 200 60 150 102 110" />
                  <path d="M60 260 C80 210 130 170 162 140" />
                  <path d="M30 260 C28 245 28 232 28 218" />
                </g>
                <use href="#leaf" x="38" y="150" width="26" height="44" transform="rotate(-35 51 172)" style={{ color: "#34d399" }} />
                <use href="#leaf" x="90" y="190" width="26" height="44" transform="rotate(40 103 212)" style={{ color: "#2dd4bf" }} />
                <use href="#leaf" x="128" y="160" width="26" height="44" transform="rotate(30 141 182)" style={{ color: "#4ade80" }} />
                <use href="#flower" x="62" y="70" width="80" height="80" style={{ color: "#ff8fb8" }} />
                <use href="#flower" x="130" y="108" width="64" height="64" style={{ color: "#c4b5fd" }} />
                <use href="#flower" x="0" y="190" width="56" height="56" style={{ color: "#fbcfe8" }} />
              </symbol>
            </defs>
          </svg>

          {/* Trăng khuyết */}
          <svg className="moon" viewBox="0 0 120 120">
            <defs>
              <radialGradient id="moonGlow">
                <stop offset="0" stopColor="#fff7d6" stopOpacity="0.9" />
                <stop offset="1" stopColor="#fff7d6" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="60" cy="60" r="58" fill="url(#moonGlow)" />
            <path d="M78 24 A42 42 0 1 0 78 96 A36 36 0 1 1 78 24 Z" fill="#fff3c4" />
          </svg>

          {/* Sao nhấp nháy */}
          {Array.from({ length: 26 }, (_, i) => (
            <span
              key={i}
              className="star"
              style={{
                left: ((i * 37) % 97) + 1 + "%",
                top: ((i * 53) % 70) + 2 + "%",
                fontSize: 8 + (i % 4) * 5 + "px",
                animationDelay: (i % 7) * 0.5 + "s",
              }}
            >
              {i % 3 === 0 ? "✧" : "✦"}
            </span>
          ))}

          {/* Hoa xoay chậm */}
          <svg className="fl f1" viewBox="0 0 100 100">
            <use href="#flower" />
          </svg>
          <svg className="fl f2" viewBox="0 0 100 100">
            <use href="#flower" />
          </svg>

          {/* Cánh hoa và lá rơi */}
          {["🌸", "🍃", "🌸", "🍃", "🌸", "🍃", "🌸"].map((p, i) => (
            <span
              key={i}
              className="petal"
              style={{
                left: 8 + i * 13 + "%",
                animationDuration: 9 + i * 1.3 + "s",
                animationDelay: i * 1.4 + "s",
              }}
            >
              {p}
            </span>
          ))}

          {/* Hai bó hoa ở góc dưới */}
          <svg className="bouquet left" viewBox="0 0 240 260">
            <use href="#bouquet" width="240" height="260" />
          </svg>
          <svg className="bouquet right" viewBox="0 0 240 260">
            <use href="#bouquet" width="240" height="260" />
          </svg>
        </div>

        <div className="card wait-card">
          <div className="wait-badge">🌙 Phòng chờ</div>
          <h2 className="title">Đang chờ đối thủ...</h2>
          <p className="tagline">Gửi mã phòng này cho bạn bè để cùng vào chơi</p>

          <div className="code-tiles">
            {roomId.split("").map((ch, i) => (
              <span key={i} style={{ animationDelay: i * 0.12 + "s" }}>
                {ch}
              </span>
            ))}
          </div>

          <button className="btn primary" onClick={copyCode}>
            {copied ? "✓ Đã sao chép!" : "Sao chép mã phòng"}
          </button>

          <div className="slots">
            <div className="slot ready">
              <div className={"wait-avatar " + myMark}>
                {name.trim().charAt(0).toUpperCase()}
              </div>
              <b>{name}</b>
              <small>Sẵn sàng</small>
            </div>
            <div className="vs">VS</div>
            <div className="slot empty">
              <div className="wait-avatar ghost">?</div>
              <b>Đang chờ...</b>
              <small>Chưa có người</small>
            </div>
          </div>

          <div className="dots">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <button className="link-btn" onClick={() => window.location.reload()}>
            ← Thoát phòng
          </button>
        </div>
      </Shell>
    );/* ---------- Màn hình chơi ---------- */
  const winSet = new Set(winLine.map(([r, c]) => r + "-" + c));
  const status = result
    ? ""
    : turn === myMark
    ? "Đến lượt bạn!"
    : "Đối thủ đang suy nghĩ...";
  const timerClass = timeLeft <= 5 ? "danger" : timeLeft <= 10 ? "warn" : "";

  return (
    <Shell>
      <div className="game">
        <header className="topbar">
          <h2 className="logo small">
            <span className="lx">X</span>-<span className="lo">O</span> Arena
          </h2>
          <div className="room-tag">Phòng {roomId}</div>
          <div className="tools">
            <button className="icon-btn" onClick={toggleMute} title="Bật/tắt âm thanh">
              {muted ? "🔇" : "🔊"}
            </button>
            <button
              className="icon-btn"
              onClick={() => window.location.reload()}
              title="Thoát phòng"
            >
              ⏻
            </button>
          </div>
        </header>

        <div className="layout">
          <section className="main">
            <div className="players">
              {["X", "O"].map((m) => {
                const p = players.find((pl) => pl.mark === m);
                return (
                  <div
                    key={m}
                    className={"player " + m + (turn === m && !result ? " active" : "")}
                  >
                    <Avatar name={p?.name} mark={m} />
                    <div className="p-info">
                      <b>{p?.name || "..."}</b>
                      <div className="p-mark">
                        quân {m}
                        {m === myMark && " (Bạn)"}
                      </div>
                    </div>
                    <div className="score">{scores[m]}</div>
                  </div>
                );
              })}
            </div>

            <p className="status">{status}</p>

            {!result && (
              <div className={"timer " + timerClass}>
                <div
                  className="timer-bar"
                  style={{ width: (timeLeft / TURN_TIME) * 100 + "%" }}
                />
                <span>⏱ {timeLeft}s</span>
              </div>
            )}

            <div className="board">
              {board.map((row, i) =>
                row.map((cell, j) => {
                  const key = i + "-" + j;
                  const canPlay = !cell && turn === myMark && !result;
                  const cls = [
                    "cell",
                    canPlay && "can-play hint-" + myMark,
                    lastMove && lastMove[0] === i && lastMove[1] === j && "last",
                    winSet.has(key) && "win",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button key={key} className={cls} onClick={() => play(i, j)}>
                      <Mark type={cell} />
                    </button>
                  );
                })
              )}
            </div>
          </section>

          <aside className="chat">
            <div className="chat-title">💬 Trò chuyện</div>
            <div className="chat-list" ref={chatRef}>
              {messages.length === 0 && (
                <p className="chat-empty">Chưa có tin nhắn. Hãy chào đối thủ nhé!</p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={"msg " + (m.mark === myMark ? "mine" : "theirs")}
                >
                  <span className={"msg-name " + m.mark}>{m.name}</span>
                  <div className="bubble">{m.text}</div>
                </div>
              ))}
            </div>
            <div className="emoji-row">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => sendReaction(e)}>
                  {e}
                </button>
              ))}
            </div>
            <div className="chat-input">
              <input
                placeholder="Nhập tin nhắn..."
                maxLength={200}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
              />
              <button className="btn primary" onClick={sendChat}>
                Gửi
              </button>
            </div>
          </aside>
        </div>

        {/* Biểu cảm bay */}
        <div className="reactions" aria-hidden="true">
          {reactions.map((r) => (
            <span key={r.id} className={"react " + r.mark} style={{ left: r.left + "%" }}>
              {r.emoji}
            </span>
          ))}
        </div>

        {/* Pháo giấy cho người thắng */}
        {result === myMark && (
          <div className="confetti" aria-hidden="true">
            {confetti.map((c, i) => (
              <i
                key={i}
                style={{
                  left: c.left + "%",
                  width: c.size,
                  height: c.size * 0.4,
                  background: c.color,
                  animationDelay: c.delay + "s",
                  animationDuration: c.dur + "s",
                }}
              />
            ))}
          </div>
        )}

        {result && (
          <div className="overlay">
            <div
              className={
                "popup " +
                (result === "draw" ? "draw" : result === myMark ? "win" : "lose")
              }
            >
              <div className="emoji">
                {result === "draw" ? "🤝" : result === myMark ? "🏆" : "😢"}
              </div>
              <h2>
                {result === "draw"
                  ? "Hòa rồi!"
                  : result === myMark
                  ? "Bạn thắng!"
                  : "Bạn thua!"}
              </h2>
              {reason === "timeout" && (
                <p className="sub">
                  {result === myMark ? "Đối thủ đã hết giờ" : "Bạn đã hết giờ"}
                </p>
              )}
              <p className="sub">
                Tỉ số: X {scores.X} - {scores.O} O
              </p>
              <div className="popup-actions">
                <button
                  className="btn primary"
                  onClick={() => socket.emit("restart", { roomId })}
                >
                  Chơi lại
                </button>
                <button className="btn" onClick={() => window.location.reload()}>
                  Thoát
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}