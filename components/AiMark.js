// Small marker used wherever the AI does a step.
export default function AiMark({ children = "AI" }) {
  return (
    <span className="ai-mark">
      <span aria-hidden="true">✦</span> {children}
    </span>
  );
}
