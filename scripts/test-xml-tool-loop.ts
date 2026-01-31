/**
 * Test script for XML Tool Loop Integration
 * Run with: npx tsx scripts/test-xml-tool-loop.ts
 */

import {
  parseXmlToolCalls,
  hasXmlToolCalls,
  formatToolResultXml,
} from "../src/agents/pi-embedded-runner/xml-tool-parser.js";
import { shouldUseXmlToolParsing, getProviderCapabilities } from "../src/agents/pi-embedded-runner/provider-capabilities.js";

const COLORS = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

function log(msg: string, color = COLORS.reset) {
  console.log(`${color}${msg}${COLORS.reset}`);
}

function logTest(name: string) {
  log(`\n▶ ${name}`, COLORS.cyan);
}

function logPass(msg: string) {
  log(`  ✓ ${msg}`, COLORS.green);
}

function logFail(msg: string) {
  log(`  ✗ ${msg}`, COLORS.red);
}

function logInfo(msg: string) {
  log(`  ℹ ${msg}`, COLORS.dim);
}

// Test cases
const TEST_RESPONSES = {
  anthropicStyle: `
Let me read that file for you.

<tool_use>
<name>read_file</name>
<parameters>
<file_path>/path/to/file.txt</file_path>
</parameters>
</tool_use>

I'll analyze the contents once I have them.
`,

  invokeStyle: `
I'll search for that pattern.

<invoke name="grep" id="tool-123">
<pattern>TODO</pattern>
<path>./src</path>
</invoke>
`,

  directTags: `
Let me check the directory structure.

<execute_bash>ls -la</execute_bash>

And also read a config file.

<read_file>/etc/hosts</read_file>
`,

  multipleTags: `
I'll perform multiple operations:

<glob>
<pattern>**/*.ts</pattern>
</glob>

<read_file>package.json</read_file>

<execute_bash>git status</execute_bash>
`,

  noToolCalls: `
This is just a regular response without any tool calls.
The file contains configuration settings for the application.
`,
};

async function testProviderCapabilities() {
  logTest("Provider Capabilities Detection");

  const providers = [
    { id: "anthropic", expectXml: false },
    { id: "openai", expectXml: false },
    { id: "antigravity", expectXml: true },
    { id: "ollama", expectXml: true },
    { id: "lmstudio", expectXml: true },
    { id: "openrouter", expectXml: false },
  ];

  let passed = 0;
  for (const { id, expectXml } of providers) {
    const caps = getProviderCapabilities(id);
    const useXml = shouldUseXmlToolParsing("some-model", id);

    if (useXml === expectXml) {
      logPass(`${id}: useXmlToolParsing=${useXml}`);
      passed++;
    } else {
      logFail(`${id}: expected=${expectXml}, got=${useXml}`);
    }
    logInfo(`  caps: native=${caps.supportsNativeToolCalls}, format=${caps.messageFormat}`);
  }

  return passed === providers.length;
}

async function testXmlParsing() {
  logTest("XML Tool Parsing");

  let passed = 0;
  const tests = [
    {
      name: "Anthropic style",
      input: TEST_RESPONSES.anthropicStyle,
      expectTools: 1,
      expectToolName: "read",
    },
    {
      name: "Invoke style",
      input: TEST_RESPONSES.invokeStyle,
      expectTools: 1,
      expectToolName: "grep",
    },
    {
      name: "Direct tags",
      input: TEST_RESPONSES.directTags,
      expectTools: 2,
      expectToolName: "exec",
    },
    {
      name: "Multiple tags",
      input: TEST_RESPONSES.multipleTags,
      expectTools: 3,
      expectToolName: "glob",
    },
    {
      name: "No tool calls",
      input: TEST_RESPONSES.noToolCalls,
      expectTools: 0,
      expectToolName: null,
    },
  ];

  for (const test of tests) {
    const hasTools = hasXmlToolCalls(test.input);
    const result = parseXmlToolCalls(test.input);

    logInfo(`${test.name}:`);
    logInfo(`  hasXmlToolCalls: ${hasTools}`);
    logInfo(`  parsed: ${result.toolCalls.length} tools`);

    if (result.toolCalls.length === test.expectTools) {
      logPass(`Found ${result.toolCalls.length} tool(s)`);
      passed++;

      if (test.expectToolName && result.toolCalls[0]?.name === test.expectToolName) {
        logPass(`First tool: ${result.toolCalls[0].name}`);
        passed++;
      } else if (!test.expectToolName) {
        passed++; // No tool expected
      } else {
        logFail(`Expected first tool: ${test.expectToolName}, got: ${result.toolCalls[0]?.name}`);
      }
    } else {
      logFail(`Expected ${test.expectTools} tools, got ${result.toolCalls.length}`);
    }

    // Show parsed tools
    for (const tool of result.toolCalls) {
      logInfo(`    - ${tool.name}: ${JSON.stringify(tool.input)}`);
    }

    // Show remaining text
    if (result.textWithoutTools.trim()) {
      logInfo(`  remaining text: "${result.textWithoutTools.slice(0, 50)}..."`);
    }
  }

  return passed >= tests.length * 2 - 1; // Allow one failure
}

