import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import { ApiStatus } from "./components/ApiStatus";
import { BackgroundWorld } from "./components/BackgroundWorld";
import { NavButton } from "./components/NavButton";
import { getViewFromHash, type View } from "./navigation";
import { AiChatView } from "../features/chat/AiChatView";
import { GlobalChatWidget } from "../features/chat/GlobalChatWidget";
import { loadChatConfig, type ChatConfig } from "../features/chat/chatConfig";
import { fetchHealth, fetchProfile, type Health, type Profile } from "../shared/api/portfolioApi";
import { HomeView } from "../features/portfolio/HomeView";
import { ProjectsView } from "../features/portfolio/ProjectsView";
import { ResumeView } from "../features/portfolio/ResumeView";
import { fallbackProfile } from "../shared/data/portfolioData";
import "./global.css";

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
  const navRef = useRef<HTMLElement | null>(null);
  const [navIndicator, setNavIndicator] = useState({ left: 8, width: 0 });

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
    const handlePopState = () => {
      setActiveView(getViewFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handlePopState);
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

  useLayoutEffect(() => {
    const updateNavIndicator = () => {
      const nav = navRef.current;
      const activeButton = nav?.querySelector<HTMLButtonElement>(`[data-view="${activeView}"]`);

      if (!nav || !activeButton) {
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const buttonRect = activeButton.getBoundingClientRect();
      setNavIndicator({
        left: buttonRect.left - navRect.left,
        width: buttonRect.width,
      });
    };

    updateNavIndicator();
    window.addEventListener("resize", updateNavIndicator);
    return () => {
      window.removeEventListener("resize", updateNavIndicator);
    };
  }, [activeView]);

  return (
    <>
      <BackgroundWorld />
      <nav
        aria-label="Portfolio sections"
        ref={navRef}
        style={{
          "--nav-indicator-left": `${navIndicator.left}px`,
          "--nav-indicator-width": `${navIndicator.width}px`,
        } as CSSProperties}
      >
        <span className="nav-active-indicator" aria-hidden="true" />
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
        {activeView === "home" && <HomeView profile={profile} openProjects={() => setActiveViewFromNav("projects")} />}
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

export default App;
