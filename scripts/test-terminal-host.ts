/**
 * Test script for Terminal Host Isolation
 * Run with: npx tsx scripts/test-terminal-host.ts
 */

import { TerminalHostClient } from "../src/terminal-host/ipc-client.js";
import { selectShell, getDefaultTerminalConfig } from "../src/terminal-host/shell-selector.js";

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

async function testShellSelector() {
  logTest("Shell Selector");

  const config = getDefaultTerminalConfig();
  logInfo(`Default config: mode=${config.mode}, shell=${config.shell}`);

  const shell = selectShell(config);
  logInfo(`Selected shell: ${shell.name} (${shell.cmd})`);

  if (shell.name && shell.cmd) {
    logPass(`Shell selected: ${shell.name}`);
    return true;
  } else {
    logFail("Failed to select shell");
    return false;
  }
}

async function testTerminalHostStartup() {
  logTest("Terminal Host Startup");

  const config = {
    mode: "isolated" as const,
    shell: "auto" as const,
    host: {
      port: 18792,
      maxRestarts: 3,
      timeout: 30000,
    },
  };

  const client = new TerminalHostClient(config);

  try {
    await client.start();
    logPass("Terminal host started successfully");

    if (client.isConnected()) {
      logPass("Client connected to terminal host");
    } else {
      logFail("Client not connected");
      return { success: false, client };
    }

    const status = client.getStatus();
    logInfo(`Status: running=${status.running}, pid=${status.pid}, restarts=${status.restarts}`);

    return { success: true, client };
  } catch (err) {
    logFail(`Failed to start terminal host: ${err}`);
    return { success: false, client };
  }
}

async function testSimpleCommand(client: TerminalHostClient) {
  logTest("Simple Command Execution");

  try {
    // Test echo command - use PowerShell's Write-Output for reliable string output on Windows
    const result = await client.exec({
      command: process.platform === "win32"
        ? 'Write-Output "Hello from Terminal Host"'
        : "echo 'Hello from Terminal Host'",
      timeout: 10000,
    });

    logInfo(`Exit code: ${result.exitCode}`);
    logInfo(`Stdout: ${result.stdout.trim()}`);
    logInfo(`Duration: ${result.duration}ms`);

    // Normalize whitespace for comparison (PowerShell may add extra spaces/newlines)
    const normalizedOutput = result.stdout.replace(/\s+/g, " ").trim();
    if (result.success && normalizedOutput.includes("Hello from Terminal Host")) {
      logPass("Echo command executed successfully");
      return true;
    } else {
      logFail(`Command failed: ${result.error || "Output doesn't match"}`);
      return false;
    }
  } catch (err) {
    logFail(`Exception during execution: ${err}`);
    return false;
  }
}

async function testDirectoryListing(client: TerminalHostClient) {
  logTest("Directory Listing Command");

  try {
    const result = await client.exec({
      command: process.platform === "win32" ? "dir" : "ls -la",
      workdir: process.cwd(),
      timeout: 10000,
    });

    logInfo(`Exit code: ${result.exitCode}`);
    logInfo(`Output lines: ${result.stdout.split("\n").length}`);
    logInfo(`Duration: ${result.duration}ms`);

    if (result.success && result.stdout.length > 0) {
      logPass("Directory listing executed successfully");
      return true;
    } else {
      logFail(`Command failed: ${result.error || "No output"}`);
      return false;
    }
  } catch (err) {
    logFail(`Exception during execution: ${err}`);
    return false;
  }
}

async function testEnvironmentVariables(client: TerminalHostClient) {
  logTest("Environment Variables");

  try {
    const testVar = "TEST_VAR_12345";
    const testValue = "Hello_Terminal_Host";

    const result = await client.exec({
      command: process.platform === "win32"
        ? `Write-Output $env:${testVar}`  // PowerShell syntax
        : `echo $${testVar}`,
      env: { [testVar]: testValue },
      timeout: 10000,
    });

    logInfo(`Exit code: ${result.exitCode}`);
    logInfo(`Stdout: ${result.stdout.trim()}`);

    if (result.success && result.stdout.includes(testValue)) {
      logPass("Environment variable passed correctly");
      return true;
    } else {
      logFail(`Environment variable not found in output`);
      return false;
    }
  } catch (err) {
    logFail(`Exception during execution: ${err}`);
    return false;
  }
}

