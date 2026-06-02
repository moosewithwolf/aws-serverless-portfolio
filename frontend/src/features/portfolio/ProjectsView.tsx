import { ExternalLink } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { FaGithub } from "react-icons/fa";

import type { Profile } from "../../shared/api/portfolioApi";
import { projectLinks } from "../../shared/data/portfolioData";

type ProjectsViewProps = {
  projects: Profile["projects"];
};

export function ProjectsView({ projects }: ProjectsViewProps) {
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const projectTags = useMemo(
    () =>
      projects.map((project) => ({
        ...project,
        tags: getProjectTags(project.tag),
      })),
    [projects],
  );
  const tagFilters = useMemo(
    () => Array.from(new Set(projectTags.flatMap((project) => project.tags))).sort(),
    [projectTags],
  );
  const visibleProjects = activeTag
    ? projectTags.filter((project) => project.tags.includes(activeTag))
    : projectTags;

  return (
    <section className="view active">
      <div className="section-header">
        <h2>Featured Projects</h2>
        <p>A selection of projects showing what I have built and practiced.</p>
      </div>
      <div className="project-filters" aria-label="Filter projects by tech stack">
        <button
          className={`tag-filter ${activeTag === null ? "active" : ""}`}
          type="button"
          onClick={() => setActiveTag(null)}
        >
          All
        </button>
        {tagFilters.map((tag) => (
          <button
            className={`tag tag-filter ${activeTag === tag ? "active" : ""}`}
            key={tag}
            style={getTagStyle(tag)}
            type="button"
            onClick={() => setActiveTag(tag)}
          >
            #{tag}
          </button>
        ))}
      </div>
      <div className="projects-grid">
        {visibleProjects.map((project) => (
          <article className="project-card" key={project.name} aria-label={project.name}>
            <div className="project-content">
              <h3>{project.name}</h3>
              <p>{project.description}</p>
              <div className="project-meta">
                <div className="project-tags" aria-label={`${project.name} tech stack`}>
                  {project.tags.map((tag) => (
                    <span className="tag" key={tag} style={getTagStyle(tag)}>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="project-links" aria-label={`${project.name} links`}>
                  {projectLinks[project.name]?.demo && (
                    <a
                      href={projectLinks[project.name].demo}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${project.name} demo`}
                    >
                      <ExternalLink className="project-link-icon" aria-hidden="true" size={16} strokeWidth={2.4} />
                      Demo
                    </a>
                  )}
                  {projectLinks[project.name]?.github && (
                    <a
                      href={projectLinks[project.name].github}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${project.name} GitHub`}
                    >
                      <FaGithub className="project-link-icon" aria-hidden="true" size={16} />
                      GitHub
                    </a>
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

const tagPalette = [
  { color: "#0f766e", bg: "rgba(15, 118, 110, 0.12)", border: "rgba(15, 118, 110, 0.22)" },
  { color: "#1d4ed8", bg: "rgba(29, 78, 216, 0.11)", border: "rgba(29, 78, 216, 0.2)" },
  { color: "#7c3aed", bg: "rgba(124, 58, 237, 0.1)", border: "rgba(124, 58, 237, 0.2)" },
  { color: "#b45309", bg: "rgba(180, 83, 9, 0.12)", border: "rgba(180, 83, 9, 0.22)" },
  { color: "#be123c", bg: "rgba(190, 18, 60, 0.1)", border: "rgba(190, 18, 60, 0.2)" },
  { color: "#15803d", bg: "rgba(21, 128, 61, 0.11)", border: "rgba(21, 128, 61, 0.2)" },
];

function getTagStyle(tag: string) {
  const palette = tagPalette[getTagHash(tag) % tagPalette.length];
  return {
    "--tag-color": palette.color,
    "--tag-bg": palette.bg,
    "--tag-border": palette.border,
  } as CSSProperties;
}

function getTagHash(tag: string) {
  return [...tag.toLowerCase()].reduce((hash, character) => hash + character.charCodeAt(0), 0);
}

function getProjectTags(tagText: string) {
  return tagText
    .replaceAll("#", ",")
    .split(/[\/,]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
