export interface IndividualSession {
  id: number;
  user_id: number;
  created_at: string;
  updated_at: string;
}

export interface GeneratedQuestionMeta {
  target_skill: string | null;
  difficulty: string | null;
  skills_used: number;
  experiences_used: number;
  retried_for_uniqueness: boolean;
  source: string;
}

export interface GeneratedQuestion {
  question: string;
  meta: GeneratedQuestionMeta;
}

export interface SavedQuestion {
  id: number;
  interview_session_id: number;
  question_text: string;
  category: string | null;
  difficulty: string | null;
  expected_topics: string[] | null;
}

export type InterviewDifficulty = "junior" | "mid" | "senior" | "adaptive";

export interface IndividualEvaluationResult {
  evaluation_id: string;
  status: string;
  score: number | null;
  feedback: string | null;
  transcription: string | null;
  score_breakdown: {
    correctness: number;
    completeness: number;
    clarity: number;
    examples: number;
  } | null;
}
