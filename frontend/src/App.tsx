import { useEffect, useState } from "react";

import { fetchHealth, fetchProfile, type Health, type Profile } from "./api";
import { ChatConversation, useChatSession } from "./ChatConversation";
import { GlobalChatWidget } from "./GlobalChatWidget";
import { loadChatConfig, type ChatConfig } from "./chatConfig";
import "./styles.css";

type View = "home" | "projects" | "resume" | "ai-chat";
const views: View[] = ["home", "projects", "resume", "ai-chat"];
const localModelName = "Gemma 2B IT Q4_K_M";
const awsCertifications = [
  {
    name: "AWS Certified Developer Associate",
    issued: "May 2026",
    href: "https://www.credly.com/earner/earned/badge/134705ce-abad-4781-aa66-7024675ec676",
    image: "https://images.credly.com/images/b9feab85-1a43-4f6c-99a5-631b88d5461b/image.png",
  },
  {
    name: "AWS Certified Solutions Architect Associate",
    issued: "Feb 2026",
    href: "https://www.credly.com/earner/earned/badge/64c563c4-ad51-47b7-ade7-ba18267549c1",
    image: "https://images.credly.com/images/0e284c3f-5164-4b21-8660-0d84737941bc/image.png",
  },
];

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
    "C/C++",
    "Python",
    "Java",
    "Swift",
    "JavaScript",
    "TypeScript",
    "React",
    "Spring Boot",
    "Amazon AWS",
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
  const [activeView, setActiveView] = useState<View>(getViewFromHash);
  const [globalChatOpen, setGlobalChatOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>(fallbackProfile);
  const [health, setHealth] = useState<Health | null>(null);
  const [apiState, setApiState] = useState<"loading" | "connected" | "offline">("loading");
  const [chatConfig, setChatConfig] = useState<ChatConfig>({
    enabled: false,
    message: "Checking chat availability.",
  });

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

  useEffect(() => {
    const handleHashChange = () => {
      setActiveView(getViewFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadChatConfig().then((config) => {
      if (isMounted) {
        setChatConfig(config);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <BackgroundWorld />
      <nav aria-label="Portfolio sections">
        <NavButton label="Home" view="home" activeView={activeView} setActiveView={setActiveViewFromNav} />
        <NavButton
          label="Projects"
          view="projects"
          activeView={activeView}
          setActiveView={setActiveViewFromNav}
        />
        <NavButton
          label="Resume"
          view="resume"
          activeView={activeView}
          setActiveView={setActiveViewFromNav}
        />
        <NavButton
          label="AI Chat"
          view="ai-chat"
          activeView={activeView}
          setActiveView={(view) => {
            setActiveViewFromNav(view);
            setGlobalChatOpen(false);
          }}
        />
      </nav>

      <main>
        <ApiStatus apiState={apiState} health={health} />
        {activeView === "home" && <HomeView profile={profile} openProjects={() => setActiveView("projects")} />}
        {activeView === "projects" && <ProjectsView projects={profile.projects} />}
        {activeView === "resume" && <ResumeView profile={profile} />}
        {activeView === "ai-chat" && <AiChatView chatConfig={chatConfig} />}
      </main>
      <GlobalChatWidget
        chatConfig={chatConfig}
        isOpen={globalChatOpen}
        onOpenChange={setGlobalChatOpen}
      />
    </>
  );

  function setActiveViewFromNav(view: View) {
    setActiveView(view);
    const nextHash = view === "home" ? "" : `#${view}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", `${window.location.pathname}${nextHash}`);
    }
  }
}

function getViewFromHash(): View {
  const hash = window.location.hash.replace("#", "");
  return views.includes(hash as View) ? (hash as View) : "home";
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
          {awsCertifications.map((certification) => (
            <a
              className="hero-cert-badge"
              href={certification.href}
              key={certification.name}
              target="_blank"
              rel="noreferrer"
            >
              <img src={certification.image} alt="" />
              <span>{certification.name}</span>
            </a>
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
        <div className="resume-grid">
          <div className="resume-section">
            <h3>Skills</h3>
            <div className="skills-tag-group">
              {profile.skills.map((skill) => (
                <span className="skill-tag" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </div>

          <div className="resume-section">
            <h3>Education</h3>
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
          </div>

          <div className="resume-section">
            <h3>Certifications</h3>
            <div className="cert-grid">
              {awsCertifications.map((certification) => (
                <a
                  className="cert-card"
                  href={certification.href}
                  key={certification.name}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={certification.name}
                >
                  <img src={certification.image} alt="" />
                  <div>
                    <strong>{certification.name}</strong>
                    <span>Issued {certification.issued}</span>
                  </div>
                </a>
              ))}
            </div>
          </div>

          <div className="resume-section">
            <h3>Volunteer Experience</h3>
            <div className="resume-item">
              <div className="resume-header">
                <strong>Executive of CodeXperts</strong>
                <span className="date">May 2025 - Aug 2025</span>
              </div>
              <div className="resume-sub">Official coding club at Seneca Student Federation</div>
              <ul className="resume-list">
                <li>Supported club operations and organized group study sessions.</li>
                <li>Helped peers learn and solve programming problems together.</li>
              </ul>
            </div>
          </div>

          <div className="resume-section">
            <h3>Work Experience</h3>
            <div className="resume-item">
              <div className="resume-header">
                <strong>Housekeeping Supervisor</strong>
                <span className="date">May 2019 - May 2022</span>
              </div>
              <div className="resume-sub">Rundle Mountain Lodge - Canmore, AB</div>
              <ul className="resume-list">
                <li>Team Leadership: Led staff, assigned tasks, and supported team communication.</li>
                <li>Conflict Resolution: Resolved guest issues and communicated between staff and management.</li>
              </ul>
            </div>

            <div className="resume-item">
              <div className="resume-header">
                <strong>Customs Specialist (Senior Associate)</strong>
                <span className="date">Aug 2015 - Dec 2018</span>
              </div>
              <div className="resume-sub">ISE Commerce - Seoul, Korea</div>
              <ul className="resume-list">
                <li>Import/Export Operations: 3+ years of experience in customs clearance and bonded area management.</li>
                <li>Large-Scale Data Handling: Managed 3M+ annual import cases with 100% compliance and high data accuracy.</li>
                <li>Workflow Optimization: Launched a new export business line and optimized logistics processes for e-commerce.</li>
                <li>Professional Licensure: Certified Bonded Goods Caretaker and Certified Professional Logistician (licensed in Korea).</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AiChatView({ chatConfig }: { chatConfig: ChatConfig }) {
  const session = useChatSession(chatConfig);

  return (
    <section className="view active">
      <div className="ai-chat-page">
        <div className="ai-chat-page-header">
          <h2>AI Chat</h2>
          <span className={`global-chat-status ${chatConfig.enabled ? "online" : "offline"}`}>
            {chatConfig.enabled ? "Online" : "Offline"}
          </span>
        </div>
        <ChatConversation
          chatConfig={chatConfig}
          session={session}
          className="ai-chat-conversation"
          emptyOnlineMessage="Ask about Shinseong's projects, skills, or AWS work."
          modelLabel={
            chatConfig.enabled
              ? `${localModelName} is answering from the local Docker model server.`
              : `${localModelName} will answer when the local agent is online.`
          }
          modelStatus={chatConfig.enabled ? "online" : "offline"}
        />
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
