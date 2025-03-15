import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LoadedGhost, Position } from '../core/types';
import { GetIconData } from '../../wailsjs/go/main/App';
interface GhostRendererProps {
    ghost: LoadedGhost | null;
    position: Position;
    onClick: () => void;
    onRightClick?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    allGhosts: LoadedGhost[];
    onSwitchGhost: (ghostId: string) => void;
}
export const GhostRenderer: React.FC<GhostRendererProps> = ({
    ghost,
    position,
    onClick,
    onRightClick,
    onMouseEnter,
    onMouseLeave,
    allGhosts,
    onSwitchGhost
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [iconSrc, setIconSrc] = useState<string>('./assets/images/ghost.png');
    const [ghostButtonText, setGhostButtonText] = useState<string>('');
    const [opacity, setOpacity] = useState<number>(0);
    const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const [ghostIcons, setGhostIcons] = useState<{ [key: string]: string }>({});
    const [selectedGhostId, setSelectedGhostId] = useState<string | null>(null);

    const prevGhostIdRef = useRef<string | null>(null);
    const iconLoadingRef = useRef<boolean>(false);
    const currentIconPathRef = useRef<string | null>(null);
    const ghostContainerRef = useRef<HTMLDivElement>(null);
    const prevMenuOpenRef = useRef<boolean>(false);
    const wheelActivityRef = useRef<boolean>(false);

    useEffect(() => {
        console.log("Loading icons for ghosts:", allGhosts.map(g => g.manifest.name));

        const loadIcons = async () => {
            const newIcons: { [key: string]: string } = {};

            for (const g of allGhosts) {
                if (g.manifest.icon) {
                    try {
                        console.log(`Loading icon for ${g.manifest.name} from ${g.manifest.icon}`);
                        const dataUrl = await GetIconData(g.manifest.icon);
                        if (dataUrl) {
                            newIcons[g.manifest.id] = dataUrl;
                            console.log(`Successfully loaded icon for ${g.manifest.name}`);
                        } else {
                            newIcons[g.manifest.id] = './assets/images/ghost.png';
                            console.log(`Using default icon for ${g.manifest.name} (no data returned)`);
                        }
                    } catch (error) {
                        console.error(`Failed to load icon for ${g.manifest.name}:`, error);
                        newIcons[g.manifest.id] = './assets/images/ghost.png';
                    }
                } else {
                    console.log(`No icon specified for ${g.manifest.name}, using default`);
                    newIcons[g.manifest.id] = './assets/images/ghost.png';
                }
            }

            console.log("Loaded icons:", Object.keys(newIcons).length);
            setGhostIcons(newIcons);
        };

        loadIcons();
    }, [allGhosts]);

    useEffect(() => {
        if (menuOpen && ghost) {
            console.log(`Menu opened, setting initial selection to current ghost: ${ghost.manifest.id}`);
            setSelectedGhostId(ghost.manifest.id);
            prevMenuOpenRef.current = true;
        }
    }, [menuOpen, ghost]);

    useEffect(() => {
        if (!menuOpen && prevMenuOpenRef.current && selectedGhostId && ghost) {

            prevMenuOpenRef.current = false;
            if (selectedGhostId !== ghost.manifest.id) {
                console.log(`Menu closed, switching to selected ghost: ${selectedGhostId}`);
                onSwitchGhost(selectedGhostId);
            }
        }
    }, [menuOpen, selectedGhostId, ghost, onSwitchGhost]);

    useEffect(() => {
        if (!ghost) {
            setOpacity(0);
            return;
        }
        if (prevGhostIdRef.current !== ghost.manifest.id) {
            setIsTransitioning(true);
            setOpacity(0);

            const transitionTimeout = setTimeout(() => {
                try {
                    const text = ghost.ghost.getButtonText();
                    setGhostButtonText(text);
                } catch (error) {
                    console.error('Failed to get button text:', error);
                    setGhostButtonText('Error');
                }

                if (ghost.manifest.icon) {
                    loadGhostIcon(ghost.manifest.icon);
                } else {
                    setIconSrc('./assets/images/ghost.png');
                }

                setTimeout(() => {
                    setOpacity(1);
                    setIsTransitioning(false);
                }, 50);
            }, 150);
            prevGhostIdRef.current = ghost.manifest.id;


            setMenuOpen(false);

            return () => clearTimeout(transitionTimeout);
        } else {
            setOpacity(1);

            try {
                const text = ghost.ghost.getButtonText();
                setGhostButtonText(text);
            } catch (error) {
                console.error('Failed to get button text:', error);
                setGhostButtonText('Error');
            }

            if (ghost.manifest.icon && currentIconPathRef.current !== ghost.manifest.icon) {
                loadGhostIcon(ghost.manifest.icon);
            }
        }
    }, [ghost]);

    const loadGhostIcon = async (iconPath: string) => {
        if (iconLoadingRef.current || currentIconPathRef.current === iconPath) {
            return;
        }

        iconLoadingRef.current = true;
        currentIconPathRef.current = iconPath;

        try {
            if (iconPath.startsWith('data:') || iconPath.startsWith('http')) {
                setIconSrc(iconPath);
                iconLoadingRef.current = false;
                return;
            }

            const dataUrl = await GetIconData(iconPath);

            if (!dataUrl) {
                console.error('Received empty icon data');
                setIconSrc('./assets/images/ghost.png');
            } else {
                setIconSrc(dataUrl);
            }
        } catch (error) {
            console.error('Failed to load ghost icon:', error);
            setIconSrc('./assets/images/ghost.png');
        } finally {
            iconLoadingRef.current = false;
        }
    };

    const handleRightClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();


        const newMenuState = !menuOpen;

        if (menuOpen) {
            console.log("Right-click detected, closing menu");

        } else {
            console.log("Right-click detected, opening menu");
            wheelActivityRef.current = false;
        }

        setMenuOpen(newMenuState);


        if (onRightClick) {
            try {
                onRightClick();
            } catch (error) {
                console.error('Error in onRightClick handler:', error);
            }
        }
    };

    const handleWheel = useCallback((e: WheelEvent) => {
        if (!menuOpen || allGhosts.length <= 1) return;

        e.preventDefault();
        wheelActivityRef.current = true;

        let currentIndex = allGhosts.findIndex(g => g.manifest.id === selectedGhostId);
        if (currentIndex === -1) {
            currentIndex = allGhosts.findIndex(g => g.manifest.id === ghost?.manifest.id);
        }
        if (currentIndex === -1) return;

        let newIndex;
        if (e.deltaY > 0) {
            newIndex = (currentIndex - 1 + allGhosts.length) % allGhosts.length;

        } else {
            newIndex = (currentIndex + 1) % allGhosts.length;
        }

        const newSelectedId = allGhosts[newIndex].manifest.id;
        console.log(`Wheel scrolled, selection from ${currentIndex} to ${newIndex} (${newSelectedId})`);

        setSelectedGhostId(newSelectedId);
    }, [menuOpen, allGhosts, selectedGhostId, ghost]);

    useEffect(() => {
        if (menuOpen) {
            console.log("Adding wheel event listener");
            window.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            console.log("Removing wheel event listener");
            window.removeEventListener('wheel', handleWheel);
            wheelActivityRef.current = false;
        };
    }, [menuOpen, handleWheel]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                menuOpen &&
                ghostContainerRef.current &&
                !ghostContainerRef.current.contains(e.target as Node)
            ) {
                console.log("Click outside detected, closing menu");
                setMenuOpen(false);

            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [menuOpen]);
    if (!ghost) return null;
    const handleMouseEnter = () => {
        setIsHovered(true);
        onMouseEnter?.();
    };
    const handleMouseLeave = () => {
        setIsHovered(false);
        onMouseLeave?.();
    };


    const getIconSize = (totalGhosts: number) => {
        if (totalGhosts <= 3) return 48;
        if (totalGhosts <= 6) return 40;
        if (totalGhosts <= 9) return 32;
        return 24;
    };

    const iconSize = getIconSize(allGhosts.length - 1);


    const menuItems = menuOpen ? allGhosts.map((g, i, arr) => {
        const totalItems = arr.length;


        const startAngle = Math.PI / 2;
        const endAngle = -Math.PI / 2;
        const angleRange = endAngle - startAngle;


        const angle = startAngle - (angleRange * (i / (totalItems - 1 || 1)));


        const baseRadius = 110;
        const radius = baseRadius + (totalItems > 5 ? 30 : 0);


        const x = position.x + radius * Math.cos(angle);
        const y = position.y + radius * Math.sin(angle);


        const isCurrentGhost = g.manifest.id === ghost.manifest.id;
        const isSelected = g.manifest.id === selectedGhostId;


        if (isSelected) {
            console.log(`Rendering selected indicator for ghost: ${g.manifest.name}`);
        }

        return (
            <div
                key={g.manifest.id}
                className="clickable"
                style={{
                    position: 'fixed',
                    left: x,
                    top: y,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 29,
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: isCurrentGhost
                        ? 'rgba(100, 200, 255, 0.3)'
                        : 'rgba(255, 255, 255, 0.15)',
                    borderRadius: '50%',
                    padding: '4px',
                    boxShadow: isSelected
                        ? '0 0 15px rgba(255, 255, 100, 0.8)'
                        : isCurrentGhost
                            ? '0 0 10px rgba(100, 200, 255, 0.7)'
                            : '0 0 10px rgba(255, 255, 255, 0.5)',
                    border: isSelected
                        ? '2px solid rgba(255, 255, 100, 0.8)'
                        : isCurrentGhost
                            ? '2px solid rgba(100, 200, 255, 0.7)'
                            : '1px solid rgba(255, 255, 255, 0.5)',
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    console.log(`Clicking ghost: ${g.manifest.name}`);
                    if (!isCurrentGhost) {
                        onSwitchGhost(g.manifest.id);
                    }
                    setMenuOpen(false);
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.2)';
                    e.currentTarget.style.backgroundColor = isCurrentGhost
                        ? 'rgba(100, 200, 255, 0.5)'
                        : 'rgba(255, 255, 255, 0.3)';


                    if (!wheelActivityRef.current) {

                        setSelectedGhostId(g.manifest.id);
                        console.log(`Mouse enter: setting selection to ${g.manifest.name}`);
                    }
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                    e.currentTarget.style.backgroundColor = isCurrentGhost
                        ? 'rgba(100, 200, 255, 0.3)'
                        : 'rgba(255, 255, 255, 0.15)';
                }}
            >
                {/* Selection indicator circle */}
                {isSelected && (
                    <div style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        width: iconSize + 20,
                        height: iconSize + 20,
                        borderRadius: '50%',
                        border: '2px solid rgba(255, 255, 100, 0.8)',
                        transform: 'translate(-50%, -50%)',
                        animation: 'pulse 1.5s infinite',
                        pointerEvents: 'none',
                        zIndex: 28,
                    }} />
                )}

                <img
                    src={ghostIcons[g.manifest.id] || './assets/images/ghost.png'}
                    alt={g.manifest.name}
                    title={g.manifest.name}
                    style={{
                        width: isCurrentGhost ? iconSize + 8 : iconSize,
                        height: isCurrentGhost ? iconSize + 8 : iconSize,
                        objectFit: 'contain',
                        opacity: isCurrentGhost ? 1 : 0.8,
                    }}
                />
                <div
                    style={{
                        position: 'absolute',
                        left: '50%',
                        bottom: '-20px',
                        transform: 'translateX(-50%)',
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        color: isSelected ? 'yellow' : isCurrentGhost ? 'cyan' : 'white',
                        padding: '3px 6px',
                        borderRadius: '4px',
                        fontSize: iconSize > 32 ? '12px' : '10px',
                        whiteSpace: 'nowrap',
                        fontWeight: isSelected || isCurrentGhost ? 'bold' : 'normal',
                    }}
                >
                    {g.manifest.name}
                </div>
            </div>
        );
    }) : [];

    useEffect(() => {
        const styleId = 'ghost-menu-styles';


        if (!document.getElementById(styleId)) {
            const styles = document.createElement('style');
            styles.id = styleId;
            styles.innerHTML = `
                @keyframes pulse {
                    0% { box-shadow: 0 0 0 0 rgba(255, 255, 0, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(255, 255, 0, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(255, 255, 0, 0); }
                }
            `;
            document.head.appendChild(styles);
        }

        return () => {

        };
    }, []);
    return (
        <div ref={ghostContainerRef}>
            {/* Ghost menu items */}
            {menuItems}

            {/* Debug info for development */}
            {menuOpen && process.env.NODE_ENV === 'development' && (
                <div style={{
                    position: 'fixed',
                    left: 10,
                    top: 10,
                    background: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    padding: '5px',
                    fontSize: '12px',
                    zIndex: 100,
                    pointerEvents: 'none',
                }}>
                    Selected: {selectedGhostId}<br />
                    Current: {ghost.manifest.id}<br />
                    Wheel Active: {wheelActivityRef.current ? 'Yes' : 'No'}<br />
                    Right-click again to apply selection
                </div>
            )}

            {/* Menu background semi-circle when menu is open */}
            {menuOpen && (
                <div
                    style={{
                        position: 'fixed',
                        left: position.x,
                        top: position.y,
                        width: '240px',
                        height: '240px',
                        borderRadius: '50%',

                        background: 'radial-gradient(circle at right center, transparent 50%, rgba(255, 255, 255, 0.05) 50%)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        zIndex: 28,
                    }}
                />
            )}

            {/* Main ghost */}
            <div
                className="clickable"
                style={{
                    position: 'fixed',
                    left: position.x,
                    top: position.y,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 30,
                    pointerEvents: 'none',
                    transition: 'opacity 0.15s ease-in-out',
                    opacity: opacity,
                }}
            >
                <div
                    style={{
                        position: 'relative',
                        pointerEvents: isTransitioning ? 'none' : 'auto',
                        cursor: isTransitioning ? 'default' : 'pointer',
                    }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (!menuOpen) onClick();
                    }}
                    onContextMenu={handleRightClick}
                >
                    <img
                        src={iconSrc}
                        alt={ghost.manifest.name}
                        style={{
                            width: 64,
                            height: 64,
                            objectFit: 'contain',
                            filter: menuOpen ? 'drop-shadow(0px 0px 10px rgba(255,255,255,0.8))' : 'none',
                            transition: 'filter 0.2s ease',
                        }}
                        onError={() => {
                            console.error('Failed to load ghost icon, using default');
                            setIconSrc('./assets/images/ghost.png');
                        }}
                    />

                    <div
                        style={{
                            position: 'absolute',
                            left: '50%',
                            bottom: '-20px',
                            transform: 'translateX(-50%)',
                            backgroundColor: isHovered || menuOpen ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
                            color: 'white',
                            padding: isHovered || menuOpen ? '4px 8px' : '0',
                            borderRadius: '4px',
                            fontSize: '14px',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.2s ease',
                            opacity: isHovered || menuOpen ? 1 : 0,
                        }}
                    >
                        {ghostButtonText}
                    </div>
                </div>
            </div>
        </div>
    );
}