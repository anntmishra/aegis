import * as fs from 'fs';
import * as path from 'path';
import { HealingLogEntry } from './types';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogMessage {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: unknown;
}

class Logger {
  private component: string;
  private logDir: string;
  private logLevel: LogLevel;

  constructor(component: string) {
    this.component = component;
    this.logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): LogMessage {
    return {
      timestamp: new Date().toISOString(),
      level,
      component: this.component,
      message,
      data,
    };
  }

  private colorize(level: LogLevel, text: string): string {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m',  // Cyan
      info: '\x1b[32m',   // Green
      warn: '\x1b[33m',   // Yellow
      error: '\x1b[31m',  // Red
    };
    const reset = '\x1b[0m';
    return `${colors[level]}${text}${reset}`;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) return;

    const logMessage = this.formatMessage(level, message, data);
    const timestamp = new Date().toLocaleTimeString();
    const levelStr = level.toUpperCase().padEnd(5);
    
    // Console output with colors
    const coloredLevel = this.colorize(level, levelStr);
    const consoleOutput = `[${timestamp}] ${coloredLevel} [${this.component}] ${message}`;

    if (data) {
      console.log(consoleOutput, data);
    } else {
      console.log(consoleOutput);
    }

    this.writeToFile(logMessage);
  }

  private writeToFile(logMessage: LogMessage): void {
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logDir, `aegis-${today}.log`);
    
    try {
      fs.appendFileSync(logFile, JSON.stringify(logMessage) + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  debug(message: string, data?: unknown): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: unknown): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: unknown): void {
    this.log('error', message, data);
  }

  getRecentHealingLogs(limit: number): HealingLogEntry[] {
    const healingLogFile = path.join(this.logDir, 'healing-log.json');

    if (!fs.existsSync(healingLogFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(healingLogFile, 'utf-8');
      const logs: HealingLogEntry[] = JSON.parse(content);
      return logs.slice(-limit).reverse();
    } catch {
      return [];
    }
  }

  logHealing(entry: HealingLogEntry): void {
    const healingLogFile = path.join(this.logDir, 'healing-log.json');

    let logs: HealingLogEntry[] = [];
    if (fs.existsSync(healingLogFile)) {
      try {
        const content = fs.readFileSync(healingLogFile, 'utf-8');
        logs = JSON.parse(content);
      } catch {
        logs = [];
      }
    }

    logs.push(entry);

    fs.writeFileSync(healingLogFile, JSON.stringify(logs, null, 2));

    this.info(`🩺 Healing Action: ${entry.action} on ${entry.service}`, {
      symptoms: entry.symptoms,
      rootCause: entry.root_cause,
      confidence: entry.confidence,
    });
  }
}

export function createLogger(component: string): Logger {
  return new Logger(component);
}

export default Logger;
