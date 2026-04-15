export interface SkillGap {
  skill_name: string;
  importance_weight: number;
}

export interface RoleRecommendation {
  role_id: string;
  role_name: string;
  total_score: number;
  category: "tech" | "data" | "design";
  seniority_level: "junior" | "mid" | "senior";
  min_english_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  estimated_salary_min_cop?: number;
  estimated_salary_max_cop?: number;
  skill_gaps?: SkillGap[];
  description?: string | null;
}

export interface RoleSkill {
  role_skill_id?: number;
  technology_id?: number;
  skill_name: string;
  importance_weight?: number;
  is_required?: boolean;
  required_level?: string;
}

export interface RoleTechnology {
  technology_name: string;
  required_level?: string;
}

export interface RoleDetail extends RoleRecommendation {
  long_description?: string;
  required_skills: RoleSkill[];
  required_technologies: RoleTechnology[];
}

export type RoleSortOption = "match-desc" | "salary-desc" | "demand-desc" | "name-asc";
