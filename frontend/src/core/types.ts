import { PluginContext } from '../utils/plugin-utils';

export interface Position {
    x: number;
    y: number;
}

export interface Velocity {
    x: number;
    y: number;
}

// プラグインのマニフェスト定義
export interface GhostManifest {
    id: string;               // プラグインの一意なID
    name: string;             // 表示名
    version: string;          // バージョン
    description: string;      // 説明
    author: string;           // 作者
    shortcut: string;         // ショートカットキー (e.g., "Alt+1")
    icon: string;             // アイコンのパス
}

// 統合されたGhostインターフェース（contentとbackgroundを統合）
export interface Ghost {
    // コンテキストの初期化（GhostManager から呼び出される）
    init?: (context: PluginContext) => Promise<void>;
    
    // ゴーストがアクティブになったときの処理
    onActivate: () => Promise<void>;
    
    // ゴーストが非アクティブになったときの処理
    onDeactivate: () => Promise<void>;
    
    // ゴーストがクリックされたときの処理
    onClick: () => Promise<void>;
    
    // ゴーストが右クリックされたときの処理
    onRightClick?: () => Promise<void>;
    
    // ショートカット1が押されたときの処理
    onPushSC1?: () => Promise<void>;
    
    // ショートカット2が押されたときの処理
    onPushSC2?: () => Promise<void>;
    
    // ショートカット3が押されたときの処理
    onPushSC3?: () => Promise<void>;
    
    // サブショートカットが押されたときの処理
    onPushSub?: () => Promise<void>;
    
    // ボタンのテキストを取得
    getButtonText: () => string;
    
    // プラグインの初期化時の処理（旧background.onInit）
    onInit: () => Promise<void | boolean>;
    
    // プラグインのクリーンアップ時の処理（旧background.onCleanup）
    onCleanup: () => Promise<void | boolean>;
}

// ロードされたプラグインの完全な形
export interface LoadedGhost {
    manifest: GhostManifest;
    ghost: Ghost;  // 統合されたGhostインターフェース
}

// イベント型定義
export type GhostEventType = 'activate' | 'deactivate' | 'click' | 'move' | 'rightClick' | 'pushSC1' | 'pushSC2' | 'pushSC3' | 'pushSub';

export interface GhostEvent {
    type: GhostEventType;
    ghostId: string;
    data?: any;
}