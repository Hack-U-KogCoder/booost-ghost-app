


import { createLogger, Logger } from './logger';


export interface WailsBindings {
  [key: string]: any;
  WritePluginLog: (pluginId: string, level: string, message: string) => Promise<void>;
  ReadPluginLogs: (pluginId: string, maxLines: number) => Promise<string[]>;
  ClearPluginLogs: (pluginId: string) => Promise<void>;
  ReadClipboard: () => Promise<string>;
  WriteClipboard: (text: string) => Promise<void>;
  ReturnFocusToPreviousWindow: () => Promise<void>;
  TakeScreenshot: () => Promise<void>;
  GetPluginDirectories: () => Promise<string[]>;
  ListPluginEntries: (dir: string) => Promise<{name: string, isDirectory: boolean}[]>;
  ReadPluginManifest: (path: string) => Promise<any>;
  ReadPluginModule: (path: string, moduleName: string) => Promise<string>;
  GetIconData: (path: string) => Promise<Uint8Array>;
  OpenMemo: () => Promise<void>;
  SimulateKeyPress: (keyString: string) => Promise<void>;
  GetPressedKeys: () => Promise<string[]>;
  GetMousePosX: () => Promise<number>;
  GetMousePosY: () => Promise<number>;
  GetGhostPosX: () => Promise<number>;
  GetGhostPosY: () => Promise<number>;
}


export interface WailsRuntime {
  EventsOn: (eventName: string, callback: (data: any) => void) => (() => void);
  EventsEmit: (eventName: string, ...args: any[]) => void;
}


export interface PluginContext {
  pluginId: string;
  logger: Logger;
  wailsBindings?: WailsBindings;
  wailsRuntime?: WailsRuntime;
}


export async function createPluginContext(pluginId: string): Promise<PluginContext> {
  let wailsBindings: WailsBindings | undefined;
  let wailsRuntime: WailsRuntime | undefined;
  
  
  if (typeof window !== 'undefined' && window.go && window.go.main && window.go.main.App) {
    wailsBindings = window.go.main.App;
  }
  
  
  if (typeof window !== 'undefined' && window.runtime) {
    wailsRuntime = {
      EventsOn: window.runtime.EventsOn,
      EventsEmit: window.runtime.EventsEmit
    };
  }
  
  
  const logger = await createLogger(pluginId, wailsBindings);
  
  return {
    pluginId,
    logger,
    wailsBindings,
    wailsRuntime
  };
}