const LEVELS = [
  { id: "easy", label: "Dễ", icon: "🌱", desc: "Thư giãn, máy đi hơi ngẫu nhiên" },
  { id: "normal", label: "Vừa", icon: "⚔️", desc: "Biết chặn và tấn công" },
  { id: "hard", label: "Khó", icon: "🔥", desc: "Máy tính toán kỹ, khó thắng" },
];

export default function AIPlay({ onStart }) {
  return (
    <section className="ai-box">
      <div className="ai-head">
        <span className="ai-title">🤖 Chơi với máy</span>
        <span className="ai-note">vào chơi ngay, không cần chờ</span>
      </div>
      <div className="ai-levels">
        {LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={"ai-btn " + l.id}
            title={l.desc}
            onClick={() => onStart(l.id)}
          >
            <span>{l.icon}</span>
            <b>{l.label}</b>
          </button>
        ))}
      </div>
    </section>
  );
}