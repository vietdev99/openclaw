/**
 * PATCH: pi-ai validation.ts - Claude Code Parameter Compatibility
 *
 * This patch adds support for Claude Code style parameters (file_path, old_string, new_string)
 * by normalizing them to pi-coding-agent conventions (path, oldText, newText) BEFORE validation.
 *
 * INSTRUCTIONS:
 * Replace the content of: pi-mono/packages/ai/src/utils/validation.ts
 * with this entire file.
 */

import AjvModule from "ajv";
import addFormatsModule from "ajv-formats";

// Handle both default and named exports
const Ajv = (AjvModule as any).default || AjvModule;
const addFormats = (addFormatsModule as any).default || addFormatsModule;

import type { Tool, ToolCall } from "../types.js";

// Detect if we're in a browser extension environment with strict CSP
// Chrome extensions with Manifest V3 don't allow eval/Function constructor
const isBrowserExtension = typeof globalThis !== "undefined" && (globalThis as any).chrome?.runtime?.id !== undefined;

// Create a singleton AJV instance with formats (only if not in browser extension)
// AJV requires 'unsafe-eval' CSP which is not allowed in Manifest V3
let ajv: any = null;
if (!isBrowserExtension) {
	try {
		ajv = new Ajv({
			allErrors: true,
			strict: false,
			coerceTypes: true,
		});
		addFormats(ajv);
	} catch (_e) {
		// AJV initialization failed (likely CSP restriction)
		console.warn("AJV validation disabled due to CSP restrictions");
	}
}

/**
 * Finds a tool by name and validates the tool call arguments against its TypeBox schema
 * @param tools Array of tool definitions
 * @param toolCall The tool call from the LLM
 * @returns The validated arguments
 * @throws Error if tool is not found or validation fails
 */
export function validateToolCall(tools: Tool[], toolCall: ToolCall): any {
	const tool = tools.find((t) => t.name === toolCall.name);
	if (!tool) {
		throw new Error(`Tool "${toolCall.name}" not found`);
	}
	return validateToolArguments(tool, toolCall);
}

/**
 * Normalize Claude Code style parameters to pi-coding-agent conventions.
 * This allows models trained on Claude Code to work without getting stuck in tool-call loops.
 *
 * Mappings:
 *   file_path  → path     (read, write, edit tools)
 *   old_string → oldText  (edit tool)
 *   new_string → newText  (edit tool)
 */
function normalizeClaudeCodeParams(args: Record<string, unknown>): Record<string, unknown> {
	const normalized = { ...args };

	// file_path → path (read, write, edit)
	if ("file_path" in normalized && !("path" in normalized)) {
		normalized.path = normalized.file_path;
		delete normalized.file_path;
	}

	// old_string → oldText (edit)
	if ("old_string" in normalized && !("oldText" in normalized)) {
		normalized.oldText = normalized.old_string;
		delete normalized.old_string;
	}

	// new_string → newText (edit)
	if ("new_string" in normalized && !("newText" in normalized)) {
		normalized.newText = normalized.new_string;
		delete normalized.new_string;
	}

	return normalized;
}

/**
 * Validates tool call arguments against the tool's TypeBox schema
 * @param tool The tool definition with TypeBox schema
 * @param toolCall The tool call from the LLM
 * @returns The validated (and potentially coerced) arguments
 * @throws Error with formatted message if validation fails
 */
export function validateToolArguments(tool: Tool, toolCall: ToolCall): any {
	// Skip validation in browser extension environment (CSP restrictions prevent AJV from working)
	if (!ajv || isBrowserExtension) {
		// Trust the LLM's output without validation
		// Browser extensions can't use AJV due to Manifest V3 CSP restrictions
		// Still normalize Claude Code params for compatibility
		return normalizeClaudeCodeParams(toolCall.arguments as Record<string, unknown>);
	}

	// Compile the schema
	const validate = ajv.compile(tool.parameters);

	// Clone and normalize arguments for Claude Code compatibility
	// This must happen BEFORE validation so file_path/old_string/new_string are accepted
	const args = normalizeClaudeCodeParams(structuredClone(toolCall.arguments) as Record<string, unknown>);

	// Validate the arguments (AJV mutates args in-place for type coercion)
	if (validate(args)) {
		return args;
	}

	// Format validation errors nicely
	const errors =
		validate.errors
			?.map((err: any) => {
				const path = err.instancePath ? err.instancePath.substring(1) : err.params.missingProperty || "root";
				return `  - ${path}: ${err.message}`;
			})
			.join("\n") || "Unknown validation error";

	const errorMessage = `Validation failed for tool "${toolCall.name}":\n${errors}\n\nReceived arguments:\n${JSON.stringify(toolCall.arguments, null, 2)}`;

	throw new Error(errorMessage);
}
