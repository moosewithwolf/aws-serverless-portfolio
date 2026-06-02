export type View = "home" | "projects" | "resume" | "ai-chat";

export const views: View[] = ["home", "projects", "resume", "ai-chat"];

export function getViewFromHash(): View {
  const hash = window.location.hash.replace("#", "");
  return views.includes(hash as View) ? (hash as View) : "home";
}
