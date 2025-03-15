import { GhostEvent, GhostEventType } from './types';
export class EventEmitter {
    private listeners: { [key: string]: ((event: GhostEvent) => void)[] } = {};

    // イベントリスナーを登録
    on(eventType: GhostEventType, callback: (event: GhostEvent) => void) {
        if (!this.listeners[eventType]) {
            this.listeners[eventType] = [];
        }
        this.listeners[eventType].push(callback);

        // アンサブスクライブ関数を返す
        return () => {
            this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
        };
    }

    // イベントを発火
    emit(event: GhostEvent) {
        const listeners = this.listeners[event.type];
        if (listeners) {
            listeners.forEach(callback => callback(event));
        }
    }

    // すべてのリスナーを削除
    clear() {
        this.listeners = {};
    }
}