export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  meta?: Record<string, unknown>;
}

const MAX_ENTRIES = 200;
let idCounter = 0;
const entries: LogEntry[] = [];
const listeners: Set<() => void> = new Set();

const addEntry = (level: LogLevel, component: string, message: string, meta?: Record<string, unknown>) => {
  const entry: LogEntry = {
    id: ++idCounter,
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    meta,
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries.shift();
  listeners.forEach(fn => fn());
};

export const logger = {
  debug: (component: string, msg: string, meta?: Record<string, unknown>) => addEntry('debug', component, msg, meta),
  info: (component: string, msg: string, meta?: Record<string, unknown>) => addEntry('info', component, msg, meta),
  warn: (component: string, msg: string, meta?: Record<string, unknown>) => addEntry('warn', component, msg, meta),
  error: (component: string, msg: string, meta?: Record<string, unknown>) => addEntry('error', component, msg, meta),
  getEntries: () => [...entries],
  clear: () => { entries.length = 0; listeners.forEach(fn => fn()); },
  subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); },
};

// Intercept console methods
const origLog = console.log;
const origWarn = console.warn;
const origError = console.error;

console.log = (...args: any[]) => {
  origLog.apply(console, args);
  addEntry('info', 'console', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};
console.warn = (...args: any[]) => {
  origWarn.apply(console, args);
  addEntry('warn', 'console', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};
console.error = (...args: any[]) => {
  origError.apply(console, args);
  addEntry('error', 'console', args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '));
};
