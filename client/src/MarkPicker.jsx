export default function MarkPicker({ value, onChange }) {
  return (
    <section className="mark-pick">
      <div className="mark-label">
        <span className="mp-title">Chọn quân của bạn</span>
        <span className="mp-note">X đi trước</span>
      </div>
      <div className="mark-btns" role="radiogroup" aria-label="Chọn quân">
        {["X", "O"].map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value === m}
            className={"mark-btn " + m + (value === m ? " on" : "")}
            onClick={() => onChange(m)}
          >
            <svg viewBox="0 0 24 24" className={"mk " + m.toLowerCase()}>
              {m === "X" ? (
                <>
                  <path d="M5 5 L19 19" />
                  <path d="M19 5 L5 19" />
                </>
              ) : (
                <circle cx="12" cy="12" r="7.5" />
              )}
            </svg>
            <b>{m}</b>
          </button>
        ))}
      </div>
    </section>
  );
}