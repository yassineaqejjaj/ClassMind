import { getToken, userManager } from "./auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: string[],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const res = await fetch(`/api${path}`, { ...init, headers });
  if (res.status === 401) {
    await userManager.signinRedirect();
    throw new ApiError(401, "Session expirée");
  }
  if (!res.ok) {
    let message = `Erreur ${res.status}`;
    let details: string[] | undefined;
    try {
      const body = await res.json();
      const d = body.detail;
      if (typeof d === "string") message = d;
      else if (d?.message) {
        message = d.message;
        details = d.errors;
      } else if (Array.isArray(d)) message = d.map((e: { msg: string }) => e.msg).join(" ; ");
    } catch {
      /* corps non JSON */
    }
    throw new ApiError(res.status, message, details);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export interface ClassSummary {
  id: number;
  name: string;
  level: string;
  school_year: string;
  n_students: number;
  n_assessments: number;
}
export interface AssessmentRow {
  id: number;
  title: string;
  held_on: string;
  n_students: number;
  n_questions: number;
  overall_rate: number;
}
export interface Distribution {
  level: string;
  pseudonyms: string[];
}
export interface ClassDetail extends ClassSummary {
  students: { id: number; pseudonym: string }[];
  assessments: AssessmentRow[];
  latest: Analysis | null;
  distribution: Distribution[];
}
export interface Competency {
  code: string;
  chapter: string;
  label: string;
  description: string;
  example: string;
  prerequisites: string[];
}
export interface CompStat {
  code: string;
  label: string;
  rate: number;
  level: string;
  n_results: number;
  errors: { tag: string; count: number }[];
}
export interface QuestionStat {
  code: string;
  competency_code: string;
  max_points: number;
  n: number;
  full: number;
  partial: number;
  none: number;
}
export interface ErrorItem {
  tag: string;
  count: number;
  competency_code: string;
  competency_label: string;
  questions: string[];
}
export interface Analysis {
  class_id?: number;
  class_name?: string;
  assessment_id: number;
  title: string;
  held_on: string;
  n_students: number;
  n_questions: number;
  n_missing: number;
  overall_rate: number;
  competencies: CompStat[];
  questions: QuestionStat[];
  error_list: ErrorItem[];
  to_rework: string[];
  groups: { competency_code: string; label: string; pseudonyms: string[] }[];
}
export interface Progress {
  before: { title: string; held_on: string };
  after: { title: string; held_on: string };
  competencies: {
    code: string;
    label: string;
    rate_before: number;
    rate_after: number;
    delta: number;
    trend: string;
  }[];
  common_students: number;
  n_before: number;
  n_after: number;
  disclaimer: string;
  errors: { tag: string; competency_code: string; before: number; after: number }[];
  observations: {
    up: { code: string; label: string; delta: number }[];
    down: { code: string; label: string; delta: number }[];
    stable: string[];
  };
  caveats: string[];
}
export interface HistoryItem {
  at: string;
  kind: string;
  text: string;
}
export interface Question {
  statement: string;
  expression: string | null;
  answer: string;
  explanation: string;
  check?: "verified" | "mismatch" | "unverifiable";
  verified_answer?: string | null;
}
export interface Variant {
  label: string;
  title: string;
  questions: Question[];
}
export interface Exercise {
  id: number;
  competency_code: string;
  competency_label: string;
  difficulty: string;
  exercise_type: string;
  n_questions: number;
  constraints: string;
  status: "draft" | "validated" | "rejected";
  created_at: string;
  variants: Variant[];
  history?: { action: string; at: string }[];
}
export interface Summary {
  summary: string;
  hypotheses: { competency_code: string; hypothesis: string; suggested_action: string }[];
  notice: string;
}
export interface Settings {
  establishment: string;
  monthly_llm_cap_eur: number;
  month_spend_eur: number;
  retention_days: number;
  llm_model_configured: boolean;
}

const json = (b: unknown) => JSON.stringify(b);

export const api = {
  competencies: () => request<Competency[]>("/competencies"),
  dashboard: () =>
    request<{ class_id: number; name: string; n_students: number; latest: Analysis | null }[]>(
      "/dashboard",
    ),
  classes: () => request<ClassSummary[]>("/classes"),
  createClass: (b: { name: string; level: string; school_year: string }) =>
    request<ClassSummary>("/classes", { method: "POST", body: json(b) }),
  classDetail: (id: number) => request<ClassDetail>(`/classes/${id}`),
  deleteClass: (id: number) => request<void>(`/classes/${id}`, { method: "DELETE" }),
  exportClass: (id: number) => request<unknown>(`/classes/${id}/export`),
  generateIds: (id: number, count: number) =>
    request<{ pseudonyms: string[] }>(`/classes/${id}/students/generate`, {
      method: "POST",
      body: json({ count }),
    }),
  addStudents: (id: number, pseudonyms: string[]) =>
    request(`/classes/${id}/students`, { method: "POST", body: json({ pseudonyms }) }),
  importAssessment: (id: number, form: FormData) =>
    request<{ assessment_id: number; results: number; warnings: string[] }>(
      `/classes/${id}/assessments`,
      { method: "POST", body: form },
    ),
  analysis: (id: number) => request<Analysis>(`/assessments/${id}/analysis`),
  summary: (id: number) => request<Summary>(`/assessments/${id}/summary`, { method: "POST" }),
  progress: (cls: number, before: number, after: number) =>
    request<Progress>(`/classes/${cls}/progress?before=${before}&after=${after}`),
  generateExercises: (b: unknown) =>
    request<Exercise>("/exercises/generate", { method: "POST", body: json(b) }),
  history: (cls: number) => request<HistoryItem[]>(`/classes/${cls}/history`),
  rejectExercise: (id: number) => request<Exercise>(`/exercises/${id}/reject`, { method: "POST" }),
  exercises: () => request<Exercise[]>("/exercises"),
  exercise: (id: number) => request<Exercise>(`/exercises/${id}`),
  saveExercise: (id: number, variants: Variant[]) =>
    request<Exercise>(`/exercises/${id}`, { method: "PUT", body: json({ variants }) }),
  validateExercise: (id: number) =>
    request<Exercise>(`/exercises/${id}/validate`, { method: "POST" }),
  settings: () => request<Settings>("/settings"),
  saveSettings: (b: { monthly_llm_cap_eur: number; retention_days: number }) =>
    request("/settings", { method: "PUT", body: json(b) }),
  async downloadPdf(id: number, answers: boolean) {
    const token = await getToken();
    const res = await fetch(`/api/exercises/${id}/pdf?answers=${answers}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new ApiError(res.status, (await res.json()).detail ?? "Export impossible");
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `exercices-${id}.pdf`,
    });
    a.click();
    URL.revokeObjectURL(url);
  },
};
