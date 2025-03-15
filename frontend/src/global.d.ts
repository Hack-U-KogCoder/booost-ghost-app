// グローバル型定義
import { WailsBindings } from './utils/plugin-utils';

declare global {
  interface Window {
    // Wails フレームワークのAPI
    go?: {
      main: {
        App: WailsBindings;
      };
    };
    runtime?: {
      EventsOn: (eventName: string, callback: (data: any) => void) => (() => void);
      EventsEmit: (eventName: string, ...args: any[]) => void;
    };
  }
}