export interface SkillGap {
  skill_name: string;
  importance_weight: number;
}

export interface RoleRecommendation {
  role_id: string;
  role_name: string;
  match_score: number;
  has_match_score?: boolean;
  demand_score?: number;
  description: string | null;
  category: string;
  seniority_level?: string | null;
  min_english_level?: string | null;
  skill_gaps: SkillGap[];
  experience_gap?: string | null;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
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
