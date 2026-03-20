import { RoleRecommendation } from "@/types/matching";

export const MOCK_RECOMMENDATIONS: RoleRecommendation[] = [
  {
    role_id: "1",
    role_name: "Senior Frontend Developer",
    match_score: 92,
    has_match_score: true,
    category: "software-development",
    seniority_level: "Senior",
    description:
      "Buscamos un Senior Frontend Developer con experiencia en React y TypeScript para liderar la modernización de nuestra plataforma.",
    salary_min: 8000000,
    salary_max: 12000000,
    salary_currency: "COP",
    skill_gaps: [
      {
        skill_name: "React",
        importance_weight: 0.5,
      },
      {
        skill_name: "Next.js",
        importance_weight: 0.4,
      },
      {
        skill_name: "System Design",
        importance_weight: 0.3,
      },
    ],
    min_english_level: "Upper Intermediate",
    experience_gap: "Necesitas 2 años adicionales en arquitectura de sistemas",
  },
  {
    role_id: "2",
    role_name: "Full Stack Developer",
    match_score: 87,
    has_match_score: true,
    category: "software-development",
    seniority_level: "Mid",
    description:
      "Posición Full Stack en una startup de FinTech. Trabajarás con React, Node.js y PostgreSQL.",
    salary_min: 6500000,
    salary_max: 9500000,
    salary_currency: "COP",
    skill_gaps: [
      {
        skill_name: "Node.js",
        importance_weight: 0.6,
      },
      {
        skill_name: "PostgreSQL",
        importance_weight: 0.4,
      },
      {
        skill_name: "DevOps",
        importance_weight: 0.2,
      },
    ],
    min_english_level: "Intermediate",
    experience_gap: "Backend te falta experiencia, recomendamos 1 proyecto más",
  },
  {
    role_id: "3",
    role_name: "Product Manager - Tech",
    match_score: 78,
    has_match_score: true,
    category: "product-management",
    seniority_level: "Senior",
    description:
      "Lidera el roadmap de producto de nuestra plataforma SaaS. Requiere visión estratégica y habilidades técnicas.",
    salary_min: 7500000,
    salary_max: 11000000,
    salary_currency: "COP",
    skill_gaps: [
      {
        skill_name: "Product Strategy",
        importance_weight: 0.7,
      },
      {
        skill_name: "Analytics",
        importance_weight: 0.5,
      },
      {
        skill_name: "Agile",
        importance_weight: 0.3,
      },
    ],
    min_english_level: "Advanced",
    experience_gap: "Experiencia en startup scale-up es deseable",
  },
  {
    role_id: "4",
    role_name: "DevOps Engineer",
    match_score: 72,
    has_match_score: true,
    category: "infrastructure",
    seniority_level: "Mid",
    description:
      "Optimiza nuestra infraestructura en AWS. Experiencia con Kubernetes, Docker y CI/CD requerida.",
    salary_min: 7000000,
    salary_max: 9500000,
    salary_currency: "COP",
    skill_gaps: [
      {
        skill_name: "Kubernetes",
        importance_weight: 0.6,
      },
      {
        skill_name: "Terraform",
        importance_weight: 0.4,
      },
      {
        skill_name: "Monitoring",
        importance_weight: 0.3,
      },
    ],
    min_english_level: "Intermediate",
    experience_gap: "Manejo de multicloud podría diversificar tu perfil",
  },
  {
    role_id: "5",
    role_name: "Backend Engineer",
    match_score: 85,
    has_match_score: true,
    category: "software-development",
    seniority_level: "Mid",
    description:
      "Únete a nuestro equipo de Backend especializado en APIs escalables y microservicios.",
    salary_min: 6800000,
    salary_max: 9200000,
    salary_currency: "COP",
    skill_gaps: [
      {
        skill_name: "Microservices",
        importance_weight: 0.5,
      },
      {
        skill_name: "Redis",
        importance_weight: 0.3,
      },
      {
        skill_name: "gRPC",
        importance_weight: 0.2,
      },
    ],
    min_english_level: "Intermediate",
    experience_gap: "3 años más de experiencia en sistemas distribuidos",
  },
];
