import type { View } from "../navigation";

type NavButtonProps = {
  label: string;
  view: View;
  activeView: View;
  setActiveView: (view: View) => void;
};

export function NavButton({ label, view, activeView, setActiveView }: NavButtonProps) {
  return (
    <button
      className={`nav-btn ${activeView === view ? "active" : ""}`}
      type="button"
      onClick={() => {
        setActiveView(view);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }}
    >
      {label}
    </button>
  );
}
