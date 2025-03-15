export enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR"
  }
  
  // ロガーの型定義
  export interface Logger {
    debug(message: string): Promise<void>;
    info(message: string): Promise<void>;
    warn(message: string): Promise<void>;
    error(message: string): Promise<void>;
    getLogHistory(maxLines?: number): Promise<string[]>;
    clearLogs(): Promise<void>;
  }
  
  // Wailsバインディングを使用するロガーの実装
  export class WailsLogger implements Logger {
    private pluginId: string;
    private wailsBindings: any;
  
    constructor(pluginId: string, wailsBindings: any) {
      this.pluginId = pluginId;
      this.wailsBindings = wailsBindings;
    }
  
    async debug(message: string): Promise<void> {
      await this.log(LogLevel.DEBUG, message);
    }
  
    async info(message: string): Promise<void> {
      await this.log(LogLevel.INFO, message);
    }
  
    async warn(message: string): Promise<void> {
      await this.log(LogLevel.WARN, message);
    }
  
    async error(message: string): Promise<void> {
      await this.log(LogLevel.ERROR, message);
    }
  
    private async log(level: LogLevel, message: string): Promise<void> {
      try {
        if (this.wailsBindings && this.wailsBindings.WritePluginLog) {
          await this.wailsBindings.WritePluginLog(this.pluginId, level, message);
        } else {
          // フォールバック: Wailsバインディングが利用できない場合はコンソールに出力
          console.log(`[${this.pluginId}] [${level}] ${message}`);
        }
      } catch (error) {
        console.error(`Failed to write log: ${error}`);
      }
    }
  
    async getLogHistory(maxLines: number = 100): Promise<string[]> {
      try {
        if (this.wailsBindings && this.wailsBindings.ReadPluginLogs) {
          return await this.wailsBindings.ReadPluginLogs(this.pluginId, maxLines);
        }
      } catch (error) {
        console.error(`Failed to read logs: ${error}`);
      }
      return [];
    }
  
    async clearLogs(): Promise<void> {
      try {
        if (this.wailsBindings && this.wailsBindings.ClearPluginLogs) {
          await this.wailsBindings.ClearPluginLogs(this.pluginId);
        }
      } catch (error) {
        console.error(`Failed to clear logs: ${error}`);
      }
    }
  }
  
  // ブラウザ環境用のフォールバックロガー
  export class BrowserLogger implements Logger {
    private pluginId: string;
    private logs: string[] = [];
  
    constructor(pluginId: string) {
      this.pluginId = pluginId;
    }
  
    async debug(message: string): Promise<void> {
      this.log(LogLevel.DEBUG, message);
      console.debug(`[${this.pluginId}] ${message}`);
    }
  
    async info(message: string): Promise<void> {
      this.log(LogLevel.INFO, message);
      console.info(`[${this.pluginId}] ${message}`);
    }
  
    async warn(message: string): Promise<void> {
      this.log(LogLevel.WARN, message);
      console.warn(`[${this.pluginId}] ${message}`);
    }
  
    async error(message: string): Promise<void> {
      this.log(LogLevel.ERROR, message);
      console.error(`[${this.pluginId}] ${message}`);
    }
  
    private log(level: LogLevel, message: string): void {
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] [${this.pluginId}] [${level}] ${message}`;
      this.logs.push(logEntry);
      
      // 最大1000エントリまで保持
      if (this.logs.length > 1000) {
        this.logs.shift();
      }
    }
  
    async getLogHistory(maxLines: number = 100): Promise<string[]> {
      if (maxLines > 0 && this.logs.length > maxLines) {
        return this.logs.slice(this.logs.length - maxLines);
      }
      return [...this.logs];
    }
  
    async clearLogs(): Promise<void> {
      this.logs = [];
    }
  }
  
  // ロガーファクトリ関数
  // Wailsバインディングが利用可能な場合はWailsLogger、そうでない場合はBrowserLoggerを返す
  export async function createLogger(pluginId: string, wailsBindings?: any): Promise<Logger> {
    if (wailsBindings) {
      return new WailsLogger(pluginId, wailsBindings);
    }
    
    // ブラウザ環境用のフォールバック
    return new BrowserLogger(pluginId);
  }
  