async function testCommandTimeout(client: TerminalHostClient) {
  logTest("Command Timeout");

  try {
    const result = await client.exec({
      command: process.platform === "win32"
        ? "ping -n 10 127.0.0.1"
        : "sleep 10",
      timeout: 2000, // 2 second timeout
    });

    logInfo(`Timed out: ${result.timedOut}`);
    logInfo(`Duration: ${result.duration}ms`);

    if (result.timedOut) {
      logPass("Command timed out as expected");
      return true;
    } else {
      logFail("Command should have timed out but didn't");
      return false;
    }
  } catch (err) {
    // Timeout might throw an error - check case-insensitively
    if (String(err).toLowerCase().includes("timed out") || String(err).toLowerCase().includes("timeout")) {
      logPass("Command timed out (via exception)");
      return true;
    }
    logFail(`Unexpected exception: ${err}`);
    return false;
  }
}

async function testFailingCommand(client: TerminalHostClient) {
  logTest("Failing Command (non-zero exit)");

  try {
    const result = await client.exec({
      command: process.platform === "win32"
        ? "exit /b 42"
        : "exit 42",
      timeout: 10000,
    });

    logInfo(`Success: ${result.success}`);
    logInfo(`Exit code: ${result.exitCode}`);

    if (!result.success && result.exitCode === 42) {
      logPass("Failing command handled correctly (exit code 42)");
      return true;
    } else {
      logFail(`Expected exit code 42, got ${result.exitCode}`);
      return false;
    }
  } catch (err) {
    logFail(`Exception during execution: ${err}`);
    return false;
  }
}

async function testClientShutdown(client: TerminalHostClient) {
  logTest("Client Shutdown");

  try {
    await client.stop();
    logPass("Client stopped successfully");

    // Give it a moment
    await new Promise((r) => setTimeout(r, 1000));

    if (!client.isConnected()) {
      logPass("Client disconnected");
      return true;
    } else {
      logFail("Client still connected after stop");
      return false;
    }
  } catch (err) {
    logFail(`Exception during shutdown: ${err}`);
    return false;
  }
}

async function runAllTests() {
  log("\n════════════════════════════════════════", COLORS.cyan);
  log("   Terminal Host Isolation Test Suite", COLORS.cyan);
  log("════════════════════════════════════════\n", COLORS.cyan);

  const results: { name: string; passed: boolean }[] = [];

  // Test 1: Shell Selector
  results.push({
    name: "Shell Selector",
    passed: await testShellSelector(),
  });

  // Test 2: Terminal Host Startup
  const startupResult = await testTerminalHostStartup();
  results.push({
    name: "Terminal Host Startup",
    passed: startupResult.success,
  });

  if (!startupResult.success || !startupResult.client) {
    log("\n⚠ Skipping remaining tests (terminal host not running)", COLORS.yellow);
  } else {
    const client = startupResult.client;

    // Test 3: Simple Command
    results.push({
      name: "Simple Command",
      passed: await testSimpleCommand(client),
    });

    // Test 4: Directory Listing
    results.push({
      name: "Directory Listing",
      passed: await testDirectoryListing(client),
    });

    // Test 5: Environment Variables
    results.push({
      name: "Environment Variables",
      passed: await testEnvironmentVariables(client),
    });

    // Test 6: Command Timeout
    results.push({
      name: "Command Timeout",
      passed: await testCommandTimeout(client),
    });

    // Test 7: Failing Command
    results.push({
      name: "Failing Command",
      passed: await testFailingCommand(client),
    });

    // Test 8: Client Shutdown
    results.push({
      name: "Client Shutdown",
      passed: await testClientShutdown(client),
    });
  }

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

  // Exit with appropriate code
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runAllTests().catch((err) => {
  log(`\n❌ Test suite failed: ${err}`, COLORS.red);
  process.exit(1);
});
