export interface EmployabilityBreakdown {
  interview_score: number;
  profile_completeness: number;
  avg_match_score: number;
}

export interface EmployabilityScoreResponse {
  score: number;
  breakdown: EmployabilityBreakdown;
  last_updated: string | null;
  motivational_message: string | null;
}
