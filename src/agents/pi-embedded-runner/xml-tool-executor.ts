/**
 * XML Tool Executor
 *
 * Executes parsed XML tool calls using the existing tool infrastructure.
 * Maps tool names to actual tool implementations and handles results.
 */

import type { AgentTool, AgentToolResult } from "@mariozechner/pi-agent-core";
import type { ParsedToolCall } from "./xml-tool-parser.js";
import { formatToolResultXml } from "./xml-tool-parser.js";

export interface ToolExecutionResult {
  /** Original tool call */
  toolCall: ParsedToolCall;
  /** Whether execution succeeded */
  success: boolean;
  /** Result content (text or structured) */
  result: string | { type: string; text: string }[];
  /** Error message if failed */
  error?: string;
  /** Execution duration in ms */
  durationMs: number;
}

export interface XmlToolExecutorOptions {
  /** Available tools to execute */
  tools: Map<string, AgentTool>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Callback when tool execution starts */
  onToolStart?: (toolCall: ParsedToolCall) => void;
  /** Callback when tool execution completes */
  onToolEnd?: (result: ToolExecutionResult) => void;
  /** Max concurrent tool executions (default: 1 for sequential) */
  maxConcurrent?: number;
}

/**
 * Map XML tool input parameters to tool-specific parameter names
 */
function mapInputParameters(
  toolName: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const mapped = { ...input };

  switch (toolName) {
    case "read":
      // Map common variations to canonical 'path' parameter
      // The read tool expects 'path' as the canonical parameter name
      if (mapped.file_path && !mapped.path) {
        mapped.path = mapped.file_path;
        delete mapped.file_path;
      }
      if (mapped.filename && !mapped.path) {
        mapped.path = mapped.filename;
        delete mapped.filename;
      }
      break;

    case "write":
      // Map common variations to canonical 'path' parameter
      if (mapped.file_path && !mapped.path) {
        mapped.path = mapped.file_path;
        delete mapped.file_path;
      }
      if (mapped.text && !mapped.content) {
        mapped.content = mapped.text;
        delete mapped.text;
      }
      break;

    case "edit":
      // Map common variations to canonical 'path' parameter
      if (mapped.file_path && !mapped.path) {
        mapped.path = mapped.file_path;
        delete mapped.file_path;
      }
      break;

    case "exec":
      // Command is usually correct, but handle cmd alias
      if (mapped.cmd && !mapped.command) {
        mapped.command = mapped.cmd;
        delete mapped.cmd;
      }
      if (mapped.shell_command && !mapped.command) {
        mapped.command = mapped.shell_command;
        delete mapped.shell_command;
      }
      break;

    case "glob":
      if (mapped.glob && !mapped.pattern) {
        mapped.pattern = mapped.glob;
        delete mapped.glob;
      }
      break;

    case "grep":
      if (mapped.search && !mapped.pattern) {
        mapped.pattern = mapped.search;
        delete mapped.search;
      }
      if (mapped.query && !mapped.pattern) {
        mapped.pattern = mapped.query;
        delete mapped.query;
      }
      break;
  }

  return mapped;
}

/**
 * Execute a single tool call
 */
