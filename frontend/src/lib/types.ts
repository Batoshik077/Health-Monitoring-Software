export type Status = "green" | "yellow" | "red";
export type Severity = "info" | "warning" | "critical";

export interface Vitals {
  hr: number | null;
  spo2: number | null;
  rr: number | null;
  sbp: number | null;
  temp: number | null;
  activity?: number | null;
}

export interface BodySystem {
  title: string;
  status: Status;
  detail: string;
}

export interface Todo {
  kind: "protocol" | "checkin" | "exercise" | "sleep";
  text: string;
  run_id?: string;
  alert_id?: string;
}

export interface Astronaut {
  id: string;
  name: string;
  role: string;
  module: string;
  note?: string | null;
  vitals: Vitals;
  quality_ok: boolean;
  bad_metrics: string[];
  news2: { total: number; parts: Record<string, number>; level: string };
  z: Record<string, number | null>;
  at_rest: boolean;
  readiness: number;
  status: Status;
  dose: { msv: number; pct_limit: number; rate_msv_day: number };
  mission_day: number;
  baseline: Record<string, { mean: number; std: number }>;
  systems: Record<string, BodySystem>;
  sleep: number[];
  last_survey: { mood: number; stress: number; fatigue: number; sleep_quality: number } | null;
  checked_in_today: boolean;
  exercise: { today: number; last_7d: number; plan_per_day: number };
  bone_loss_est_pct: number;
  symptoms: { t: number; kind: string; severity: number; note: string }[];
  todo: Todo[];
}

export interface Module {
  id: string;
  name: string;
  crew: string[];
  co2_mmhg: number;
  co2_avg_1h: number;
  o2_pct: number;
  pressure_kpa: number;
  pressure_rate_per_min: number;
  temp_c: number;
  dose_rate_msv_day: number;
  base_dose_rate: number;
}

export interface Alert {
  id: string;
  group: string;
  rule: string;
  severity: Severity;
  subject_type: "astronaut" | "module";
  subject_id: string;
  subject_name: string;
  message: string;
  created_at: number;
  updated_at: number;
  protocol_id: string | null;
  status: "active" | "acknowledged" | "resolved";
  condition_active: boolean;
  acknowledged_by: string | null;
  resolved_at: number | null;
  resolution: string | null;
  escalated_to: string | null;
  protocol_run_id: string | null;
  history: { t: number; event: string; [k: string]: unknown }[];
  received_at?: number;
  first_received_at?: number;
}

export interface ProtocolRun {
  id: string;
  alert_id: string;
  protocol_id: string;
  title: string;
  explain: string;
  steps: string[];
  steps_done: boolean[];
  call: string;
  success_hint: string;
  recheck_after_s: number;
  escalate_if_not: string;
  status: "in_progress" | "rechecking" | "improved" | "not_improved" | "closed";
  started_at: number;
  recheck_at: number | null;
  finished_at: number | null;
}

export interface LinkStatus {
  up: boolean;
  manual_up: boolean;
  forced_down: boolean;
  profile: string;
  delay_s: number;
  bandwidth_pps: number;
  queue: { p0: number; p1: number; p2: number };
  in_flight: number;
  uplink_in_flight: number;
  delivered: number;
  retransmitted: number;
}

export interface Message {
  id: string;
  text: string;
  to: string;
  sent_at: number;
  eta: number;
  delivered_at: number | null;
}

export interface ActiveScenario {
  uid: number;
  id: string;
  title: string;
  target: string | null;
  elapsed_s: number;
  recovering: boolean;
}

export interface OnboardSnapshot {
  type: "snapshot";
  side: "onboard";
  t: number;
  time: string;
  speed: number;
  mission: string;
  crew: Astronaut[];
  modules: Module[];
  alerts: Alert[];
  protocol_runs: ProtocolRun[];
  link: LinkStatus;
  messages: Message[];
  scenarios: ActiveScenario[];
}

export interface GroundCrew {
  id: string;
  name?: string;
  role?: string;
  module?: string;
  vitals?: Vitals;
  news2?: number;
  readiness?: number;
  status?: Status;
  dose_msv?: number;
  sample_t: number;
  age_s: number;
}

export interface GroundSnapshot {
  type: "snapshot";
  side: "ground";
  t: number;
  time: string;
  speed: number;
  mission: string;
  crew: GroundCrew[];
  modules: { module: string; name: string; sample_t: number; age_s: number; env: Partial<Module> }[];
  alerts: Alert[];
  protocol_runs: ProtocolRun[];
  link: LinkStatus;
  messages_sent: Message[];
}

export interface HistoryPoint {
  t: number;
  hr: number | null;
  spo2: number | null;
  rr: number | null;
  sbp: number | null;
  temp: number | null;
  news2: number;
  readiness: number;
}
