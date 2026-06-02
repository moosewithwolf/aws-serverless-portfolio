import type { Profile } from "../api/portfolioApi";

export const localModelName = "Gemma 2B IT Q4_K_M";

export const awsCertifications = [
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

export const projectLinks: Record<string, { demo: string; github: string }> = {
  NoraHangul: {
    demo: "https://github.com/moosewithwolf/Nora_Project#readme",
    github: "https://github.com/moosewithwolf/Nora_Project",
  },
  "Cloud Native Backend": {
    demo: "https://shinseong.dev",
    github: "https://github.com/moosewithwolf/aws-serverless-portfolio",
  },
};

export const fallbackProfile: Profile = {
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