async function executeSingleTool(
  toolCall: ParsedToolCall,
  tool: AgentTool,
  signal?: AbortSignal
): Promise<ToolExecutionResult> {
  const startTime = Date.now();

  try {
    // Map input parameters to expected format
    const mappedInput = mapInputParameters(toolCall.name, toolCall.input);

    // Execute the tool
    const result: AgentToolResult<unknown> = await tool.execute(
      toolCall.id,
      mappedInput,
      signal
    );

    // Extract text content from result
    let resultContent: string | { type: string; text: string }[];

    if (Array.isArray(result.content)) {
      resultContent = result.content.map((block: unknown) => {
        if (typeof block === "string") {
          return { type: "text", text: block };
        }
        if (typeof block === "object" && block !== null && "type" in block) {
          const typedBlock = block as { type: string; text?: string };
          if (typedBlock.type === "text" && typeof typedBlock.text === "string") {
            return { type: "text", text: typedBlock.text };
          }
        }
        // Handle other block types
        return { type: "text", text: JSON.stringify(block) };
      });
    } else if (typeof result.content === "string") {
      resultContent = result.content;
    } else {
      resultContent = JSON.stringify(result.content);
    }

    return {
      toolCall,
      success: true,
      result: resultContent,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      toolCall,
      success: false,
      result: "",
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Execute multiple tool calls
 */
export async function executeXmlToolCalls(
  toolCalls: ParsedToolCall[],
  options: XmlToolExecutorOptions
): Promise<ToolExecutionResult[]> {
  const { tools, signal, onToolStart, onToolEnd, maxConcurrent = 1 } = options;
  const results: ToolExecutionResult[] = [];

  if (maxConcurrent <= 1) {
    // Sequential execution
    for (const toolCall of toolCalls) {
      if (signal?.aborted) {
        results.push({
          toolCall,
          success: false,
          result: "",
          error: "Execution aborted",
          durationMs: 0,
        });
        continue;
      }

      const tool = tools.get(toolCall.name);
      if (!tool) {
        results.push({
          toolCall,
          success: false,
          result: "",
          error: `Unknown tool: ${toolCall.name}`,
          durationMs: 0,
        });
        continue;
      }

      onToolStart?.(toolCall);
      const result = await executeSingleTool(toolCall, tool, signal);
      onToolEnd?.(result);
      results.push(result);
    }
  } else {
    // Concurrent execution with limit
    const pending: Promise<void>[] = [];
    let index = 0;

    const executeNext = async (): Promise<void> => {
      while (index < toolCalls.length) {
        if (signal?.aborted) break;

        const currentIndex = index++;
        const toolCall = toolCalls[currentIndex];
        const tool = tools.get(toolCall.name);

        if (!tool) {
          results[currentIndex] = {
            toolCall,
            success: false,
            result: "",
            error: `Unknown tool: ${toolCall.name}`,
            durationMs: 0,
          };
          continue;
        }

        onToolStart?.(toolCall);
        const result = await executeSingleTool(toolCall, tool, signal);
        results[currentIndex] = result;
        onToolEnd?.(result);
      }
    };

    // Start concurrent workers
    for (let i = 0; i < Math.min(maxConcurrent, toolCalls.length); i++) {
      pending.push(executeNext());
    }

    await Promise.all(pending);
  }

  return results;
}

/**
 * Format execution results as XML for sending back to LLM
 */
export function formatExecutionResultsXml(
  results: ToolExecutionResult[]
): string {
  return results
    .map((r) =>
      formatToolResultXml(
        r.toolCall.id,
        r.toolCall.name,
        r.success ? r.result : r.error || "Unknown error",
        !r.success
      )
    )
    .join("\n\n");
}

/**
 * Create a tool map from an array of AgentTools
 */
export function createToolMap(
  tools: AgentTool[]
): Map<string, AgentTool> {
  const map = new Map<string, AgentTool>();

  for (const tool of tools) {
    // Add by primary name
    map.set(tool.name, tool);

    // Add common aliases
    switch (tool.name) {
      case "read":
        map.set("read_file", tool);
        map.set("file_read", tool);
        break;
      case "write":
        map.set("write_file", tool);
        map.set("file_write", tool);
        break;
      case "edit":
        map.set("edit_file", tool);
        map.set("file_edit", tool);
        break;
      case "exec":
        map.set("execute_bash", tool);
        map.set("bash", tool);
        map.set("shell", tool);
        map.set("run_command", tool);
        break;
      case "glob":
        map.set("find_files", tool);
        break;
      case "grep":
        map.set("search", tool);
        map.set("search_files", tool);
        break;
      case "web_fetch":
        map.set("fetch", tool);
        break;
      case "web_search":
        map.set("search_web", tool);
        break;
    }
  }

  return map;
}
