import type { Profile } from "../../shared/api/portfolioApi";

type HomeViewProps = {
  profile: Profile;
  openProjects: () => void;
};

export function HomeView({ profile, openProjects }: HomeViewProps) {
  return (
    <section className="view active">
      <div className="hero">
        <h1>Hi, I&apos;m {profile.name}.</h1>
        <p>{profile.headline}</p>
        <div className="cta-group">
          <button className="btn-primary" type="button" onClick={openProjects}>
            Explore Work
          </button>
          <a href={`mailto:${profile.email}`} className="btn-secondary">
            Get in Touch
          </a>
        </div>
      </div>
    </section>
  );
}
