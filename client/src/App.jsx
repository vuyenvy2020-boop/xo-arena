import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { socket } from "./socket";
import AvatarPicker from "./AvatarPicker";
import "./App.css";

const SIZE = 15;
const TURN_TIME = 30; // phải khớp với TURN_TIME ở server
const EMOJIS = ["👍", "😂", "😮", "😡", "🔥", "👏"];
const ANIMAL = { X: "🦊", O: "🐧" }; // con vật đại diện cho mỗi bên
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

/* ---------- Avatar con vật ---------- */
function Avatar({ mark, emoji }) {
  return <div className={"avatar " + mark}>{emoji || ANIMAL[mark]}</div>;
}

/* ---------- Cây thông ---------- */
function Pine({ className }) {
  return (
    <svg className={"tree " + className} viewBox="0 0 100 160">
      <rect x="44" y="128" width="12" height="32" rx="3" fill="#2b1b3f" />
      <path
        d="M50 4 L82 52 H66 L92 92 H72 L100 134 H0 L28 92 H8 L34 52 H18 Z"
        fill="currentColor"
      />
    </svg>
  );
}

/* ---------- Cây tròn có cú mèo đậu trên cành ---------- */
function OwlTree() {
  return (
    <svg className="owltree" viewBox="0 0 200 260">
      <path d="M88 260 C92 210 90 170 84 134 L116 134 C110 170 108 210 112 260 Z" fill="#2b1b3f" />
      <path
        d="M106 172 C130 168 152 162 178 152"
        stroke="#2b1b3f"
        strokeWidth="9"
        fill="none"
        strokeLinecap="round"
      />
      <g fill="#1d6b57">
        <circle cx="100" cy="78" r="56" />
        <circle cx="54" cy="106" r="38" />
        <circle cx="148" cy="106" r="38" />
      </g>
      <circle cx="80" cy="52" r="16" fill="#fff" opacity="0.07" />
      <g className="owl" transform="translate(150 108)">
        <ellipse cx="18" cy="26" rx="15" ry="18" fill="#9a7650" />
        <ellipse cx="18" cy="31" rx="9" ry="11" fill="#d9bf94" />
        <path d="M5 14 L7 2 L15 10 Z" fill="#9a7650" />
        <path d="M31 14 L29 2 L21 10 Z" fill="#9a7650" />
        <circle cx="11" cy="20" r="7.5" fill="#fff7d6" />
        <circle cx="25" cy="20" r="7.5" fill="#fff7d6" />
        <circle cx="11" cy="20" r="3.5" fill="#1b1340" />
        <circle cx="25" cy="20" r="3.5" fill="#1b1340" />
        <ellipse className="lid" cx="11" cy="20" rx="8" ry="8" fill="#9a7650" />
        <ellipse className="lid" cx="25" cy="20" rx="8" ry="8" fill="#9a7650" />
        <path d="M15.5 25 L20.5 25 L18 30 Z" fill="#f59e0b" />
        <path
          d="M9 44 L9 48 M13 44 L13 48 M23 44 L23 48 M27 44 L27 48"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

/* ---------- Mèo đen ngồi trên đồi ---------- */
function Cat() {
  return (
    <svg className="cat" viewBox="0 0 160 150">
      <path
        className="tail"
        d="M112 128 C150 128 158 96 140 80"
        stroke="#4a3a7a"
        strokeWidth="12"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M46 148 C34 110 52 70 80 70 C108 70 126 110 114 148 Z" fill="#4a3a7a" />
      <ellipse cx="64" cy="146" rx="12" ry="6" fill="#4a3a7a" />
      <ellipse cx="96" cy="146" rx="12" ry="6" fill="#4a3a7a" />
      <circle cx="80" cy="58" r="30" fill="#4a3a7a" />
      <path d="M54 42 L52 14 L74 30 Z" fill="#4a3a7a" />
      <path d="M106 42 L108 14 L86 30 Z" fill="#4a3a7a" />
      <path d="M57 36 L56 22 L67 30 Z" fill="#ff8fb8" opacity="0.7" />
      <path d="M103 36 L104 22 L93 30 Z" fill="#ff8fb8" opacity="0.7" />
      <ellipse className="eye" cx="68" cy="58" rx="6" ry="8" fill="#fde047" />
      <ellipse className="eye" cx="92" cy="58" rx="6" ry="8" fill="#fde047" />
      <ellipse cx="68" cy="58" rx="2" ry="6" fill="#1b1340" />
      <ellipse cx="92" cy="58" rx="2" ry="6" fill="#1b1340" />
      <path d="M77 69 L83 69 L80 74 Z" fill="#ff8fb8" />
      <g stroke="#cbb8ff" strokeWidth="1.5" strokeLinecap="round" opacity="0.55">
        <path d="M60 68 L38 63" />
        <path d="M60 72 L38 75" />
        <path d="M100 68 L122 63" />
        <path d="M100 72 L122 75" />
      </g>
    </svg>
  );
}

/* ---------- Bầu trời đêm dùng chung cho mọi màn hình ---------- */
function NightScene({ mode }) {
  const showFlowers = mode !== "game";
  return (
    <div className={"night " + mode} aria-hidden="true">
      {/* Kho hình hoa dùng lại */}
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

      {/* Sao nhấp nháy và sao băng */}
      {Array.from({ length: 26 }, (_, i) => (
        <span
          key={i}
          className="star"
          style={{
            left: ((i * 37) % 97) + 1 + "%",
            top: ((i * 53) % 60) + 2 + "%",
            fontSize: 8 + (i % 4) * 5 + "px",
            animationDelay: (i % 7) * 0.5 + "s",
          }}
        >
          {i % 3 === 0 ? "✧" : "✦"}
        </span>
      ))}
      <span className="shoot"></span>

      {/* Dơi bay ngang */}
      {[
        { top: "8%", dur: 19, delay: 0 },
        { top: "22%", dur: 24, delay: 7 },
        { top: "15%", dur: 21, delay: 13 },
      ].map((b, i) => (
        <span
          key={i}
          className="bat"
          style={{ top: b.top, animationDuration: b.dur + "s", animationDelay: b.delay + "s" }}
        >
          🦇
        </span>
      ))}

      {/* Đồi, cây cối, con vật */}
      <svg className="hills" viewBox="0 0 1440 220" preserveAspectRatio="none">
        <path
          d="M0 120 C200 60 380 90 560 110 C760 132 900 70 1100 80 C1260 88 1360 110 1440 100 V220 H0 Z"
          fill="#231a55"
        />
        <path
          d="M0 160 C220 120 420 170 640 150 C860 130 1060 180 1240 150 C1340 134 1400 140 1440 150 V220 H0 Z"
          fill="#190f42"
        />
      </svg>
      <Pine className="p1" />
      <Pine className="p2" />
      <Pine className="p3" />
      <Pine className="p4" />
      <OwlTree />
      <Cat />

      {/* Đom đóm */}
      {Array.from({ length: 14 }, (_, i) => (
        <span
          key={i}
          className="firefly"
          style={{
            left: ((i * 29) % 90) + 3 + "%",
            top: 45 + ((i * 17) % 42) + "%",
            animationDelay: (i % 6) * 0.9 + "s",
            animationDuration: 6 + (i % 4) * 1.5 + "s",
          }}
        />
      ))}

      {/* Hoa xoay chậm, cánh hoa và lá rơi (không hiện ở màn hình chơi cho đỡ rối) */}
      {showFlowers && (
        <>
          <svg className="fl f1" viewBox="0 0 100 100">
            <use href="#flower" />
          </svg>
          <svg className="fl f2" viewBox="0 0 100 100">
            <use href="#flower" />
          </svg>
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
        </>
      )}
    </div>
  );
}

/* ---------- Khung nền chung ---------- */
const DECO = [
  { t: "x", x: "6%", y: "10%", s: "70px", d: "0s" },
  { t: "o", x: "85%", y: "14%", s: "90px", d: "1.2s" },
  { t: "o", x: "12%", y: "60%", s: "80px", d: "2.4s" },
  { t: "x", x: "80%", y: "62%", s: "100px", d: "0.6s" },
];

function Shell({ children, mode = "home" }) {
  return (
    <div className={"app scene-" + mode}>
      <NightScene mode={mode} />
      {mode !== "game" && (
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
      )}
      <main className="content">{children}</main>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState("home"); // home | waiting | playing
  const [name, setName] = useState("");
    const [avatar, setAvatar] = useState(() => {
    try {
      return localStorage.getItem("xo-avatar") || "🦊";
    } catch {
      return "🦊";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("xo-avatar", avatar);
    } catch {
      /* bỏ qua nếu trình duyệt chặn */
    }
  }, [avatar]);
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
        socket.emit("createRoom", { name: name.trim(), avatar }, ({ roomId, mark }) => {
      setRoomId(roomId);
      setMyMark(mark);
      setScreen("waiting");
    });
  };

  const joinRoom = () => {
    if (!name.trim()) return alert("Nhập tên trước nhé");
    socket.emit(
      "joinRoom",
            { roomId: roomInput.trim().toUpperCase(), name: name.trim(), avatar },
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
      <Shell mode="home">
        <div className="card">
          <div className="mascots">
            <span className="m1">{avatar}</span>
            <span className="m-vs">VS</span>
            <span className="m2">🐧</span>
          </div>
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
                    <AvatarPicker value={avatar} onChange={setAvatar} />
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
      <Shell mode="wait">
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
              <div className={"wait-avatar " + myMark}>{avatar}</div>
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
    );

  /* ---------- Màn hình chơi ---------- */
  const winSet = new Set(winLine.map(([r, c]) => r + "-" + c));
  const status = result
    ? ""
    : turn === myMark
    ? "✨ Đến lượt bạn!"
    : "Đối thủ đang suy nghĩ...";
  const timerClass = timeLeft <= 5 ? "danger" : timeLeft <= 10 ? "warn" : "";

  return (
    <Shell mode="game">
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
              {["X", "O"].map((m, idx) => {
                const p = players.find((pl) => pl.mark === m);
                return (
                  <Fragment key={m}>
                    {idx === 1 && <div className="vs-badge">VS</div>}
                    <div
                      className={"player " + m + (turn === m && !result ? " active" : "")}
                    >
                      <Avatar mark={m} emoji={p?.avatar} />
                      <div className="p-info">
                        <b>{p?.name || "..."}</b>
                        <div className="p-mark">
                          quân {m}
                          {m === myMark && " (Bạn)"}
                        </div>
                      </div>
                      <div className="score">{scores[m]}</div>
                    </div>
                  </Fragment>
                );
              })}
            </div>

            <p className={"status " + (!result && turn === myMark ? "mine" : "")}>{status}</p>

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