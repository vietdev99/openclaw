/**
 * Embedded Terminal Component
 * Uses xterm.js to display PTY output from main process
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface EmbeddedTerminalProps {
  sessionId: string;
  onComplete?: (exitCode: number) => void;
  autoFocus?: boolean;
}

export const EmbeddedTerminal: React.FC<EmbeddedTerminalProps> = ({
  sessionId,
  onComplete,
  autoFocus = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const handleComplete = useCallback((code: number) => {
    onComplete?.(code);
  }, [onComplete]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create terminal with dark theme matching app
    const term = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#eee',
        cursor: '#4CAF50',
        cursorAccent: '#1a1a2e',
        selectionBackground: 'rgba(76, 175, 80, 0.3)',
        black: '#1a1a2e',
        red: '#f44336',
        green: '#4CAF50',
        yellow: '#ff9800',
        blue: '#2196F3',
        magenta: '#9c27b0',
        cyan: '#00bcd4',
        white: '#eee',
        brightBlack: '#666',
        brightRed: '#ff5252',
        brightGreen: '#69f0ae',
        brightYellow: '#ffd740',
        brightBlue: '#448aff',
        brightMagenta: '#e040fb',
        brightCyan: '#18ffff',
        brightWhite: '#fff',
      },
      fontSize: 13,
      fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 1000,
      convertEol: true,
    });

    // Load addons
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // Web links addon - makes URLs clickable
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      window.open(uri, '_blank');
    });
    term.loadAddon(webLinksAddon);

    // Open terminal in container
    term.open(containerRef.current);
    fitAddon.fit();
    termRef.current = term;

    if (autoFocus) {
      term.focus();
    }

    // Receive output from main process
    const cleanupOutput = window.electronAPI.terminal.onOutput(sessionId, (data: string) => {
      term.write(data);
    });

    // Handle exit
    const cleanupExit = window.electronAPI.terminal.onExit(sessionId, (code: number) => {
      term.write(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
      handleComplete(code);
    });

    // Send user input to main process
    const dataDisposable = term.onData((data) => {
      window.electronAPI.terminal.write(sessionId, data);
    });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && termRef.current) {
        fitAddonRef.current.fit();
        window.electronAPI.terminal.resize(sessionId, termRef.current.cols, termRef.current.rows);
      }
    });
    resizeObserver.observe(containerRef.current);

    // Cleanup
    return () => {
      cleanupOutput();
      cleanupExit();
      dataDisposable.dispose();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [sessionId, autoFocus, handleComplete]);

  return (
    <div
      ref={containerRef}
      className="embedded-terminal"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '280px',
      }}
    />
  );
};

export default EmbeddedTerminal;
