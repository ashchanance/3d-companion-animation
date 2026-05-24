import { useEffect, useRef } from 'react';
import { initVRM } from '../vrm-avatar';

interface VRMAvatarProps {
    className?: string;
}

export function VRMAvatar({ className = '' }: VRMAvatarProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const initialized = useRef(false);

    useEffect(() => {
        if (initialized.current) return;
        if (containerRef.current) {
            initialized.current = true;
            initVRM(containerRef.current.id, '/Janna/_VRM/Janna.vrm').catch(err => {
                console.error('Failed to initialize VRM:', err);
            });
        }
    }, []);

    return (
        <div className={`relative ${className}`}>
            {/* Decorative background glow for the avatar */}
            <div className="absolute inset-0 bg-gradient-to-tr from-primary-100 to-white rounded-full blur-3xl opacity-50 pointer-events-none"></div>

            {/* The actual container for 3D canvas */}
            <div
                ref={containerRef}
                id="vrm-container-react"
                className="w-full h-full relative z-10 drop-shadow-xl"
            />
        </div>
    );
}
