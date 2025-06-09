type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
}

class Logger {
  private isDevelopment: boolean;
  private logs: LogEntry[] = [];
  private maxLogs: number = 1000;

  constructor() {
    // Check if we're in development mode
    this.isDevelopment = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
  }

  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString().replace('T', ' ').split('.')[0];
  }

  private formatMessage(level: LogLevel, message: string): string {
    return `[${this.formatTimestamp()}] [${level.toUpperCase()}] ${message}`;
  }

  private addToHistory(level: LogLevel, message: string, data?: any) {
    this.logs.push({
      timestamp: this.formatTimestamp(),
      level,
      message,
      data
    });

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  private log(level: LogLevel, message: string, data?: any) {
    const formattedMessage = this.formatMessage(level, message);
    
    // Always log errors and warnings
    if (level === 'error' || level === 'warn') {
      console[level](formattedMessage, data || '');
    } 
    // Log info in development or if explicitly enabled
    else if (level === 'info' && this.isDevelopment) {
      console.info(formattedMessage, data || '');
    }
    // Log debug only in development
    else if (level === 'debug' && this.isDevelopment) {
      console.debug(formattedMessage, data || '');
    }

    this.addToHistory(level, message, data);
  }

  debug(message: string, data?: any) {
    this.log('debug', message, data);
  }

  info(message: string, data?: any) {
    this.log('info', message, data);
  }

  warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  error(message: string, data?: any) {
    this.log('error', message, data);
  }

  group(label: string) {
    if (this.isDevelopment) {
      console.group(label);
    }
  }

  groupEnd() {
    if (this.isDevelopment) {
      console.groupEnd();
    }
  }

  // Get recent logs for display in UI
  getRecentLogs(count: number = 100): LogEntry[] {
    return this.logs.slice(-count);
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Clear log history
  clearLogs() {
    this.logs = [];
  }

  // Log performance timing
  time(label: string) {
    if (this.isDevelopment) {
      console.time(label);
    }
  }

  timeEnd(label: string) {
    if (this.isDevelopment) {
      console.timeEnd(label);
    }
  }
}

// Export singleton instance
export const logger = new Logger();