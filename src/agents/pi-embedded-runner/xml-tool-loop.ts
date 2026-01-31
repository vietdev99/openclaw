/**
 * XML Tool Loop
 *
 * Handles the iterative execution loop for XML-based tool calls:
 * 1. Parse XML tool calls from LLM response
 * 2. Execute tools
 * 3. Format results as XML
 * 4. Send back to LLM
 * 5. Repeat until no more tool calls or max iterations reached
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import {
  parseXmlToolCalls,
  hasXmlToolCalls,
  type ParsedToolCall,
  type XmlParseResult,
} from "./xml-tool-parser.js";
import {
  executeXmlToolCalls,
  formatExecutionResultsXml,
  createToolMap,
  type ToolExecutionResult,
} from "./xml-tool-executor.js";

export interface XmlToolLoopOptions {
  /** Available tools for execution */
  tools: AgentTool[];
  /** Function to send message to LLM and get response */
  sendToLlm: (message: string) => Promise<string>;
  /** Maximum iterations (tool call rounds) */
  maxIterations?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Callback when iteration starts */
  onIterationStart?: (iteration: number, toolCalls: ParsedToolCall[]) => void;
  /** Callback when tool execution completes */
  onToolResult?: (result: ToolExecutionResult) => void;
  /** Callback when iteration completes */
  onIterationEnd?: (iteration: number, response: string) => void;
  /** Max concurrent tool executions per iteration */
  maxConcurrentTools?: number;
}

export interface XmlToolLoopResult {
  /** Final text response (without tool calls) */
  finalResponse: string;
  /** Total number of iterations */
  totalIterations: number;
  /** All tool calls executed */
  allToolCalls: ParsedToolCall[];
  /** All tool results */
  allResults: ToolExecutionResult[];
  /** Whether loop completed normally (vs max iterations or abort) */
  completed: boolean;
  /** Reason for stopping */
  stopReason: "no_more_tools" | "max_iterations" | "aborted" | "error";
  /** Error message if stopped due to error */
  error?: string;
}

/**
 * Build the tool results message to send back to LLM
 */
function buildToolResultsMessage(
  results: ToolExecutionResult[],
  textWithoutTools: string
): string {
  const xmlResults = formatExecutionResultsXml(results);

  // Include any text that was alongside the tool calls
  if (textWithoutTools.trim()) {
    return `I executed the requested tools. Here are the results:

${xmlResults}

Your previous response also included:
${textWithoutTools}

Please continue based on the tool results above.`;
  }

  return `I executed the requested tools. Here are the results:

${xmlResults}

Please continue based on the tool results above.`;
}

/**
 * Run the XML tool execution loop
 */
export async function runXmlToolLoop(
  initialResponse: string,
  options: XmlToolLoopOptions
): Promise<XmlToolLoopResult> {
  const {
    tools,
    sendToLlm,
    maxIterations = 10,
    signal,
    onIterationStart,
    onToolResult,
    onIterationEnd,
    maxConcurrentTools = 1,
  } = options;

  const toolMap = createToolMap(tools);
  const allToolCalls: ParsedToolCall[] = [];
  const allResults: ToolExecutionResult[] = [];

  let currentResponse = initialResponse;
  let iteration = 0;

  try {
    while (iteration < maxIterations) {
      // Check for abort
      if (signal?.aborted) {
        return {
          finalResponse: currentResponse,
          totalIterations: iteration,
          allToolCalls,
          allResults,
          completed: false,
          stopReason: "aborted",
        };
      }

      // Parse tool calls from current response
      const parseResult = parseXmlToolCalls(currentResponse);

      // If no tool calls, we're done
      if (!parseResult.hasToolCalls) {
        return {
          finalResponse: parseResult.textWithoutTools || currentResponse,
          totalIterations: iteration,
          allToolCalls,
          allResults,
          completed: true,
          stopReason: "no_more_tools",
        };
      }

      iteration++;
      onIterationStart?.(iteration, parseResult.toolCalls);

      // Execute tool calls
      const results = await executeXmlToolCalls(parseResult.toolCalls, {
        tools: toolMap,
        signal,
        onToolEnd: onToolResult,
        maxConcurrent: maxConcurrentTools,
      });

      // Collect results
      allToolCalls.push(...parseResult.toolCalls);
      allResults.push(...results);

      // Build message with tool results
      const resultsMessage = buildToolResultsMessage(
        results,
        parseResult.textWithoutTools
      );

      // Send to LLM and get next response
      currentResponse = await sendToLlm(resultsMessage);
      onIterationEnd?.(iteration, currentResponse);
    }

    // Max iterations reached
    const finalParse = parseXmlToolCalls(currentResponse);
    return {
      finalResponse: finalParse.textWithoutTools || currentResponse,
      totalIterations: iteration,
      allToolCalls,
      allResults,
      completed: false,
      stopReason: "max_iterations",
    };
  } catch (err) {
    return {
      finalResponse: currentResponse,
      totalIterations: iteration,
      allToolCalls,
      allResults,
      completed: false,
      stopReason: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Check if a response needs XML tool processing
 */
export function needsXmlToolProcessing(response: string): boolean {
  return hasXmlToolCalls(response);
}

/**
 * Process a single response with XML tool calls (one iteration)
 */
export async function processXmlToolResponse(
  response: string,
  tools: AgentTool[],
  signal?: AbortSignal
): Promise<{
  parseResult: XmlParseResult;
  executionResults: ToolExecutionResult[];
  resultsXml: string;
}> {
  const toolMap = createToolMap(tools);
  const parseResult = parseXmlToolCalls(response);

  if (!parseResult.hasToolCalls) {
    return {
      parseResult,
      executionResults: [],
      resultsXml: "",
    };
  }

  const executionResults = await executeXmlToolCalls(parseResult.toolCalls, {
    tools: toolMap,
    signal,
  });

  const resultsXml = formatExecutionResultsXml(executionResults);

  return {
    parseResult,
    executionResults,
    resultsXml,
  };
}
