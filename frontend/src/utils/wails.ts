// Wails関連のユーティリティ
import { useState, useEffect } from 'react';

// Wails関数をインポートするためのヘルパー
export const createPluginImporter = (pluginId: string) => {
    return {
        // Wails関連の関数をインポート
        importWailsBindings: async () => {
            try {
                return await import('../../wailsjs/go/main/App');
            } catch (error) {
                console.error(`Failed to import Wails bindings for ${pluginId}:`, error);
                throw error;
            }
        },
        // ランタイム関数をインポート
        importWailsRuntime: async () => {
            try {
                return await import('../../wailsjs/runtime/runtime');
            } catch (error) {
                console.error(`Failed to import Wails runtime for ${pluginId}:`, error);
                throw error;
            }
        }
    };
};

// Wails関数を使用するためのReactフック
export function useWails(pluginId: string) {
    const [wailsBindings, setWailsBindings] = useState<any>(null);
    const [runtime, setRuntime] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const loadBindings = async () => {
            try {
                const { importWailsBindings, importWailsRuntime } = createPluginImporter(pluginId);
                const bindings = await importWailsBindings();
                const rt = await importWailsRuntime();
                setWailsBindings(bindings);
                setRuntime(rt);
                setIsLoading(false);
            } catch (err) {
                setError(err as Error);
                setIsLoading(false);
            }
        };

        loadBindings();
    }, [pluginId]);

    return { wailsBindings, runtime, isLoading, error };
}
