import type { Health } from "../../shared/api/portfolioApi";

type ApiStatusProps = {
  apiState: string;
  health: Health | null;
};

export function ApiStatus({ apiState, health }: ApiStatusProps) {
  const label =
    apiState === "connected" ? "API connected" : apiState === "offline" ? "API offline" : "API loading";

  return (
    <div className={`api-status ${apiState}`} aria-live="polite">
      <span>{label}</span>
      {health ? <small>{health.service}</small> : <small>portfolio-api</small>}
    </div>
  );
}
