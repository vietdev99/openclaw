/**
 * Terminal Runner - PTY-based terminal for interactive processes
 * Used for OAuth authentication flow that requires user interaction
 */

import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';
import log from 'electron-log';

interface TerminalSession {
  id: string;
  pty: pty.IPty;
}

export class TerminalRunner {
  private sessions = new Map<string, TerminalSession>();
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(win: BrowserWindow | null) {
    this.mainWindow = win;
  }

  spawn(id: string, command: string, args: string[], cwd: string): void {
    log.info(`[TerminalRunner] Spawning session ${id}: ${command} ${args.join(' ')}`);

    try {
      // Ensure PATH includes npm/node locations
      const path = require('path');
      const nodePath = path.dirname(process.execPath);
      const envPath = process.env.PATH || '';

      const enhancedEnv = {
        ...process.env,
        PATH: `${nodePath};${envPath}`, // Add node binary path to front
      } as { [key: string]: string };

      log.info(`[TerminalRunner] Node path: ${nodePath}`);
      log.info(`[TerminalRunner] Enhanced PATH: ${enhancedEnv.PATH?.substring(0, 200)}...`);

      // Spawn command directly (caller specifies shell if needed)
      const ptyProcess = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd,
        env: enhancedEnv,
      });

      // Forward output to renderer
      ptyProcess.onData((data) => {
        this.mainWindow?.webContents.send(`terminal:output:${id}`, data);
      });

      // Handle exit
      ptyProcess.onExit(({ exitCode }) => {
        log.info(`[TerminalRunner] Session ${id} exited with code ${exitCode}`);
        this.mainWindow?.webContents.send(`terminal:exit:${id}`, exitCode);
        this.sessions.delete(id);
      });

      this.sessions.set(id, { id, pty: ptyProcess });
      log.info(`[TerminalRunner] Session ${id} started successfully`);
    } catch (error) {
      log.error(`[TerminalRunner] Failed to spawn session ${id}:`, error);
      this.mainWindow?.webContents.send(`terminal:exit:${id}`, 1);
    }
  }

  write(id: string, data: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.write(data);
    }
  }

  resize(id: string, cols: number, rows: number): void {
    const session = this.sessions.get(id);
    if (session) {
      session.pty.resize(cols, rows);
    }
  }

  kill(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      log.info(`[TerminalRunner] Killing session ${id}`);
      session.pty.kill();
      this.sessions.delete(id);
    }
  }

  killAll(): void {
    log.info(`[TerminalRunner] Killing all ${this.sessions.size} sessions`);
    for (const [id, session] of this.sessions) {
      session.pty.kill();
      this.sessions.delete(id);
    }
  }
}

export const terminalRunner = new TerminalRunner();
