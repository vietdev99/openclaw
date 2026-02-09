#!/usr/bin/env node
/**
 * Script to compact a session using Claude via Google Cloud Code Assist API
 * Usage: node compact-session.cjs <session-file>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Google Cloud Code Assist API
const CLOUD_CODE_ASSIST_URL = 'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse';
const MODEL = 'gemini-2.0-flash';  // Claude not available on Cloud Code Assist, use Gemini

// Load OAuth token and project ID from auth profiles
function loadGoogleAuth() {
  const authPath = 'C:\\Users\\Printway - Win VM 1\\.openclaw\\agents\\main\\agent\\auth-profiles.json';
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
  const profile = auth.profiles['google-antigravity:huongha2245@gmail.com'];
  if (!profile || !profile.access || !profile.projectId) {
    throw new Error('No valid Google OAuth credentials found');
  }
  return {
    token: profile.access,
    projectId: profile.projectId
  };
}

async function callClaude(messages, systemPrompt) {
  const { token, projectId } = loadGoogleAuth();

  return new Promise((resolve, reject) => {
    // Build Cloud Code Assist request format
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const requestBody = {
      project: projectId,
      model: MODEL,
      request: {
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          maxOutputTokens: 4096
        }
      },
      userAgent: 'pi-coding-agent',
      requestId: `compact-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    };

    const data = JSON.stringify(requestBody);

    const url = new URL(CLOUD_CODE_ASSIST_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'google-cloud-sdk vscode_cloudshelleditor/0.1',
        'X-Goog-Api-Client': 'gl-node/22.17.0',
        'Accept': 'text/event-stream',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      let fullText = '';

      res.on('data', chunk => {
        body += chunk;
        // Parse SSE stream
        const lines = body.split('\n');
        body = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const jsonStr = line.slice(5).trim();
          if (!jsonStr) continue;

          try {
            const chunk = JSON.parse(jsonStr);
            const parts = chunk.response?.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.text) {
                fullText += part.text;
              }
            }
          } catch (e) {
            // Skip parse errors in stream
          }
        }
      });

      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API error (${res.statusCode}): ${body.substring(0, 500)}`));
          return;
        }

        if (fullText) {
          resolve({ content: [{ type: 'text', text: fullText }] });
        } else {
          reject(new Error('No response content received'));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function parseSessionFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const entries = [];

  for (const line of lines) {
    try {
      entries.push(JSON.parse(line));
    } catch (e) {
      console.error('Failed to parse line:', line.substring(0, 100));
    }
  }

  return entries;
}

function extractConversation(entries) {
  const messages = [];

  for (const entry of entries) {
    if (entry.type === 'message' && entry.message) {
      const msg = entry.message;
      if (msg.role === 'user' || msg.role === 'assistant') {
        let text = '';
        if (Array.isArray(msg.content)) {
          text = msg.content
            .filter(c => c.type === 'text' && c.text)
            .map(c => c.text)
            .join('\n');
        } else if (typeof msg.content === 'string') {
          text = msg.content;
        }

        // Skip empty, NO_REPLY, HEARTBEAT messages
        const trimmed = text.trim();
        if (trimmed && !trimmed.match(/^(NO_REPLY|HEARTBEAT_OK)$/i)) {
          messages.push({
            role: msg.role,
            content: text.substring(0, 1500), // Limit each message
            timestamp: entry.timestamp
          });
        }
      }
    }
  }

  return messages;
}

async function createSummary(conversation) {
  // Take first 70% of messages for summary
  const cutoff = Math.floor(conversation.length * 0.7);
  const messagesToSummarize = conversation.slice(0, cutoff);

  if (messagesToSummarize.length < 10) {
    console.log('Not enough messages to summarize');
    return null;
  }

  // Limit to avoid context overflow
  const limitedMessages = messagesToSummarize.slice(-100);

  // Format conversation for Claude
  const conversationText = limitedMessages
    .map(m => `[${m.role.toUpperCase()}]: ${m.content}`)
    .join('\n\n');

  const systemPrompt = `You are a conversation summarizer. Create a concise summary of the following conversation that captures:
1. Key topics discussed
2. Important decisions or conclusions
3. User preferences or patterns observed
4. Any ongoing tasks or follow-ups needed

Keep the summary under 500 words. Focus on information that would be useful for future conversations. Write in the same language as the conversation (likely Vietnamese).`;

  const messages = [{
    role: 'user',
    content: `Please summarize this conversation:\n\n${conversationText.substring(0, 50000)}`
  }];

  console.log(`Calling Gemini 2.0 Flash via Google Cloud Code Assist (${limitedMessages.length} messages)...`);
  const response = await callClaude(messages, systemPrompt);

  if (response.content && response.content[0] && response.content[0].text) {
    return response.content[0].text;
  }

  throw new Error('Invalid response from Claude');
}

function createCompactedSession(originalEntries, summary) {
  // Get header entries (session, model_change, etc.)
  const headerEntries = originalEntries.filter(e =>
    e.type === 'session' ||
    e.type === 'model_change' ||
    e.type === 'thinking_level_change' ||
    (e.type === 'custom' && e.customType === 'model-snapshot')
  ).slice(0, 5); // Keep first few config entries

  // Update session header timestamp
  if (headerEntries[0] && headerEntries[0].type === 'session') {
    headerEntries[0].timestamp = new Date().toISOString();
  }

  // Create summary message
  const summaryEntry = {
    type: 'message',
    id: `summary-${Date.now().toString(36)}`,
    parentId: headerEntries[headerEntries.length - 1]?.id || null,
    timestamp: new Date().toISOString(),
    message: {
      role: 'assistant',
      content: [{
        type: 'text',
        text: `[SESSION COMPACTED]\n\nPrevious conversation summary:\n${summary}\n\n[New conversation starts here]`
      }],
      api: 'google-gemini-cli',
      provider: 'google-antigravity',
      model: MODEL,
      usage: { input: 0, output: 0, totalTokens: 0, cacheRead: 0, cacheWrite: 0, cost: { input: 0, output: 0, total: 0 } },
      stopReason: 'stop',
      timestamp: Date.now()
    }
  };

  return [...headerEntries, summaryEntry];
}

async function compactSession(filePath) {
  console.log(`\n=== Compacting: ${path.basename(filePath)} ===`);

  // Parse session
  const entries = parseSessionFile(filePath);
  console.log(`Total entries: ${entries.length}`);

  // Extract conversation
  const conversation = extractConversation(entries);
  console.log(`Messages found: ${conversation.length}`);

  if (conversation.length < 20) {
    console.log('Session too small to compact, skipping');
    return false;
  }

  // Create summary using AI
  const summary = await createSummary(conversation);
  if (!summary) {
    console.log('Failed to create summary');
    return false;
  }

  console.log('\n--- Summary ---');
  console.log(summary.substring(0, 500) + (summary.length > 500 ? '...' : ''));
  console.log('---------------\n');

  // Create compacted session
  const compacted = createCompactedSession(entries, summary);

  // Write new session file
  const newContent = compacted.map(e => JSON.stringify(e)).join('\n') + '\n';
  fs.writeFileSync(filePath, newContent);

  console.log(`Session compacted: ${entries.length} -> ${compacted.length} entries`);
  return true;
}

// Main
async function main() {
  const sessionsDir = 'C:\\Users\\Printway - Win VM 1\\.openclaw\\agents\\main\\sessions';
  const sessionsToCompact = [
    '828e2837-1f29-419c-b4bd-a67e160c4097.jsonl', // 1MB - Feishu Group
  ];

  for (const session of sessionsToCompact) {
    const filePath = path.join(sessionsDir, session);
    if (fs.existsSync(filePath)) {
      try {
        await compactSession(filePath);
      } catch (err) {
        console.error(`Error compacting ${session}:`, err.message);
      }
    } else {
      console.log(`File not found: ${session}`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
