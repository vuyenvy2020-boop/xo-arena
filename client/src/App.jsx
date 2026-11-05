import { useEffect, useState } from "react";
import { socket } from "./socket";
import "./App.css";

const SIZE = 15;
const emptyBoard = () =>
  Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

export default function App() {
  const [screen, setScreen] = useState("home"); // home | waiting | playing
  const [name, setName] = useState("");
  const [roomInput, setRoomInput] = useState("");
  const [roomId, setRoomId] = useState("");
  const [myMark, setMyMark] = useState(null);
  const [board, setBoard] = useState(emptyBoard());
  const [turn, setTurn] = useState("X");
  const [result, setResult] = useState(null);

  useEffect(() => {
    socket.on("gameStart", ({ turn }) => {
      setBoard(emptyBoard());
      setTurn(turn);
      setResult(null);
      setScreen("playing");
    });
    socket.on("moved", ({ row, col, mark, nextTurn }) => {
      setBoard((b) =>
        b.map((r, i) => r.map((c, j) => (i === row && j === col ? mark : c)))
      );
      setTurn(nextTurn);
    });
    socket.on("gameOver", ({ winner }) => setResult(winner));
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

  const createRoom = () => {
    if (!name.trim()) return alert("Nhập tên trước nhé");
    socket.emit("createRoom", { name }, ({ roomId, mark }) => {
      setRoomId(roomId);
      setMyMark(mark);
      setScreen("waiting");
    });
  };

  const joinRoom = () => {
    if (!name.trim()) return alert("Nhập tên trước nhé");
    socket.emit(
      "joinRoom",
      { roomId: roomInput.trim().toUpperCase(), name },
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

  if (screen === "home")
    return (
      <div className="center">
        <h1>X-O Arena</h1>
        <input
          placeholder="Tên của bạn"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button onClick={createRoom}>Tạo phòng</button>
        <hr />
        <input
          placeholder="Nhập mã phòng"
          value={roomInput}
          onChange={(e) => setRoomInput(e.target.value)}
        />
        <button onClick={joinRoom}>Vào phòng</button>
      </div>
    );

  if (screen === "waiting")
    return (
      <div className="center">
        <h2>Mã phòng: {roomId}</h2>
        <p>Gửi mã này cho bạn bè và chờ đối thủ vào...</p>
      </div>
    );

  return (
    <div className="center">
      <p>
        Bạn là <b>{myMark}</b> | Lượt: <b>{turn}</b>{" "}
        {turn === myMark ? "(đến lượt bạn)" : ""}
      </p>
      <div className="board">
        {board.map((row, i) =>
          row.map((cell, j) => (
            <button
              key={i + "-" + j}
              className={"cell " + (cell || "")}
              onClick={() => play(i, j)}
            >
              {cell}
            </button>
          ))
        )}
      </div>
      {result && (
        <div className="popup">
          <h2>
            {result === "draw"
              ? "Hòa!"
              : result === myMark
              ? "Bạn thắng!"
              : "Bạn thua!"}
          </h2>
          <button onClick={() => socket.emit("restart", { roomId })}>
            Chơi lại
          </button>
        </div>
      )}
    </div>
  );
}