import type { Profile } from "../../shared/api/portfolioApi";
import { awsCertifications } from "../../shared/data/portfolioData";

type ResumeViewProps = {
  profile: Profile;
};

export function ResumeView({ profile }: ResumeViewProps) {
  const educationItems = profile.educationHistory ?? [
    {
      ...profile.education,
      details: [
        "4.0 GPA",
        "President's Honour List: Fall 2025, Winter 2025, Summer 2025",
        "Marcus Udokang Computer Science Award (2026)",
      ],
    },
  ];

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
            <h3>Education / Awards</h3>
            {educationItems.map((education) => (
              <div className="resume-item" key={`${education.program}-${education.status}`}>
                <div className="resume-header">
                  <strong>{education.program}</strong>
                  <span className="date">{education.status}</span>
                </div>
                <div className="resume-sub">
                  {education.school} - {education.location}
                </div>
                {education.details && education.details.length > 0 && (
                  <ul className="resume-list">
                    {education.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <div className="resume-section">
            <h3>Certifications</h3>
            <div className="cert-grid">
              {awsCertifications.map((certification) => (
                <a
                  aria-label={certification.name}
                  className="cert-card"
                  href={certification.href}
                  key={certification.name}
                  rel="noreferrer"
                  target="_blank"
                >
                  <img alt="" src={certification.image} />
                  <div className="cert-card-main">
                    <strong>{certification.name}</strong>
                  </div>
                  <span className="date">{certification.issued}</span>
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
                <strong>Customs Specialist</strong>
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
