/**
 * XML Tool Parser
 *
 * Parses XML-formatted tool calls from LLM text responses.
 * Used for external proxies that don't support native tool_calls.
 *
 * Supported formats:
 * 1. Anthropic-style: <tool_use><name>...</name><parameters>...</parameters></tool_use>
 * 2. Claude XML: <tool_name>...</tool_name> (various tool names)
 * 3. Generic invoke: <invoke name="...">...</invoke>
 * 4. Direct tool tags: <read_file>, <write_file>, <execute_bash>, etc.
 */

import { randomUUID } from "node:crypto";

export interface ParsedToolCall {
  /** Unique ID for this tool call (generated if not in XML) */
  id: string;
  /** Tool name (e.g., "read", "write", "exec", "glob") */
  name: string;
  /** Tool input parameters */
  input: Record<string, unknown>;
  /** Original XML string that was parsed */
  rawXml: string;
  /** Start position in original text */
  startIndex: number;
  /** End position in original text */
  endIndex: number;
}

export interface XmlParseResult {
  /** Parsed tool calls */
  toolCalls: ParsedToolCall[];
  /** Text with tool call XML removed */
  textWithoutTools: string;
  /** Whether any tool calls were found */
  hasToolCalls: boolean;
}

// Tool name mappings from various XML formats to internal tool names
const TOOL_NAME_MAP: Record<string, string> = {
  // File operations
  read_file: "read",
  read: "read",
  file_read: "read",
  write_file: "write",
  write: "write",
  file_write: "write",
  edit_file: "edit",
  edit: "edit",
  file_edit: "edit",

  // Search operations
  glob: "glob",
  find_files: "glob",
  grep: "grep",
  search: "grep",
  search_files: "grep",

  // Execution
  execute_bash: "exec",
  bash: "exec",
  exec: "exec",
  run_command: "exec",
  shell: "exec",
  terminal: "exec",

  // Web operations
  web_fetch: "web_fetch",
  fetch: "web_fetch",
  web_search: "web_search",
  search_web: "web_search",

  // Message operations
  send_message: "message",
  message: "message",
};

/**
 * Normalize tool name from XML to internal format
 */
function normalizeToolName(xmlName: string): string {
  const lower = xmlName.toLowerCase().trim();
  return TOOL_NAME_MAP[lower] ?? lower;
}

/**
 * Parse JSON or simple key=value parameters
 */
function parseParameters(content: string): Record<string, unknown> {
  const trimmed = content.trim();

  // Try JSON first
  if (trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Not valid JSON, continue to other parsing
    }
  }

  // Try XML-style nested parameters
  const params: Record<string, unknown> = {};
  const paramRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
  let match: RegExpExecArray | null;

  while ((match = paramRegex.exec(trimmed)) !== null) {
    const [, key, value] = match;
    // Try to parse value as JSON if it looks like JSON
    let parsedValue: unknown = value.trim();
    const strValue = parsedValue as string;
    if (
      strValue.startsWith("{") ||
      strValue.startsWith("[") ||
      strValue === "true" ||
      strValue === "false" ||
      /^-?\d+(\.\d+)?$/.test(strValue)
    ) {
      try {
        parsedValue = JSON.parse(strValue);
      } catch {
        // Keep as string
      }
    }
    params[key] = parsedValue;
  }

  // If we found params via XML, return them
  if (Object.keys(params).length > 0) {
    return params;
  }

  // Try simple key=value format
  const lines = trimmed.split("\n");
  for (const line of lines) {
    const eqIndex = line.indexOf("=");
    if (eqIndex > 0) {
      const key = line.slice(0, eqIndex).trim();
      let value: unknown = line.slice(eqIndex + 1).trim();
      // Remove quotes if present
      if (
        typeof value === "string" &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")))
      ) {
        value = value.slice(1, -1);
      }
      params[key] = value;
    }
  }

  if (Object.keys(params).length > 0) {
    return params;
  }

  // If nothing else, treat whole content as a single parameter
  // Common for commands like: <execute_bash>ls -la</execute_bash>
  if (trimmed.length > 0) {
    return { command: trimmed };
  }

  return {};
}

/**
 * Parse Anthropic-style tool_use blocks
 * Format: <tool_use><name>tool_name</name><parameters>{...}</parameters></tool_use>
 */
function parseAnthropicStyle(text: string): ParsedToolCall[] {
  const results: ParsedToolCall[] = [];
  const regex = /<tool_use>([\s\S]*?)<\/tool_use>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, content] = match;
    const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(content);
    const paramsMatch = /<parameters>([\s\S]*?)<\/parameters>/i.exec(content);
    const idMatch = /<id>([\s\S]*?)<\/id>/i.exec(content);

    if (nameMatch) {
      results.push({
        id: idMatch?.[1]?.trim() || randomUUID(),
        name: normalizeToolName(nameMatch[1]),
        input: paramsMatch ? parseParameters(paramsMatch[1]) : {},
        rawXml: fullMatch,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
      });
    }
  }

  return results;
}

/**
 * Parse invoke-style blocks
 * Format: <invoke name="tool_name">parameters</invoke>
 */
