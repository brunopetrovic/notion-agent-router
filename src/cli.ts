#!/usr/bin/env node
/**
 * CLI for notion-agent-router
 *
 * Usage:
 *   npx notion-agent-router route "task text"
 *   npx notion-agent-router route "task text" --json
 *   npx notion-agent-router route "delete all records" --json
 */

import { routeTask } from "./index.js";

function printHelp() {
  console.log(`
notion-agent-router - Route Notion tasks by risk, cost, and execution fit.

USAGE
  notion-agent-router route <task-text> [options]

ARGUMENTS
  task-text    The task description to route.

OPTIONS
  --json       Output the full RouteDecision as pretty JSON.
  --help       Show this help message.

EXAMPLES
  # Route a simple task
  notion-agent-router route "summarize the database"

  # Route a high-risk task (output as JSON for scripting)
  notion-agent-router route "reset credentials for prod" --json

  # Route a deterministic automation task
  notion-agent-router route "sync CRM data to Notion"

  # Route with custom policy (via Node API)
  #   node -e "
  #     import { routeTask } from 'notion-agent-router';
  #     console.log(routeTask({ text: 'deploy to prod', policy: { highRiskKeywords: ['deploy'] } }));
  #   "
`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  const command = args[0];

  if (command === "route") {
    const textArg = args[1];
    const jsonFlag = args.includes("--json");

    if (!textArg) {
      console.error("Error: route command requires a task text argument.");
      console.error("Run 'notion-agent-router --help' for usage.");
      process.exit(1);
    }

    const decision = routeTask(textArg);

    if (jsonFlag) {
      console.log(JSON.stringify(decision, null, 2));
    } else {
      console.log(`Executor:         ${decision.executor}`);
      console.log(`Status:           ${decision.status}`);
      console.log(`Cost Lane:        ${decision.costLane}`);
      console.log(`Risk:             ${decision.risk}`);
      console.log(`Approval Required: ${decision.approvalRequired ? "yes" : "no"}`);
      console.log(`Reason:           ${decision.reason}`);
      console.log(`Timestamp:        ${decision.timestamp}`);
    }
  } else {
    console.error(`Unknown command: ${command}`);
    console.error("Run 'notion-agent-router --help' for usage.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});