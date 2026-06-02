import type { Profile } from "../../shared/api/portfolioApi";
import { projectLinks } from "../../shared/data/portfolioData";

type ProjectsViewProps = {
  projects: Profile["projects"];
};

export function ProjectsView({ projects }: ProjectsViewProps) {
  return (
    <section className="view active">
      <div className="section-header">
        <h2>Featured Projects</h2>
        <p>Engineering solutions with scalability and security at the core.</p>
      </div>
      <div className="projects-grid">
        {projects.map((project) => (
          <article className="project-card" key={project.name}>
            <div className="project-img">{project.name}</div>
            <div className="project-content">
              <span className="tag">{project.tag}</span>
              <h3>{project.name === "NoraHangul" ? "Student Management System" : project.name}</h3>
              <p>{project.description}</p>
              <div className="project-links" aria-label={`${project.name} links`}>
                <a
                  href={projectLinks[project.name]?.demo ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${project.name} demo`}
                >
                  <span className="project-link-icon">D</span>
                  Demo
                </a>
                <a
                  href={projectLinks[project.name]?.github ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${project.name} GitHub`}
                >
                  <span className="project-link-icon">GH</span>
                  GitHub
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
