import { LoadedGhost, GhostEvent, GhostEventType, GhostManifest, Ghost } from './types';
import { EventEmitter } from './events';
import { createPluginContext, PluginContext } from '../utils/plugin-utils';

export class GhostManager {
    private ghosts: Map<string, LoadedGhost> = new Map();
    private currentGhostId: string | null = null;
    private eventEmitter: EventEmitter;
    private isLoading: boolean = false;
    private pluginContexts: Map<string, PluginContext> = new Map();

    
    private isSwitching: boolean = false;
    private pendingSwitchId: string | null = null;
    private lastSwitchTime: number = 0;
    private switchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        this.eventEmitter = new EventEmitter();
    }

    
    async loadGhosts() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            console.log("=== Starting ghost plugins loading ===");

            try {
                
                if (typeof window !== 'undefined' && window.go && window.go.main && window.go.main.App) {
                    const pluginDirs = await window.go.main.App.GetPluginDirectories();
                    console.log("Plugin directories:", pluginDirs);

                    for (const dir of pluginDirs) {
                        try {
                            console.log(`Scanning directory: ${dir}`);
                            
                            const entries = await window.go.main.App.ListPluginEntries(dir);
                            console.log(`Found ${entries.length} entries in ${dir}:`, entries);

                            for (const entry of entries) {
                                if (entry.isDirectory) {
                                    try {
                                        console.log(`Loading plugin from: ${dir}/${entry.name}`);
                                        await this.loadSingleGhost(`${dir}/${entry.name}`);
                                        console.log(`Successfully loaded plugin from: ${dir}/${entry.name}`);
                                    } catch (error) {
                                        console.error(`Failed to load plugin from ${dir}/${entry.name}:`, error);
                                    }
                                }
                            }
                        } catch (error) {
                            console.error(`Failed to read plugin directory ${dir}:`, error);
                        }
                    }

                    
                    console.log("Loaded plugins:", Array.from(this.ghosts.keys()));
                } else {
                    console.warn("Wails API not available - running in browser mode or not properly initialized");
                }
            } catch (error) {
                console.error("Failed to load plugins:", error);
            }

            console.log("=== Ghost plugins loading completed ===");
        } finally {
            this.isLoading = false;
        }
    }

    private async loadSingleGhost(pluginDir: string) {
        try {
            if (typeof window === 'undefined' || !window.go || !window.go.main || !window.go.main.App) {
                throw new Error("Wails API not available");
            }

            
            const manifest = await window.go.main.App.ReadPluginManifest(`${pluginDir}/manifest.json`);

            
            const context = await createPluginContext(manifest.id);
            this.pluginContexts.set(manifest.id, context);

            
            if (manifest.icon && !manifest.icon.startsWith('http') && !manifest.icon.startsWith('data:')) {
                
                manifest.icon = `${pluginDir}/${manifest.icon}`;
            }

            
            try {
                console.log(`Loading index module from ${pluginDir}`);
                const indexCode = await window.go.main.App.ReadPluginModule(pluginDir, 'index');

                
                const isTypeScript = this.isTypeScriptCode(indexCode);

                if (isTypeScript) {
                    console.log(`Plugin ${manifest.id} contains TypeScript code`);
                }

                
                const ghostModule = this.evaluateModule(indexCode);

                const ghost: LoadedGhost = {
                    manifest,
                    ghost: ghostModule.default || ghostModule
                };

                
                if (ghost.ghost.init) {
                    await ghost.ghost.init(context);
                }

                
                await ghost.ghost.onInit();

                
                if (this.ghosts.has(manifest.id)) {
                    const oldGhost = this.ghosts.get(manifest.id)!;
                    await oldGhost.ghost.onCleanup();
                }

                
                this.ghosts.set(manifest.id, ghost);


                return true;
            } catch (error) {
                console.error(`Error loading module for plugin ${manifest.id}:`, error);
                throw error;
            }
        } catch (error) {
            console.error(`Error loading ghost from ${pluginDir}:`, error);
            throw error;
        }
    }


    
    private isTypeScriptCode(code: string): boolean {
        
        const tsPatterns = [
            /interface\s+\w+\s*\{/,      
            /:\s*(string|number|boolean|any)\b/, 
            /<\w+>/,                     
            /export\s+type\b/,           
            /implements\b/               
        ];

        return tsPatterns.some(pattern => pattern.test(code));
    }


    
    private evaluateModule(code: string): any {
        try {
            const moduleExports = {};
            const moduleObj = { exports: moduleExports };

            
            const processedCode = code
                .replace(/import\s+.*?from\s+['"].*?['"]/g, '// $&')
                .replace(/export\s+interface\s+\w+\s*\{[^}]*\}/g, '// $&')
                .replace(/:\s*(string|number|boolean|any)(\[\])?\s*=/g, ' =')
                .replace(/:\s*(string|number|boolean|any)(\[\])?\s*;/g, ';')
                .replace(/<(string|number|boolean|any)>/g, '');

            const moduleFn = new Function('module', 'exports', processedCode);
            moduleFn(moduleObj, moduleExports);

            return moduleObj.exports;
        } catch (error) {
            console.error('Error evaluating module:', error);
            console.error('Code snippet:', code.substring(0, 200) + '...');

            
            return {
                init: async (context: any) => { console.error('Failed to load module - init called'); },
                onActivate: async () => { console.error('Failed to load module - onActivate called'); },
                onDeactivate: async () => { console.error('Failed to load module - onDeactivate called'); },
                onClick: async () => { console.error('Failed to load module - onClick called'); },
                getButtonText: () => 'Error',
                onInit: async () => { console.error('Failed to load module - onInit called'); },
                onCleanup: async () => { console.error('Failed to load module - onCleanup called'); }
            };
        }
    }

    
    async switchGhost(ghostId: string): Promise<boolean> {
        console.log(`Switch request to ghost: ${ghostId}`);

        
        if (this.isSwitching) {
            console.log(`Switch already in progress, queuing request to ${ghostId}`);
            this.pendingSwitchId = ghostId;
            return false;
        }

        
        if (this.currentGhostId === ghostId) {
            console.log(`Already on ghost ${ghostId}, ignoring switch request`);
            return true;
        }

        const newGhost = this.ghosts.get(ghostId);
        if (!newGhost) {
            console.warn(`Ghost with ID "${ghostId}" not found. Available ghosts: ${Array.from(this.ghosts.keys()).join(', ')}`);
            return false;
        }

        
        this.isSwitching = true;
        this.lastSwitchTime = Date.now();

        try {
            console.log(`Switching ghost from ${this.currentGhostId || 'none'} to ${ghostId}`);

            
            if (this.currentGhostId) {
                const currentGhost = this.ghosts.get(this.currentGhostId);
                if (currentGhost) {
                    console.log(`Deactivating current ghost: ${this.currentGhostId}`);
                    await currentGhost.ghost.onDeactivate();
                    this.emitEvent('deactivate', this.currentGhostId);
                }
            }

            
            console.log(`Activating new ghost: ${ghostId}`);
            await newGhost.ghost.onActivate();
            
            this.currentGhostId = ghostId;
            this.emitEvent('activate', ghostId);

            
            if (typeof window !== 'undefined' && window.go && window.go.main && window.go.main.App && window.go.main.App.SwitchGhost) {
                try {
                    await window.go.main.App.SwitchGhost(ghostId);
                } catch (error) {
                    console.error("Failed to call native SwitchGhost:", error);
                }
            }

            return true;
        } catch (error) {
            console.error(`Error switching to ghost "${ghostId}":`, error);
            return false;
        } finally {
            
            this.isSwitching = false;

            
            if (this.pendingSwitchId) {
                const nextGhostId = this.pendingSwitchId;
                this.pendingSwitchId = null;

                console.log(`Processing queued switch to ${nextGhostId}`);
                setTimeout(() => {
                    this.switchGhost(nextGhostId).catch(err => {
                        console.error(`Error during queued switch to ${nextGhostId}:`, err);
                    });
                }, 100);
            }
        }
    }

    
    async handleClick() {
        if (!this.currentGhostId) return;

        const ghost = this.ghosts.get(this.currentGhostId);
        if (ghost) {
            try {
                console.log(`Handling click for ghost: ${this.currentGhostId}`);
                await ghost.ghost.onClick();
                this.emitEvent('click', this.currentGhostId);
            } catch (error) {
                console.error(`Error handling click for ghost "${this.currentGhostId}":`, error);
            }
        }
    }

    
    async handleRightClick() {
        if (!this.currentGhostId) return;

        const ghost = this.ghosts.get(this.currentGhostId);
        if (ghost && ghost.ghost.onRightClick) {
            try {
                console.log(`Handling right click for ghost: ${this.currentGhostId}`);
                await ghost.ghost.onRightClick();
                this.emitEvent('rightClick', this.currentGhostId);
            } catch (error) {
                console.error(`Error handling right click for ghost "${this.currentGhostId}":`, error);
            }
        }
    }

    
    async handlePushSC1() {
        if (!this.currentGhostId) return;

        const ghost = this.ghosts.get(this.currentGhostId);
        if (ghost && ghost.ghost.onPushSC1) {
            try {
                console.log(`Handling SC1 for ghost: ${this.currentGhostId}`);
                await ghost.ghost.onPushSC1();
                this.emitEvent('pushSC1', this.currentGhostId);
            } catch (error) {
                console.error(`Error handling SC1 for ghost "${this.currentGhostId}":`, error);
            }
        }
    }

    
    async handlePushSC2() {
        if (!this.currentGhostId) return;

        const ghost = this.ghosts.get(this.currentGhostId);
        if (ghost && ghost.ghost.onPushSC2) {
            try {
                console.log(`Handling SC2 for ghost: ${this.currentGhostId}`);
                await ghost.ghost.onPushSC2();
                this.emitEvent('pushSC2', this.currentGhostId);      
            } catch (error) {
                console.error(`Error handling SC2 for ghost "${this.currentGhostId}":`, error);
            }
        }
    }

    
    async handlePushSC3() {
        if (!this.currentGhostId) return;

        const ghost = this.ghosts.get(this.currentGhostId);
        if (ghost && ghost.ghost.onPushSC3) {
            try {
                console.log(`Handling SC3 for ghost: ${this.currentGhostId}`);
                await ghost.ghost.onPushSC3();
                this.emitEvent('pushSC3', this.currentGhostId);
            } catch (error) {
                console.error(`Error handling SC3 for ghost "${this.currentGhostId}":`, error);
            }
        }
    }

    
    async handlePushSub() {
        if (!this.currentGhostId) return;

        const ghost = this.ghosts.get(this.currentGhostId);
        if (ghost && ghost.ghost.onPushSub) {
            try {
                console.log(`Handling Sub shortcut for ghost: ${this.currentGhostId}`);
                await ghost.ghost.onPushSub();
                this.emitEvent('pushSub', this.currentGhostId);
            } catch (error) {
                console.error(`Error handling Sub shortcut for ghost "${this.currentGhostId}":`, error);
            }
        }
    }

    
    private emitEvent(type: GhostEventType, ghostId: string, data?: any) {
        this.eventEmitter.emit({ type, ghostId, data });
    }

    onEvent(type: GhostEventType, callback: (event: GhostEvent) => void) {
        return this.eventEmitter.on(type, callback);
    }

    
    getCurrentGhost() {
        return this.currentGhostId ? this.ghosts.get(this.currentGhostId) : null;
    }

    getGhosts() {
        return Array.from(this.ghosts.values());
    }

    
    getPluginContext(ghostId: string): PluginContext | undefined {
        return this.pluginContexts.get(ghostId);
    }

    
    async cleanup() {
        
        for (const [ghostId, ghost] of this.ghosts.entries()) {
            try {
                await ghost.ghost.onCleanup();
            } catch (error) {
                console.error(`Failed to cleanup ghost ${ghost.manifest.id}:`, error);
            }
        }

        
        this.ghosts.clear();
        this.pluginContexts.clear();
        this.eventEmitter.clear();
        this.currentGhostId = null;
    }
}