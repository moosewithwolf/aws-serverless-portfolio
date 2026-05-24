import { useEffect, useState } from "react";

import { fetchHealth, fetchProfile, type Health, type Profile } from "./api";
import "./styles.css";

type View = "home" | "projects" | "resume" | "ai";

const fallbackProfile: Profile = {
  name: "Shinseong Kim",
  headline: "Full-Stack Developer & Cloud Architect",
  summary:
    "Computer Programming and Analysis student focused on AWS, serverless systems, and practical full-stack engineering.",
  email: "skim570@myseneca.ca",
  projects: [
    {
      name: "NoraHangul",
      tag: "Spring Boot / React / AWS",
      description:
        "Student management system with OAuth2/JWT authentication and automated deployment using Docker and GitHub Actions.",
    },
    {
      name: "Cloud Native Backend",
      tag: "AWS Lambda / SAM",
      description:
        "Serverless portfolio backend using API Gateway, Lambda, CloudFront, S3, and a roadmap for local AI integration.",
    },
  ],
  skills: [
    "Python",
    "JavaScript",
    "TypeScript",
    "React",
    "Spring Boot",
    "AWS",
    "Docker",
    "PostgreSQL",
    "MongoDB",
  ],
  certifications: ["AWS Solutions Architect Associate", "AWS Developer Associate"],
  education: {
    program: "Computer Programming and Analysis",
    school: "Seneca Polytechnic",
    location: "Toronto, ON",
    status: "2024 - Present",
  },
  aiRoadmap: {
    runtime: "llama.cpp",
    status: "planned-v2",
    description:
      "Visitor questions will be relayed through AWS to a local MacBook agent running a small llama.cpp model.",
  },
};

function App() {
  const [activeView, setActiveView] = useState<View>("home");
  const [profile, setProfile] = useState<Profile>(fallbackProfile);
  const [health, setHealth] = useState<Health | null>(null);
  const [apiState, setApiState] = useState<"loading" | "connected" | "offline">("loading");

  useEffect(() => {
    let isMounted = true;

    async function loadApiData() {
      try {
        const [healthResponse, profileResponse] = await Promise.all([
          fetchHealth(),
          fetchProfile(),
        ]);
        if (!isMounted) {
          return;
        }
        setHealth(healthResponse);
        setProfile(profileResponse);
        setApiState("connected");
      } catch {
        if (isMounted) {
          setApiState("offline");
        }
      }
    }

    loadApiData();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <BackgroundWorld />
      <nav aria-label="Portfolio sections">
        <NavButton label="Home" view="home" activeView={activeView} setActiveView={setActiveView} />
        <NavButton
          label="Projects"
          view="projects"
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <NavButton
          label="Resume"
          view="resume"
          activeView={activeView}
          setActiveView={setActiveView}
        />
        <NavButton
          label="AI Roadmap"
          view="ai"
          activeView={activeView}
          setActiveView={setActiveView}
        />
      </nav>

      <main>
        <ApiStatus apiState={apiState} health={health} />
        {activeView === "home" && <HomeView profile={profile} openProjects={() => setActiveView("projects")} />}
        {activeView === "projects" && <ProjectsView projects={profile.projects} />}
        {activeView === "resume" && <ResumeView profile={profile} />}
        {activeView === "ai" && <AiRoadmapView profile={profile} apiState={apiState} />}
      </main>
    </>
  );
}

type NavButtonProps = {
  label: string;
  view: View;
  activeView: View;
  setActiveView: (view: View) => void;
};

function NavButton({ label, view, activeView, setActiveView }: NavButtonProps) {
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

function ApiStatus({ apiState, health }: { apiState: string; health: Health | null }) {
  const label =
    apiState === "connected" ? "API connected" : apiState === "offline" ? "API offline" : "API loading";

  return (
    <div className={`api-status ${apiState}`} aria-live="polite">
      <span>{label}</span>
      {health ? <small>{health.service}</small> : <small>portfolio-api</small>}
    </div>
  );
}

function HomeView({ profile, openProjects }: { profile: Profile; openProjects: () => void }) {
  return (
    <section className="view active">
      <div className="hero">
        <h1>{profile.name}.</h1>
        <p>{profile.headline} specializing in high-performance serverless systems and intuitive digital experiences.</p>
        <div className="cta-group">
          <button className="btn-primary" type="button" onClick={openProjects}>
            Explore Work
          </button>
          <a href={`mailto:${profile.email}`} className="btn-secondary">
            Get in Touch
          </a>
        </div>
        <div className="hero-badges" aria-label="Credentials">
          {profile.certifications.map((certification) => (
            <span className="skill-tag" key={certification}>
              {certification}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectsView({ projects }: { projects: Profile["projects"] }) {
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
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ResumeView({ profile }: { profile: Profile }) {
  return (
    <section className="view active">
      <div className="resume-card">
        <div className="resume-section">
          <h3>Technical Skills</h3>
          <div className="skills-tag-group">
            {profile.skills.map((skill) => (
              <span className="skill-tag" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        </div>

        <div className="resume-section">
          <h3>Education & Certifications</h3>
          <div className="resume-item">
            <div className="resume-header">
              <strong>{profile.education.program}</strong>
              <span className="date">{profile.education.status}</span>
            </div>
            <div className="resume-sub">
              {profile.education.school} - {profile.education.location}
            </div>
            <p className="highlight-line">4.0 GPA | Marcus Udokang Computer Science Award (2026)</p>
          </div>
          <div className="cert-grid">
            {profile.certifications.map((certification) => (
              <div className="skill-tag cert-card" key={certification}>
                {certification}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AiRoadmapView({ profile, apiState }: { profile: Profile; apiState: string }) {
  return (
    <section className="view active">
      <div className="resume-card roadmap-card">
        <div className="section-header">
          <h2>Local AI Roadmap</h2>
          <p>{profile.aiRoadmap.description}</p>
        </div>
        <div className="roadmap-grid">
          <div>
            <span className="tag">Runtime</span>
            <h3>{profile.aiRoadmap.runtime}</h3>
            <p>Small local models will run on the MacBook, with AWS relaying visitor requests in v2.</p>
          </div>
          <div>
            <span className="tag">Status</span>
            <h3>{profile.aiRoadmap.status}</h3>
            <p>v1 keeps this as a visible roadmap while the AWS static hosting and API flow are built first.</p>
          </div>
          <div>
            <span className="tag">API</span>
            <h3>{apiState === "connected" ? "Connected" : "Waiting"}</h3>
            <p>The React app already calls the serverless API, ready for future chat endpoints.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function BackgroundWorld() {
  return (
    <div className="background-world" aria-hidden="true">
      <div className="parallax-layer" id="layer1">
        <div className="blob" id="blob1" />
      </div>
      <div className="parallax-layer" id="layer2">
        <div className="blob" id="blob2" />
      </div>
    </div>
  );
}

export default App;
