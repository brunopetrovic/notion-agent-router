/**
 * Unit tests for notion-agent-router rule engine
 * Run with: npm test  (or: npx vitest)
 */

import { describe, it, expect } from "vitest";
import {
  routeTask,
  containsHighRiskKeyword,
  isNotionNativeAdmin,
  isDeterministicAutomation,
  isHermesSystemTask,
  RULE_ENGINE_VERSION,
} from "../src/rule-engine.js";

// ---------------------------------------------------------------------------
// containsHighRiskKeyword tests
// ---------------------------------------------------------------------------

describe("containsHighRiskKeyword", () => {
  const cases: [string, boolean][] = [
    ["credential in text", true],
    ["PASSWORD reset needed", true],
    ["github push triggered", true],
    ["database migration planned", true],
    // "email send" is the keyword phrase — "email" alone is not high-risk
    ["send me an email", false],
    ["post to twitter", true],
    ["publish the article", true],
    ["billing report", true],
    ["normal task about reports", false],
    ["coding in python", false],
    // "deploy" alone is NOT in HIGH_RISK_KEYWORDS per spec
    ["deploy to prod", false],
    // "api key" is NOT in HIGH_RISK_KEYWORDS per spec (hermes category)
    ["api key rotation", false],
    // "server" is NOT in HIGH_RISK_KEYWORDS per spec (hermes category)
    ["server maintenance", false],
  ];

  cases.forEach(([text, expected]) => {
    it(`'${text}' -> ${expected}`, () => {
      expect(containsHighRiskKeyword(text)).toBe(expected);
    });
  });
});

// ---------------------------------------------------------------------------
// isNotionNativeAdmin tests
// ---------------------------------------------------------------------------

describe("isNotionNativeAdmin", () => {
  const cases: [string, boolean][] = [
    ["create a notion page", true],
    ["summarize the database", true],
    ["clean up old pages", true],
    ["archive stale records", true],
    ["classify tasks by priority", true],
    ["update dashboard", true],
    ["duplicate this page", true],
    ["content prep for blog", true],
    ["fix the bug in code", false],
    ["sync customer data", false],
    ["send email notification", false],
    ["deploy to server", false],
  ];

  cases.forEach(([text, expected]) => {
    it(`'${text}' -> ${expected}`, () => {
      expect(isNotionNativeAdmin(text)).toBe(expected);
    });
  });
});

// ---------------------------------------------------------------------------
// isDeterministicAutomation tests
// ---------------------------------------------------------------------------

describe("isDeterministicAutomation", () => {
  const cases: [string, boolean][] = [
    ["sync CRM to Notion", true],
    ["webhook handler for stripe", true],
    ["normalize field names", true],
    ["scheduled cleanup job", true],
    ["transform JSON to CSV", true],
    ["route tasks to agents", true],
    ["worker process queue", true],
    ["fix the bug in code", false],
    ["create notion page", false],
    ["deploy to production", false],
    ["send email to client", false],
  ];

  cases.forEach(([text, expected]) => {
    it(`'${text}' -> ${expected}`, () => {
      expect(isDeterministicAutomation(text)).toBe(expected);
    });
  });
});

// ---------------------------------------------------------------------------
// isHermesSystemTask tests
// ---------------------------------------------------------------------------

describe("isHermesSystemTask", () => {
  const cases: [string, boolean][] = [
    ["hermes terminal command", true],
    ["check github status", true],
    ["update config file", true],
    ["rotate api key", true],
    ["deploy worker to server", true],
    ["run cron job", true],
    ["security audit needed", true],
    ["provider setup required", true],
    ["create notion page", false],
    ["sync CRM data", false],
  ];

  cases.forEach(([text, expected]) => {
    it(`'${text}' -> ${expected}`, () => {
      expect(isHermesSystemTask(text)).toBe(expected);
    });
  });
});

// ---------------------------------------------------------------------------
// routeTask integration tests
// ---------------------------------------------------------------------------

