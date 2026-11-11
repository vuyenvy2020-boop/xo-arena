export const AVATARS = [
  "🦊", "🐧", "🐱", "🐶", "🐼", "🐰",
  "🐸", "🦉", "🐯", "🐨", "🦄", "🐙",
];

export default function AvatarPicker({ value, onChange }) {
  return (
    <section className="picker">
      <div className="picker-head">
        <span className="picker-title">Chọn nhân vật của bạn</span>
        <span className="picker-now">{value}</span>
      </div>
      <div className="picker-grid" role="radiogroup" aria-label="Chọn nhân vật">
        {AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            role="radio"
            aria-checked={value === a}
            className={"pick" + (value === a ? " on" : "")}
            onClick={() => onChange(a)}
          >
            {a}
          </button>
        ))}
      </div>
    </section>
  );
}