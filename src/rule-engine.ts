/**
 * Task Router Rule Engine
 * Pure routing logic — no Notion SDK dependencies.
 * Suitable for Node.js, tsx, or any TypeScript environment.
 *
 * @example
 * import { routeTask } from "notion-agent-router";
 * const decision = routeTask("summarize the database");
 * console.log(decision.executor); // "Notion Agent"
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskLevel = "safe" | "approval-required";

export type CostLane =
  | "Manual/Approval"
  | "Notion AI"
  | "Worker beta-free"
  | "Hermes";

export type Executor =
  | "Human"
  | "Notion Agent"
  | "Worker"
  | "External Agent";

export interface RouteDecision {
  executor: Executor;
  status: string;
  costLane: CostLane;
  risk: RiskLevel;
  reason: string;
  timestamp: string;
  approvalRequired: boolean;
}

// ---------------------------------------------------------------------------
// Routing Policy — all keyword lists are exported so callers can override
// ---------------------------------------------------------------------------

/**
 * Keywords that require human approval before execution.
 * Covers: credentials, auth, payments, destructive actions, external posts.
 */
export const DEFAULT_HIGH_RISK_KEYWORDS = [
  "credential",
  "password",
  "token",
  "secret",
  "billing",
  "payment",
  "bank",
  "delete",
  "social",
  "post",
  "publish",
  "dm",
  "email send",
  "cron",
  "config",
  "provider",
  "auth",
  "github push",
  "database migration",
] as const;

/**
 * Keywords for Notion-native admin operations.
 * These tasks are well-suited for the Notion AI agent.
 */
export const DEFAULT_NOTION_NATIVE_KEYWORDS = [
  "notion",
  "database",
  "page",
  "summary",
  "summarize",
  "cleanup",
  "classify",
  "dashboard",
  "archive stale",
  "duplicate",
  "content prep",
] as const;

/**
 * Keywords for deterministic, repeatable automation tasks.
 * These run reliably without human judgment.
 */
export const DEFAULT_DETERMINISTIC_KEYWORDS = [
  "sync",
  "webhook",
  "normalize",
  "field update",
  "scheduled",
  "transform",
  "route",
  "worker",
] as const;

/**
 * Keywords for system / cross-stack / Hermes tasks.
 * Covers infrastructure, code, deployment, and security.
 */
export const DEFAULT_HERMES_KEYWORDS = [
  "hermes",
  "terminal",
  "code",
  "github",
  "config",
  "provider",
  "security",
  "api key",
  "deploy",
  "server",
  "cron",
] as const;

/**
 * Full routing policy — caller can omit any field to defer to defaults.
 */
export interface RoutingPolicy {
  highRiskKeywords?: readonly string[];
  notionNativeKeywords?: readonly string[];
  deterministicKeywords?: readonly string[];
  hermesKeywords?: readonly string[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function makeChecker(keywords: readonly string[]) {
  return function (text: string): boolean {
    const lower = text.toLowerCase();
    return (keywords as readonly string[]).some((kw) => lower.includes(kw));
  };
}

// ---------------------------------------------------------------------------
// Check functions — exported for unit-testing individual rules
// ---------------------------------------------------------------------------

export function containsHighRiskKeyword(
  text: string,
  policy?: RoutingPolicy,
): boolean {
  const keywords = policy?.highRiskKeywords ?? DEFAULT_HIGH_RISK_KEYWORDS;
  return makeChecker(keywords)(text);
}

export function isNotionNativeAdmin(text: string, policy?: RoutingPolicy): boolean {
  const keywords = policy?.notionNativeKeywords ?? DEFAULT_NOTION_NATIVE_KEYWORDS;
  return makeChecker(keywords)(text);
}

export function isDeterministicAutomation(
  text: string,
  policy?: RoutingPolicy,
): boolean {
  const keywords = policy?.deterministicKeywords ?? DEFAULT_DETERMINISTIC_KEYWORDS;
  return makeChecker(keywords)(text);
}

export function isHermesSystemTask(text: string, policy?: RoutingPolicy): boolean {
  const keywords = policy?.hermesKeywords ?? DEFAULT_HERMES_KEYWORDS;
  return makeChecker(keywords)(text);
}

// ---------------------------------------------------------------------------
// Main routing function
// ---------------------------------------------------------------------------

export interface RouteInput {
  text: string;
  policy?: RoutingPolicy;
}

/**
 * Route a task based on its text content.
 *
 * Priority order (first match wins):
 *   1. High-risk keywords  → Human approval
 *   2. Notion-native admin → Notion Agent
 *   3. Deterministic automation → Worker
 *   4. Hermes / system     → External Agent
 *   5. Default            → External Agent
 *
 * @returns RouteDecision with executor, status, cost lane, risk, and reason.
 */
export function routeTask(input: string | RouteInput): RouteDecision {
  const text = typeof input === "string" ? input : input.text;
  const policy = typeof input === "object" ? input.policy : undefined;

  const timestamp = new Date().toISOString();

  // Rule 1: High-risk → Human approval
  if (containsHighRiskKeyword(text, policy)) {
    return {
      executor: "Human",
      status: "approval-required",
      costLane: "Manual/Approval",
      risk: "approval-required",
      approvalRequired: true,
      reason:
        "High-risk keyword detected. Requires human approval before execution.",
      timestamp,
    };
  }

  // Rule 2: Notion-native admin → Notion Agent
  if (isNotionNativeAdmin(text, policy)) {
    return {
      executor: "Notion Agent",
      status: "inbox",
      costLane: "Notion AI",
      risk: "safe",
      approvalRequired: false,
      reason:
        "Task is a Notion-native admin operation (database, page, summary, etc.). Routed to Notion Agent.",
      timestamp,
    };
  }

  // Rule 3: Deterministic automation → Worker
  if (isDeterministicAutomation(text, policy)) {
    return {
      executor: "Worker",
      status: "inbox",
      costLane: "Worker beta-free",
      risk: "safe",
      approvalRequired: false,
      reason:
        "Task is deterministic automation (sync, webhook, transform, etc.). Routed to Worker.",
      timestamp,
    };
  }

  // Rule 4: Hermes / system → External Agent
  if (isHermesSystemTask(text, policy)) {
    return {
      executor: "External Agent",
      status: "inbox",
      costLane: "Hermes",
      risk: "safe",
      approvalRequired: false,
      reason:
        "Task is a system/cross-stack operation. Routed to External Agent.",
      timestamp,
    };
  }

  // Default: unexplained → External Agent
  return {
    executor: "External Agent",
    status: "inbox",
    costLane: "Hermes",
    risk: "safe",
    approvalRequired: false,
    reason:
      "No specific category matched. Routed to External Agent as fallback.",
    timestamp,
  };
}

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

export const RULE_ENGINE_VERSION = "1.0.0";