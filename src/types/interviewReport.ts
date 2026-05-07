export interface ScoreBreakdown {
  correctness: number;
  completeness: number;
  clarity: number;
  examples: number;
}

export interface QuestionEvaluation {
  evaluation_id: string;
  question_text: string;
  category: string;
  difficulty: string;
  score: number;
  feedback: string;
  score_breakdown: ScoreBreakdown;
  topics_covered: string[];
  topics_missing: string[];
}

export interface SessionComparison {
  has_previous: boolean;
  previous_session_id: number | null;
  previous_score: number | null;
  improvement: number | null;
  trend: "improved" | "declined" | "stable" | "first_session";
}

export interface BadgeUnlocked {
  id: number;
  name: string;
  description: string;
  icon: string;
}

export interface UserBadge {
  id: number;
  name: string;
  description: string;
  icon: string;
  condition_type: string;
  condition_value: string;
  is_unlocked: boolean;
  progress: number; // 0.0 – 1.0
}

export interface InterviewReportResponse {
  session_id: number;
  session_score: number | null;
  total_questions: number;
  completed_questions: number;
  evaluations: QuestionEvaluation[];
  comparison: SessionComparison;
  badges_unlocked: BadgeUnlocked[];
  session_created_at: string;
}

export interface InterviewReportSummary {
  session_id: number;
  session_score: number | null;
  session_created_at: string;
  total_questions: number;
  completed_questions: number;
  trend?: string;
}

export type InterviewReportsHistoryResponse = InterviewReportSummary[];

export interface EvaluationHistoryItem {
  evaluation_id: string;
  session_id: number | null;
  question_text: string | null;
  score: number | null;
  feedback: string | null;
  completed_at: string | null;
}

export interface EvaluationHistoryResponse {
  items: EvaluationHistoryItem[];
  total: number;
  limit: number;
  offset: number;
}
