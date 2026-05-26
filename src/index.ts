/**
 * notion-agent-router
 *
 * Route Notion tasks to the right executor based on risk, cost, and execution fit.
 *
 * @example
 * import { routeTask, containsHighRiskKeyword } from "notion-agent-router";
 *
 * // Simple route
 * const decision = routeTask("summarize the database");
 * console.log(decision.executor); // "Notion Agent"
 *
 * // With custom policy
 * const decision2 = routeTask({
 *   text: "deploy to production",
 *   policy: { highRiskKeywords: ["deploy", "production"] }
 * });
 * console.log(decision2.executor); // "Human"
 */

export {
  routeTask,
  containsHighRiskKeyword,
  isNotionNativeAdmin,
  isDeterministicAutomation,
  isHermesSystemTask,
  RULE_ENGINE_VERSION,
} from "./rule-engine.js";

export type {
  RouteDecision,
  RouteInput,
  RoutingPolicy,
  RiskLevel,
  CostLane,
  Executor,
} from "./rule-engine.js";