function parseInvokeStyle(text: string): ParsedToolCall[] {
  const results: ParsedToolCall[] = [];
  const regex = /<invoke\s+name=["'](\w+)["'](?:\s+id=["']([^"']+)["'])?>([\s\S]*?)<\/invoke>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, name, id, content] = match;
    results.push({
      id: id || randomUUID(),
      name: normalizeToolName(name),
      input: parseParameters(content),
      rawXml: fullMatch,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
    });
  }

  return results;
}

/**
 * Parse direct tool tags
 * Format: <tool_name>content</tool_name> or <tool_name param="value">content</tool_name>
 */
function parseDirectToolTags(text: string): ParsedToolCall[] {
  const results: ParsedToolCall[] = [];
  const toolNames = Object.keys(TOOL_NAME_MAP).join("|");
  const regex = new RegExp(
    `<(${toolNames})(?:\\s+([^>]*))?>(\\s*[\\s\\S]*?)\\s*<\\/\\1>`,
    "gi"
  );
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, tagName, attrs, content] = match;

    // Parse attributes if present
    const attrParams: Record<string, unknown> = {};
    if (attrs) {
      const attrRegex = /(\w+)=["']([^"']*)["']/g;
      let attrMatch: RegExpExecArray | null;
      while ((attrMatch = attrRegex.exec(attrs)) !== null) {
        attrParams[attrMatch[1]] = attrMatch[2];
      }
    }

    // Merge with content-based parameters
    const contentParams = parseParameters(content);
    const input = { ...attrParams, ...contentParams };

    // Special handling for exec/bash - use content as command if no command param
    const normalizedName = normalizeToolName(tagName);
    if (normalizedName === "exec" && !input.command && content.trim()) {
      input.command = content.trim();
    }

    // Special handling for read - use content as file_path if no path param
    if (normalizedName === "read" && !input.file_path && !input.path && content.trim()) {
      input.file_path = content.trim();
    }

    results.push({
      id: (attrParams.id as string) || randomUUID(),
      name: normalizedName,
      input,
      rawXml: fullMatch,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
    });
  }

  return results;
}

/**
 * Parse function_call style (OpenAI-like)
 * Format: <function_call><name>...</name><arguments>...</arguments></function_call>
 */
function parseFunctionCallStyle(text: string): ParsedToolCall[] {
  const results: ParsedToolCall[] = [];
  const regex = /<function_call>([\s\S]*?)<\/function_call>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const [fullMatch, content] = match;
    const nameMatch = /<name>([\s\S]*?)<\/name>/i.exec(content);
    const argsMatch = /<arguments>([\s\S]*?)<\/arguments>/i.exec(content);

    if (nameMatch) {
      results.push({
        id: randomUUID(),
        name: normalizeToolName(nameMatch[1]),
        input: argsMatch ? parseParameters(argsMatch[1]) : {},
        rawXml: fullMatch,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
      });
    }
  }

  return results;
}

/**
 * Remove duplicate tool calls (same position)
 */
function deduplicateToolCalls(calls: ParsedToolCall[]): ParsedToolCall[] {
  const seen = new Set<string>();
  return calls.filter((call) => {
    const key = `${call.startIndex}-${call.endIndex}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Parse all XML tool calls from text
 */
export function parseXmlToolCalls(text: string): XmlParseResult {
  // Collect all tool calls from different formats
  const allCalls: ParsedToolCall[] = [
    ...parseAnthropicStyle(text),
    ...parseInvokeStyle(text),
    ...parseFunctionCallStyle(text),
    ...parseDirectToolTags(text),
  ];

  // Sort by position and deduplicate
  allCalls.sort((a, b) => a.startIndex - b.startIndex);
  const toolCalls = deduplicateToolCalls(allCalls);

  // Remove tool call XML from text (from end to start to preserve indices)
  let textWithoutTools = text;
  for (let i = toolCalls.length - 1; i >= 0; i--) {
    const call = toolCalls[i];
    textWithoutTools =
      textWithoutTools.slice(0, call.startIndex) +
      textWithoutTools.slice(call.endIndex);
  }

  // Clean up extra whitespace
  textWithoutTools = textWithoutTools.replace(/\n{3,}/g, "\n\n").trim();

  return {
    toolCalls,
    textWithoutTools,
    hasToolCalls: toolCalls.length > 0,
  };
}

/**
 * Check if text contains any XML tool calls
 */
export function hasXmlToolCalls(text: string): boolean {
  // Quick check patterns before full parsing
  const quickPatterns = [
    /<tool_use>/i,
    /<invoke\s+name=/i,
    /<function_call>/i,
    /<execute_bash>/i,
    /<read_file>/i,
    /<write_file>/i,
    /<edit_file>/i,
    /<glob>/i,
    /<grep>/i,
    /<bash>/i,
  ];

  return quickPatterns.some((pattern) => pattern.test(text));
}

/**
 * Format tool result as XML for sending back to proxy
 */
export function formatToolResultXml(
  toolCallId: string,
  toolName: string,
  result: string | { type: string; text: string }[],
  isError = false
): string {
  const resultText = Array.isArray(result)
    ? result.map((r) => r.text).join("\n")
    : result;

  const escapedResult = resultText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  if (isError) {
    return `<tool_result id="${toolCallId}" name="${toolName}" status="error">
<error>${escapedResult}</error>
</tool_result>`;
  }

  return `<tool_result id="${toolCallId}" name="${toolName}" status="success">
<output>${escapedResult}</output>
</tool_result>`;
}

/**
 * Format multiple tool results as XML block
 */
export function formatToolResultsXml(
  results: Array<{
    id: string;
    name: string;
    result: string | { type: string; text: string }[];
    isError?: boolean;
  }>
): string {
  return results.map((r) => formatToolResultXml(r.id, r.name, r.result, r.isError)).join("\n\n");
}