describe("routeTask", () => {
  // ---- High-risk -> Human approval ----

  describe("high-risk keyword -> Human approval", () => {
    const highRiskCases = [
      "reset credentials for prod",
      "github push with secret token",
      "billing information update required",
      "delete all user records",
      "database migration to new schema",
      "post to social media account",
    ];

    highRiskCases.forEach((text) => {
      it(`'${text}' routes to Human`, () => {
        const decision = routeTask(text);
        expect(decision.executor).toBe("Human");
        expect(decision.risk).toBe("approval-required");
        expect(decision.approvalRequired).toBe(true);
        expect(decision.costLane).toBe("Manual/Approval");
      });
    });
  });

  // ---- Notion-native admin -> Notion Agent ----

  describe("notion-native-admin -> Notion Agent", () => {
    const notionCases = [
      "summarize the database content",
      "archive stale pages in workspace",
      "create new notion page for project",
      "classify tasks by status",
      "duplicate the template page",
      "cleanup old entries in inbox",
      "content prep for weekly report",
    ];

    notionCases.forEach((text) => {
      it(`'${text}' routes to Notion Agent`, () => {
        const decision = routeTask(text);
        expect(decision.executor).toBe("Notion Agent");
        expect(decision.risk).toBe("safe");
        expect(decision.approvalRequired).toBe(false);
        expect(decision.costLane).toBe("Notion AI");
      });
    });
  });

  // ---- Deterministic automation -> Worker ----

  describe("deterministic-automation -> Worker", () => {
    const automationCases = [
      "sync CRM data to sales system",
      "normalize JSON structure across payloads",
      "scheduled daily backup task",
      "transform CSV to JSON",
      "route messages between queues",
      "worker process for email parsing",
    ];

    automationCases.forEach((text) => {
      it(`'${text}' routes to Worker`, () => {
        const decision = routeTask(text);
        expect(decision.executor).toBe("Worker");
        expect(decision.risk).toBe("safe");
        expect(decision.approvalRequired).toBe(false);
        expect(decision.costLane).toBe("Worker beta-free");
      });
    });

    it("'webhook handler for payment events' routes to Human (payment keyword is high-risk)", () => {
      const decision = routeTask("webhook handler for payment events");
      expect(decision.executor).toBe("Human");
      expect(decision.risk).toBe("approval-required");
    });
  });

  // ---- Hermes/system -> External Agent ----

  describe("hermes-system -> External Agent", () => {
    const hermesCases = [
      "hermes terminal command to check logs",
      "github pull request review",
      "rotate api key for production",
    ];

    hermesCases.forEach((text) => {
      it(`'${text}' routes to External Agent`, () => {
        const decision = routeTask(text);
        expect(decision.executor).toBe("External Agent");
        expect(decision.risk).toBe("safe");
        expect(decision.approvalRequired).toBe(false);
      });
    });
  });

  // ---- Default fallback -> External Agent ----

  describe("default fallback -> External Agent", () => {
    const defaultCases = [
      "review quarterly budget",
      "help me with this task",
      "what is the status of project",
      "general inquiry",
    ];

    defaultCases.forEach((text) => {
      it(`'${text}' routes to External Agent by default`, () => {
        const decision = routeTask(text);
        expect(decision.executor).toBe("External Agent");
        expect(decision.risk).toBe("safe");
        expect(decision.approvalRequired).toBe(false);
      });
    });
  });

  it("returns a valid ISO timestamp", () => {
    const decision = routeTask("simple task");
    expect(decision.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("returns a non-empty reason", () => {
    const decision = routeTask("simple task");
    expect(decision.reason.length).toBeGreaterThan(0);
  });

  it("version is exported", () => {
    expect(RULE_ENGINE_VERSION).toBe("1.0.0");
  });
});

// ---------------------------------------------------------------------------
// Priority ordering tests
// ---------------------------------------------------------------------------

describe("routeTask priority ordering", () => {
  it("high-risk keyword takes precedence over notion-native-admin", () => {
    const decision = routeTask("credential stored in notion page");
    expect(decision.executor).toBe("Human");
    expect(decision.risk).toBe("approval-required");
  });

  it("high-risk keyword takes precedence over deterministic automation", () => {
    const decision = routeTask("sync credentials to worker");
    expect(decision.executor).toBe("Human");
  });

  it("high-risk keyword takes precedence over hermes tasks", () => {
    const decision = routeTask("deploy credentials via hermes");
    expect(decision.executor).toBe("Human");
  });

  it("notion-native-admin takes precedence over deterministic automation", () => {
    const decision = routeTask("sync notion pages");
    expect(decision.executor).toBe("Notion Agent");
  });

  it("deterministic automation takes precedence over hermes", () => {
    const decision = routeTask("hermes sync worker route");
    expect(decision.executor).toBe("Worker");
  });
});

// ---------------------------------------------------------------------------
// Custom policy tests
// ---------------------------------------------------------------------------

describe("custom RoutingPolicy", () => {
  it("allows custom high-risk keywords", () => {
    const decision = routeTask({
      text: "deploy to production",
      policy: { highRiskKeywords: ["deploy", "production"] },
    });
    expect(decision.executor).toBe("Human");
    expect(decision.approvalRequired).toBe(true);
  });

  it("allows custom notion-native keywords", () => {
    const decision = routeTask({
      text: "do something custom",
      policy: { notionNativeKeywords: ["custom"] },
    });
    expect(decision.executor).toBe("Notion Agent");
  });

  it("allows empty keyword arrays to disable a category", () => {
    const decision = routeTask({
      text: "hermes terminal command",
      policy: { hermesKeywords: [] },
    });
    // should fall through to default External Agent since hermes keywords list is empty
    expect(decision.executor).toBe("External Agent");
  });

  it("object-form text is identical to string form", () => {
    const strResult = routeTask("summarize the database");
    const objResult = routeTask({ text: "summarize the database" });
    expect(objResult.executor).toBe(strResult.executor);
    expect(objResult.costLane).toBe(strResult.costLane);
  });
});