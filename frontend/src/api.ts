export type Project = {
  name: string;
  tag: string;
  description: string;
};

export type Profile = {
  name: string;
  headline: string;
  summary: string;
  email: string;
  projects: Project[];
  skills: string[];
  certifications: string[];
  education: {
    program: string;
    school: string;
    location: string;
    status: string;
  };
  aiRoadmap: {
    runtime: string;
    status: string;
    description: string;
  };
};

export type Health = {
  status: string;
  service: string;
};

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export async function fetchHealth(): Promise<Health> {
  return request<Health>("/health");
}

export async function fetchProfile(): Promise<Profile> {
  return request<Profile>("/profile");
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
