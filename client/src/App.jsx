import { useEffect, useState } from "react";
import { socket } from "./socket";
import "./App.css";

const SIZE = 15;
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
  const [lastMove, setLastMove] = useState(null);
  const [winLine, setWinLine] = useState([]);
  const [muted, setMuted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    socket.on("gameStart", ({ players, turn }) => {
      setPlayers(players);
      setBoard(emptyBoard());
      setTurn(turn);
      setResult(null);
      setLastMove(null);
      setWinLine([]);
      setScreen("playing");
      beep(660, 0.12);
    });
    socket.on("moved", ({ row, col, mark, nextTurn }) => {
      setBoard((b) =>
        b.map((r, i) => r.map((c, j) => (i === row && j === col ? mark : c)))
      );
      setTurn(nextTurn);
      setLastMove([row, col]);
      beep(mark === "X" ? 520 : 390, 0.09);
    });
    socket.on("gameOver", ({ winner, line }) => {
      setResult(winner);
      setWinLine(line || []);
    });
    socket.on("opponentLeft", () => {
      alert("Đối thủ đã thoát");
      setScreen("home");
    });
    return () => {
      socket.off("gameStart");
      socket.off("moved");
      socket.off("gameOver");
      socket.off("opponentLeft");
    };
  }, []);

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
        <div className="card">
          <h2 className="title">Phòng của bạn</h2>
          <div className="room-code">{roomId}</div>
          <button className="btn" onClick={copyCode}>
            {copied ? "Đã sao chép!" : "Sao chép mã phòng"}
          </button>
          <p className="tagline">Gửi mã này cho bạn bè và chờ đối thủ vào</p>
          <div className="dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </Shell>
    );

  /* ---------- Màn hình chơi ---------- */
  const winSet = new Set(winLine.map(([r, c]) => r + "-" + c));
  const status = result
    ? ""
    : turn === myMark
    ? "Đến lượt bạn!"
    : "Đối thủ đang suy nghĩ...";

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

        <div className="players">
          {["X", "O"].map((m) => {
            const p = players.find((pl) => pl.mark === m);
            return (
              <div
                key={m}
                className={"player " + m + (turn === m && !result ? " active" : "")}
              >
                <Mark type={m} />
                <div>
                  <b>{p?.name || "..."}</b>
                  {m === myMark && <span className="you"> (Bạn)</span>}
                </div>
              </div>
            );
          })}
        </div>

        <p className="status">{status}</p>

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