import React, { useState, useEffect, useRef } from 'react';
export interface ClickableRegion {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
const mockSetClickableElements = async (elements: ClickableRegion[]) => {
    console.log('Mock SetClickableElements called with:', elements);
    return true;
};
const setClickableElements = (elements: ClickableRegion[]) => {
    if (typeof window !== 'undefined' && window.go && window.go.main && window.go.main.App) {
        return window.go.main.App.SetClickableElements(elements);
    } else {
        return mockSetClickableElements(elements);
    }
};
interface ClickableManagerProps {
    scanInterval?: number;
}
export const ClickableManager: React.FC<ClickableManagerProps> = ({
    scanInterval = 200
}) => {
    const [clickableRegions, setClickableRegions] = useState<ClickableRegion[]>([]);
    const scanTimerRef = useRef<number | null>(null);
    const lastRegionsRef = useRef<string>('');

    const scanClickableElements = () => {

        const clickableElements = document.querySelectorAll('.clickable');

        const regions: ClickableRegion[] = [];

        clickableElements.forEach((element, index) => {
            const rect = element.getBoundingClientRect();

            regions.push({
                id: element.id || `clickable-${index}`,
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
            });
        });


        const regionsJSON = JSON.stringify(regions);
        if (regionsJSON !== lastRegionsRef.current) {
            lastRegionsRef.current = regionsJSON;
            setClickableRegions(regions);


            setClickableElements(regions)
                .catch((err: Error) => console.error('Failed to set clickable regions:', err));
        }
    };


    useEffect(() => {

        scanClickableElements();


        scanTimerRef.current = window.setInterval(scanClickableElements, scanInterval);


        const handleResize = () => {
            scanClickableElements();
        };

        window.addEventListener('resize', handleResize);


        return () => {
            if (scanTimerRef.current !== null) {
                clearInterval(scanTimerRef.current);
            }
            window.removeEventListener('resize', handleResize);
        };
    }, [scanInterval]);


    return null;
};
export default ClickableManager;