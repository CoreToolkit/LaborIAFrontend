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

export interface TimelinePoint {
  period: string;
  avg_score: number;
  count: number;
}

export interface UserMetricsResponse {
  avg_score: number;
  score_by_skill: Record<string, number>;
  total_interviews: number;
  last_updated: string | null;
}
