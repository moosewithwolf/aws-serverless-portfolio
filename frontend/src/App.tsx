import { useEffect, useState } from "react";

import { fetchHealth, fetchProfile, type Health, type Profile } from "./api";
import { postChat, pollChat, PollTimeoutError, type ChatResponse } from "./chatApi";
import { loadChatConfig, type ChatConfig } from "./chatConfig";
import "./styles.css";

type View = "home" | "projects" | "resume" | "ai" | "ai-chat";

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
        <NavButton
          label="AI Chat"
          view="ai-chat"
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
        {activeView === "ai-chat" && <AiChatView profile={profile} chatConfig={chatConfig} />}
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

function AiChatView({ profile, chatConfig }: { profile: Profile; chatConfig: ChatConfig }) {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading || !chatConfig.enabled) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const response: ChatResponse = await postChat(trimmed);

      // For synchronous mock backend, the response is already DONE
      if (response.status === "DONE") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response.message ?? "Processing complete." },
        ]);
      } else {
        // Poll for status updates
        let lastMessage = "";
        for await (const update of pollChat(response.requestId)) {
          lastMessage = update.message;
          if (update.status === "DONE") {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: lastMessage || "Processing complete." },
            ]);
            break;
          }
          if (update.status === "ERROR") {
            setError(lastMessage || "Processing failed. Please try again.");
            break;
          }
        }
      }
    } catch (err) {
      if (err instanceof PollTimeoutError) {
        setError("The local agent is offline or timed out. Please start the model container and try again.");
      } else {
        setError("Failed to send message. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <section className="view active">
      <div className="chat-card">
        <div className="section-header">
          <h2>AI Chat</h2>
          <p>Ask about my skills, projects, certifications, or AWS architecture.</p>
        </div>

        <div className="chat-messages" aria-live="polite">
          {messages.length === 0 && (
            <div className="chat-empty">
              <p>
                {chatConfig.enabled
                  ? "No messages yet. Send a message to start the conversation!"
                  : chatConfig.message}
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`chat-bubble ${msg.role}`}
            >
              {msg.role === "user" ? (
                <strong>Me: </strong>
              ) : (
                <strong>AI: </strong>
              )}
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="chat-bubble assistant loading">
              <strong>AI: </strong>
              <span className="typing-indicator">Thinking…</span>
            </div>
          )}
        </div>

        {error && <div className="chat-error" role="alert">{error}</div>}
        {!chatConfig.enabled && messages.length > 0 && (
          <div className="chat-error" role="status">{chatConfig.message}</div>
        )}

        <div className="chat-input-area">
          <textarea
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            disabled={loading || !chatConfig.enabled}
            rows={2}
          />
          <button
            className="chat-send-btn"
            onClick={sendMessage}
            disabled={loading || !input.trim() || !chatConfig.enabled}
            type="button"
          >
            Send
          </button>
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
