import type { Profile } from "../api/portfolioApi";

export const localModelName = "Gemma 2B IT Q4_K_M";

export const awsCertifications = [
  {
    name: "AWS Certified Developer Associate",
    issued: "May 2026",
    badgeId: "134705ce-abad-4781-aa66-7024675ec676",
    href: "https://www.credly.com/earner/earned/badge/134705ce-abad-4781-aa66-7024675ec676",
    image: "https://images.credly.com/images/b9feab85-1a43-4f6c-99a5-631b88d5461b/image.png",
  },
  {
    name: "AWS Certified Solutions Architect Associate",
    issued: "Feb 2026",
    badgeId: "64c563c4-ad51-47b7-ade7-ba18267549c1",
    href: "https://www.credly.com/earner/earned/badge/64c563c4-ad51-47b7-ade7-ba18267549c1",
    image: "https://images.credly.com/images/0e284c3f-5164-4b21-8660-0d84737941bc/image.png",
  },
];

export const projectLinks: Record<string, { demo?: string; github?: string }> = {
  "NoraHangul.com": {
    demo: "https://norahangul.com",
    github: "https://github.com/moosewithwolf/student-mangement-app-demo",
  },
  "Shinseong.dev": {
    demo: "https://shinseong.dev",
    github: "https://github.com/moosewithwolf/aws-serverless-portfolio",
  },
  "GS Power Legacy Website": {
    demo: "https://legacy-corporate-portfolio.vercel.app/",
  },
  "Lofi Nest": {
    demo: "https://legacy-music-app-portfolio.vercel.app/",
  },
  "Pixels Legacy Media Website": {
    demo: "https://legacy-media-portfolio.vercel.app/",
  },
};

export const fallbackProfile: Profile = {
  name: "Shinseong Kim",
  headline:
    "A Computer Programming student building full-stack projects with React, AWS serverless, and local LLM AI for hobby.",
  summary:
    "Computer Programming and Analysis student focused on AWS, serverless systems, and practical full-stack engineering.",
  email: "skim570@myseneca.ca",
  projects: [
    {
      name: "NoraHangul.com",
      tag: "Spring Boot / React / Ubuntu Server / Google Oauth 2.0 / On-Premise",
      description:
        "Student management system with OAuth2/JWT authentication and automated deployment using Docker and GitHub Actions.",
    },
    {
      name: "Shinseong.dev",
      tag: "AWS / AWS Lambda / SAM / Route 53 / SQS",
      description:
        "Serverless portfolio backend using API Gateway, Lambda, CloudFront, S3, and a roadmap for local AI integration.",
    },
    {
      name: "GS Power Legacy Website",
      tag: "HTML / CSS / JavaScript / Corporate Website",
      description:
        "Legacy corporate website project built as an earlier portfolio piece.",
    },
    {
      name: "Lofi Nest",
      tag: "HTML / CSS / JavaScript / Music App",
      description:
        "Legacy music app portfolio project built around a lo-fi playlist concept.",
    },
    {
      name: "Pixels Legacy Media Website",
      tag: "HTML / CSS / JavaScript / Media Website",
      description:
        "Legacy media website project built around a movie promotion concept.",
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
