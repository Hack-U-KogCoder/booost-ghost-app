import React, { useState, useEffect, useRef } from 'react';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { EnableMouseEvents, DisableMouseEvents, ReturnFocusToPreviousWindow } from '../wailsjs/go/main/App';
import { GhostManager } from './core/GhostManager';
import { GhostRenderer } from './components/GhostRenderer';
import { PluginDiagnostic } from './components/PluginDiagnostic';
import { LoadedGhost } from './core/types';

interface Position {
    x: number;
    y: number;
}

interface Velocity {
    x: number;
    y: number;
}

export default function App() {
    const [textPos, setTextPos] = useState<Position>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [mousePos, setMousePos] = useState<Position>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [velocity, setVelocity] = useState<Velocity>({ x: 0, y: 0 });
    const [mouseText, setMouseText] = useState<string>('Leave');
    const [isMouseOver, setIsMouseOver] = useState<boolean>(false);
    const [ghostManager] = useState(() => new GhostManager());
    const [currentGhost, setCurrentGhost] = useState<LoadedGhost | null>(null);
    const [availableGhosts, setAvailableGhosts] = useState<LoadedGhost[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const lastMousePos = useRef<Position>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const lastVelocities = useRef<Velocity[]>([]);
    const isNearText = useRef(false);
    const FOLLOW_DISTANCE = 140;
    const MOVEMENT_THRESHOLD = 2;
    const NEAR_THRESHOLD = 50;
    const VELOCITY_SMOOTHING = 5;
    const FOCUS_THRESHOLD = 50;

    // マウス座標上の要素が「クリック可能」かどうかを判定する関数
    const isOverClickableElement = (x: number, y: number): boolean => {
        const elements = document.elementsFromPoint(x, y);
        return elements.some(el => {
            // 要素自身かその親要素にclickableクラスがあるか確認
            let currentEl: Element | null = el;
            while (currentEl) {
                if (currentEl.classList && currentEl.classList.contains('clickable')) {
                    return true;
                }
                currentEl = currentEl.parentElement;
            }
            return false;
        });
    };

    // ゴーストがクリックされたときの処理
    const handleGhostClick = async () => {
        if (currentGhost) {
            try {
                console.log(`Handling click for ghost: ${currentGhost.manifest.name}`);
                await ghostManager.handleClick();
            } catch (error) {
                console.error('Failed to handle ghost click:', error);
            }
        }
    };

    const handleGhostRightClick = async () => {
        if (currentGhost) {
            try {
                console.log(`Handling right click for ghost: ${currentGhost.manifest.name}`);
                await ghostManager.handleRightClick();
            } catch (error) {
                console.error('Failed to handle ghost right click:', error);
            }
        }
    };

    const calculateDistance = (pos1: Position, pos2: Position) => {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        return {
            dx: Math.round(dx),
            dy: Math.round(dy),
            total: Math.round(Math.sqrt(dx * dx + dy * dy))
        };
    };

    // マウスの移動を追跡
    useEffect(() => {
        let unsubscribe: () => void;

        try {
            // Wails環境でのイベント登録
            unsubscribe = EventsOn('mouse-move', (data: Position) => {
                setMousePos(data);

                // マウスが「クリック可能」な要素の上にあるかどうかをチェック
                const isClickable = isOverClickableElement(data.x, data.y);

                // 判定結果に基づいてマウスイベントを制御
                if (isClickable) {
                    EnableMouseEvents();
                } else {
                    DisableMouseEvents();
                }
            });
        } catch (error) {
            console.error('Failed to register mouse-move event, falling back to browser events:', error);

            // ブラウザ環境のフォールバック
            const handleMouseMove = (e: MouseEvent) => {
                const newPos = { x: e.clientX, y: e.clientY };
                setMousePos(newPos);

                // マウスが「クリック可能」な要素の上にあるかどうかをチェック
                const isClickable = isOverClickableElement(newPos.x, newPos.y);

                // 判定結果に基づいてマウスイベントを制御
                if (isClickable) {
                    EnableMouseEvents();
                } else {
                    DisableMouseEvents();
                }
            };

            window.addEventListener('mousemove', handleMouseMove);
            unsubscribe = () => window.removeEventListener('mousemove', handleMouseMove);
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    // 速度の計算部分
    useEffect(() => {
        const dx = mousePos.x - lastMousePos.current.x;
        const dy = mousePos.y - lastMousePos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
            const newVelocity = {
                x: dx / distance,
                y: dy / distance
            };

            lastVelocities.current.push(newVelocity);
            if (lastVelocities.current.length > VELOCITY_SMOOTHING) {
                lastVelocities.current.shift();
            }

            const avgVelocity = lastVelocities.current.reduce(
                (acc, vel) => ({
                    x: acc.x + vel.x / lastVelocities.current.length,
                    y: acc.y + vel.y / lastVelocities.current.length
                }),
                { x: 0, y: 0 }
            );

            const avgMagnitude = Math.sqrt(avgVelocity.x * avgVelocity.x + avgVelocity.y * avgVelocity.y);
            if (avgMagnitude > 0) {
                setVelocity({
                    x: avgVelocity.x / avgMagnitude,
                    y: avgVelocity.y / avgMagnitude
                });
            }
        }

        lastMousePos.current = mousePos;
    }, [mousePos]);

    // ゴーストの位置更新ロジック
    useEffect(() => {
        const updatePosition = () => {
            const dx = mousePos.x - textPos.x;
            const dy = mousePos.y - textPos.y;
            const distanceToMouse = Math.sqrt(dx * dx + dy * dy);
            const mouseSpeed = Math.sqrt(
                Math.pow(mousePos.x - lastMousePos.current.x, 2) +
                Math.pow(mousePos.y - lastMousePos.current.y, 2)
            );

            if (mouseSpeed < MOVEMENT_THRESHOLD && distanceToMouse < NEAR_THRESHOLD) {
                isNearText.current = true;
                return;
            }

            if (distanceToMouse > NEAR_THRESHOLD) {
                isNearText.current = false;
            }

            if (!isNearText.current) {
                let targetX: number;
                let targetY: number;

                if (mouseSpeed > 0.1) {
                    targetX = mousePos.x - (velocity.x * FOLLOW_DISTANCE);
                    targetY = mousePos.y - (velocity.y * FOLLOW_DISTANCE);
                } else {
                    const angle = Math.atan2(dy, dx);
                    targetX = mousePos.x - (Math.cos(angle) * FOLLOW_DISTANCE);
                    targetY = mousePos.y - (Math.sin(angle) * FOLLOW_DISTANCE);
                }

                const easing = Math.min(0.1 * (distanceToMouse / FOLLOW_DISTANCE), 0.15);

                setTextPos(prev => ({
                    x: prev.x + (targetX - prev.x) * easing,
                    y: prev.y + (targetY - prev.y) * easing
                }));
            }
        };

        const interval = setInterval(updatePosition, 16);
        return () => clearInterval(interval);
    }, [mousePos, velocity]);

    // プラグインの読み込みと切り替えイベントのリスニング
    useEffect(() => {
        setIsLoading(true);

        // ゴーストの読み込み
        ghostManager.loadGhosts()
            .then(() => {
                // Get all loaded ghosts
                const ghosts = ghostManager.getGhosts();
                console.log("Loaded ghosts:", ghosts.map(g => g.manifest.name));
                setAvailableGhosts(ghosts);

                if (ghosts.length > 0) {
                    // Use the first available ghost
                    const firstGhost = ghosts[0];
                    console.log(`Switching to first ghost: ${firstGhost.manifest.name}`);

                    ghostManager.switchGhost(firstGhost.manifest.id)
                        .then((success) => {
                            if (success) {
                                console.log(`Ghost switched to: ${firstGhost.manifest.name}`);
                                setCurrentGhost(firstGhost);
                            } else {
                                console.error(`Failed to switch to ghost: ${firstGhost.manifest.name}`);
                            }
                        })
                        .catch((error) => {
                            console.error('Failed to switch to first ghost:', error);
                        })
                        .finally(() => {
                            setIsLoading(false);
                        });
                } else {
                    console.warn('No ghosts loaded');
                    setIsLoading(false);
                }
            })
            .catch(error => {
                console.error('Failed to load ghosts:', error);
                setIsLoading(false);
            });

        // ゴースト切り替えイベントをリッスン
        let unsubscribe: () => void;

        try {
            unsubscribe = EventsOn('switch-ghost', (ghostId: string) => {
                if (typeof ghostId === 'string') {
                    console.log(`Received switch-ghost event: ${ghostId}`);

                    // ghostManagerの切り替え前に現在のゴーストIDを記録
                    const previousGhostId = ghostManager.getCurrentGhost()?.manifest.id;

                    ghostManager.switchGhost(ghostId)
                        .then((success) => {
                            if (success) {
                                // 切り替え後に現在のゴーストを更新
                                const ghost = ghostManager.getCurrentGhost();
                                if (ghost) {
                                    console.log(`Current ghost updated to: ${ghost.manifest.name}`);
                                    setCurrentGhost(ghost);
                                }
                            }
                        })
                        .catch((error) => {
                            console.error('Failed to switch ghost:', error);
                        });
                } else {
                    console.warn('Received invalid ghost ID:', ghostId);
                }
            });
        } catch (error) {
            console.error('Failed to register switch-ghost event:', error);
            unsubscribe = () => { }; // ダミー関数
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [ghostManager]);

    // ゴーストの切り替え関数
    const handleSwitchGhost = async (ghostId: string) => {
        console.log(`Switching to ghost: ${ghostId}`);
        try {
            const success = await ghostManager.switchGhost(ghostId);
            if (success) {
                const newGhost = ghostManager.getCurrentGhost();
                if (newGhost) {
                    console.log(`Successfully switched to ghost: ${newGhost.manifest.name}`);
                    setCurrentGhost(newGhost);
                }
            } else {
                console.error(`Failed to switch to ghost: ${ghostId}`);
            }
        } catch (error) {
            console.error(`Error switching to ghost ${ghostId}:`, error);
        }
    };

    // マウスイベント制御関数
    const handleMouseEnter = async () => {
        try {
            setMouseText('Enter');
            await EnableMouseEvents();
        } catch (error) {
            console.error('Failed to enable mouse events:', error);
        }
    };

    const handleMouseLeave = async () => {
        try {
            setMouseText('Leave');
            await DisableMouseEvents();
        } catch (error) {
            console.error('Failed to disable mouse events:', error);
        }
    };

    const handleShortcutEvent = async (eventType: string) => {
        console.log(`Shortcut event received: ${eventType}`);

        if (!currentGhost) return;

        try {
            switch (eventType) {
                case 'pushSC1':
                    await ghostManager.handlePushSC1();
                    break;
                case 'pushSC2':
                    await ghostManager.handlePushSC2();
                    break;
                case 'pushSC3':
                    await ghostManager.handlePushSC3();
                    break;
                case 'pushSub':
                    await ghostManager.handlePushSub();
                    break;
                default:
                    console.warn(`Unknown shortcut event type: ${eventType}`);
            }
        } catch (error) {
            console.error(`Failed to handle shortcut event ${eventType}:`, error);
        }
    };

    // ショートカットイベントの監視を追加
    useEffect(() => {
        let unsubscribe: () => void;

        try {
            unsubscribe = EventsOn('shortcut-event', (eventType: string) => {
                handleShortcutEvent(eventType);
            });
        } catch (error) {
            console.error('Failed to register shortcut-event handler:', error);
            unsubscribe = () => { };
        }

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [ghostManager, currentGhost]);

    useEffect(() => {
        const updateGhosts = () => {
            const ghosts = ghostManager.getGhosts();
            if (ghosts.length !== availableGhosts.length) {
                setAvailableGhosts(ghosts);
            }
        };

        // Update every second (or on demand if needed)
        const interval = setInterval(updateGhosts, 1000);
        return () => clearInterval(interval);
    }, [ghostManager, availableGhosts]);

    // ゴーストの位置が変わるたびにGo側に通知する
    useEffect(() => {
        // Go バインディングが利用可能な場合のみ実行
        if (window.go?.main?.App?.SetGhostPos) {
            window.go.main.App.SetGhostPos(textPos.x, textPos.y)
                .catch((err: Error) => console.error("Failed to update ghost position:", err));
        }
    }, [textPos]);
    
    // useEffect(() => {
    //     const positionUpdateInterval = setInterval(() => {
    //         if (window.go?.main?.App?.SetGhostPos) {
    //             window.go.main.App.SetGhostPos(textPos.x, textPos.y)
    //                 .catch((err: Error) => console.error("Failed to update ghost position in interval:", err));
    //         }
    //     }, 100); // 100ms間隔で更新
    
    //     return () => {
    //         clearInterval(positionUpdateInterval);
    //     };
    // }, []);

    const distance = calculateDistance(textPos, mousePos);

    return (
        <div style={{
            width: "100vw",
            height: "100vh",
            backgroundColor: "transparent",
            position: "relative",
        }}>
            {isLoading ? (
                <div
                    className="clickable"
                    style={{
                        position: "absolute",
                        left: "50%",
                        top: "50%",
                        transform: "translate(-50%, -50%)",
                        color: "white",
                        padding: "10px",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        borderRadius: "5px",
                    }}
                >
                    Loading...
                </div>
            ) : !currentGhost ? (
                <div
                    className="clickable"
                    style={{
                        position: "absolute",
                        left: textPos.x,
                        top: textPos.y,
                        transform: "translate(-50%, -50%)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        color: "white",
                        padding: "10px",
                        backgroundColor: "rgba(0, 0, 0, 0.5)",
                        borderRadius: "5px",
                    }}
                >
                    <div>No ghosts loaded</div>
                </div>
            ) : (
                <GhostRenderer
                    ghost={currentGhost}
                    position={textPos}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleGhostClick}
                    onRightClick={handleGhostRightClick}
                    allGhosts={availableGhosts}
                    onSwitchGhost={handleSwitchGhost}
                />
            )}
        </div>
    );
}