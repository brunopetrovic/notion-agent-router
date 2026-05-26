# notion-agent-router

**Route Notion tasks to humans, Notion AI, deterministic workers, or external agents by risk, cost, and execution fit.**

`notion-agent-router` is a lightweight, dependency-free TypeScript routing engine. It inspects task text and returns a structured `RouteDecision` — which executor should handle it, at what cost, and with what risk level. No Notion API token required; no SDK dependency. Works in Node.js, Deno, Bun, or the browser.

---

## Install

```sh
npm install notion-agent-router
```

Or with Deno:

```ts
import { routeTask } from "npm:notion-agent-router";
```

---

## Quick Start

```ts
import { routeTask } from "notion-agent-router";

// Simple usage
const decision = routeTask("summarize the database");
console.log(decision);
// { executor: "Notion Agent", status: "inbox", costLane: "Notion AI", risk: "safe", ... }
```

---

## TypeScript API

### Types

```ts
type Executor   = "Human" | "Notion Agent" | "Worker" | "External Agent";
type RiskLevel  = "safe" | "approval-required";
type CostLane   = "Manual/Approval" | "Notion AI" | "Worker beta-free" | "Hermes";

interface RouteDecision {
  executor: Executor;
  status: string;
  costLane: CostLane;
  risk: RiskLevel;
  reason: string;
  timestamp: string;
  approvalRequired: boolean;
}

// Optional routing policy — override any keyword list
interface RoutingPolicy {
  highRiskKeywords?:     readonly string[];
  notionNativeKeywords?: readonly string[];
  deterministicKeywords?: readonly string[];
  hermesKeywords?:        readonly string[];
}
```

### `routeTask(input)`

```ts
// String shorthand
routeTask("summarize the database");

// Object form (allows passing a custom policy)
routeTask({
  text: "deploy to production",
  policy: { highRiskKeywords: ["deploy", "production"] },
});
```

### Individual rule functions

```ts
import {
  containsHighRiskKeyword,
  isNotionNativeAdmin,
  isDeterministicAutomation,
  isHermesSystemTask,
} from "notion-agent-router";

containsHighRiskKeyword("reset credentials"); // true
isNotionNativeAdmin("summarize the database"); // true
isDeterministicAutomation("sync CRM to Notion"); // true
isHermesSystemTask("github pull request review"); // true
```

### Exported defaults

All keyword arrays are exported as `readonly string[]` for inspection or replacement:

```ts
import {
  DEFAULT_HIGH_RISK_KEYWORDS,
  DEFAULT_NOTION_NATIVE_KEYWORDS,
  DEFAULT_DETERMINISTIC_KEYWORDS,
  DEFAULT_HERMES_KEYWORDS,
} from "notion-agent-router";
```

---

## Routing Rules

Priority order (first match wins):

| Priority | Category | Executor | Cost Lane | Risk |
|---|---|---|---|---|
| 1 | High-risk keyword (credentials, payment, delete, social post, etc.) | `Human` | `Manual/Approval` | `approval-required` |
| 2 | Notion-native admin (database, page, summary, cleanup, classify, etc.) | `Notion Agent` | `Notion AI` | `safe` |
| 3 | Deterministic automation (sync, webhook, transform, scheduled, etc.) | `Worker` | `Worker beta-free` | `safe` |
| 4 | Hermes / system (code, github, config, api key, deploy, cron, etc.) | `External Agent` | `Hermes` | `safe` |
| 5 | Default fallback | `External Agent` | `Hermes` | `safe` |

---

## CLI

```sh
npx notion-agent-router route "summarize the database"
npx notion-agent-router route "delete all records" --json
```

Sample output:
```
Executor:          Notion Agent
Status:            inbox
Cost Lane:         Notion AI
Risk:              safe
Approval Required: no
Reason:            Task is a Notion-native admin operation (database, page, summary, etc.). Routed to Notion Agent.
Timestamp:         2026-05-26T17:30:00.000Z
```

JSON output (`--json`):
```json
{
  "executor": "Notion Agent",
  "status": "inbox",
  "costLane": "Notion AI",
  "risk": "safe",
  "approvalRequired": false,
  "reason": "Task is a Notion-native admin operation ...",
  "timestamp": "2026-05-26T17:30:00.000Z"
}
```

---

## Notion Worker Template

Use the router in a Notion worker to automatically route incoming tasks:

```ts
import { Worker } from "@notionhq/workers";
import { j } from "@notionhq/workers/schema-builder";
import { routeTask } from "notion-agent-router";

const worker = new Worker();
export default worker;

// Route a task: read from Notion, run the rule engine, write back routing fields.
worker.tool("routeTask", {
  title: "Route Task",
  description: "Fetch a task page, run the routing engine, and update routing fields.",
  schema: j.object({
    taskPageId: j.string().describe("Notion page ID of the task to route."),
    dryRun: j.boolean().describe("Return decision without persisting changes.").optional(),
  }),
  execute: async (input, { notion }) => {
    const page = await notion.pages.retrieve({ page_id: input.taskPageId }) as any;
    const props = page.properties as Record<string, any>;

    // Compose routing text from task fields
    const title     = getTitle(props["Task title"] ?? props["title"]);
    const context   = getRichText(props["Context"]);
    const desc      = getRichText(props["Description"]);
    const routingText = [context, desc].filter(Boolean).join(" ").trim() || title;

    // Run the router
    const decision = routeTask(routingText);

    if (input.dryRun) return decision;

    // Persist the routing decision back to Notion fields...
    // (Executor, Status, Cost Lane, Risk, Last Run, Result)
    await notion.pages.update({
      page_id: input.taskPageId,
      properties: {
        Executor:         { select: { name: decision.executor } },
        Status:           { select: { name: decision.approvalRequired ? "approval-required/review" : "inbox/pending" } },
        "Cost Lane":      { select: { name: decision.costLane } },
        Risk:             { select: { name: decision.risk } },
        "Approval Required": { checkbox: decision.approvalRequired },
        "Last Run":       { date: { start: decision.timestamp } },
        Result:           { rich_text: [{ text: { content: `[${decision.timestamp}] ${decision.reason}` } }] },
      },
    });

    return decision;
  },
});
```

---

## Custom Routing Policy

Replace any keyword list to tailor routing for your domain:

```ts
import { routeTask, DEFAULT_DETERMINISTIC_KEYWORDS } from "notion-agent-router";

// Add domain-specific automation terms
const decision = routeTask({
  text: "run etl pipeline nightly",
  policy: {
    deterministicKeywords: [...DEFAULT_DETERMINISTIC_KEYWORDS, "etl", "pipeline"],
    // Completely replace notion-native keywords
    notionNativeKeywords: ["notion", "page", "database"],
  },
});
```

---

## Privacy & Safety

**No secrets, no tokens, no personal IDs.** The router is a pure text-classification engine — it never makes Notion API calls, never logs task content, and never stores any data. All keyword lists are configurable and can be replaced with empty arrays to disable categories.

For production use, route high-risk tasks to a human approval workflow (e.g., a Notion database filtered by `Approval Required = true`) before any destructive action is taken.

---

## License

MIT