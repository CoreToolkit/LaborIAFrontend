export type ImprovementPlanPriority = "high" | "medium" | "low";
export type ImprovementPlanStatus = "pending" | "in_progress" | "completed";
export type ImprovementPlanRefreshReason =
  | "weekly_schedule"
  | "activity_threshold"
  | "skills_completed"
  | "no_changes_detected"
  | "initial";

export interface ImprovementPlanResource {
  title: string;
  url: string;
  type: string;
}

export interface ImprovementPlanItem {
  id: number;
  skill: string;
  priority: ImprovementPlanPriority;
  current_score: number;
  target_score: number;
  status: ImprovementPlanStatus;
  resources: ImprovementPlanResource[];
  ai_feedback: string | null;
  completed_at: string | null;
}

export interface ImprovementPlan {
  id: number;
  version: number;
  last_updated_at: string;
  items: ImprovementPlanItem[];
}

export interface RefreshImprovementPlanResponse {
  updated: boolean;
  reason: ImprovementPlanRefreshReason;
  plan: ImprovementPlan;
}

export interface ImprovementPlanHistorySnapshot {
  version: number;
  items: ImprovementPlanItem[];
}

export interface ImprovementPlanHistoryEntry {
  id: number;
  version: number;
  trigger: ImprovementPlanRefreshReason;
  snapshot: ImprovementPlanHistorySnapshot;
  created_at: string;
}