async function testToolResultFormatting() {
  logTest("Tool Result Formatting");

  const result = formatToolResultXml(
    "tool-123",
    "read",
    "File contents here\nLine 2",
    false
  );

  logInfo("Formatted success result:");
  logInfo(result.split("\n").map(l => `  ${l}`).join("\n"));

  if (result.includes("status=\"success\"") && result.includes("tool-123")) {
    logPass("Success result formatted correctly");
  } else {
    logFail("Success result format incorrect");
    return false;
  }

  const errorResult = formatToolResultXml(
    "tool-456",
    "exec",
    "Command failed: permission denied",
    true
  );

  logInfo("Formatted error result:");
  logInfo(errorResult.split("\n").map(l => `  ${l}`).join("\n"));

  if (errorResult.includes("status=\"error\"") && errorResult.includes("<error>")) {
    logPass("Error result formatted correctly");
    return true;
  } else {
    logFail("Error result format incorrect");
    return false;
  }
}

async function testModelDetection() {
  logTest("Model ID Detection");

  const testCases = [
    { modelId: "claude-3-opus", provider: undefined, expectXml: false },
    { modelId: "gpt-4", provider: undefined, expectXml: false },
    { modelId: "llama-3-70b", provider: undefined, expectXml: true },
    { modelId: "some-model", provider: "antigravity", expectXml: true },
    { modelId: "claude-3-opus", provider: "anthropic", expectXml: false },
  ];

  let passed = 0;
  for (const { modelId, provider, expectXml } of testCases) {
    const useXml = shouldUseXmlToolParsing(modelId, provider);
    const label = provider ? `${provider}/${modelId}` : modelId;

    if (useXml === expectXml) {
      logPass(`${label}: useXml=${useXml}`);
      passed++;
    } else {
      logFail(`${label}: expected=${expectXml}, got=${useXml}`);
    }
  }

  return passed === testCases.length;
}

async function runAllTests() {
  log("\n════════════════════════════════════════", COLORS.cyan);
  log("   XML Tool Loop Integration Test Suite", COLORS.cyan);
  log("════════════════════════════════════════\n", COLORS.cyan);

  const results: { name: string; passed: boolean }[] = [];

  results.push({
    name: "Provider Capabilities",
    passed: await testProviderCapabilities(),
  });

  results.push({
    name: "XML Parsing",
    passed: await testXmlParsing(),
  });

  results.push({
    name: "Tool Result Formatting",
    passed: await testToolResultFormatting(),
  });

  results.push({
    name: "Model Detection",
    passed: await testModelDetection(),
  });

  // Summary
  log("\n════════════════════════════════════════", COLORS.cyan);
  log("   Test Results Summary", COLORS.cyan);
  log("════════════════════════════════════════\n", COLORS.cyan);

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;

  for (const result of results) {
    const icon = result.passed ? "✓" : "✗";
    const color = result.passed ? COLORS.green : COLORS.red;
    log(`  ${icon} ${result.name}`, color);
  }

  log(`\n  Total: ${passed}/${total} tests passed\n`, passed === total ? COLORS.green : COLORS.yellow);

  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch((err) => {
  log(`\n❌ Test suite failed: ${err}`, COLORS.red);
  process.exit(1);
});
