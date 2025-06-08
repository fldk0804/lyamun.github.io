import { Ballpit } from './ballpit.js';

// Initialize Ballpit
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('ballpit-canvas');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }

    try {
        const ballpit = new Ballpit(canvas, {
            count: 200,
            colors: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff],
            gravity: 0.7,
            friction: 0.8,
            wallBounce: 0.95,
            followCursor: true
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (ballpit && ballpit.instance && ballpit.instance.three) {
                ballpit.instance.three.resize();
            }
        });
    } catch (error) {
        console.error('Error initializing ballpit:', error);
    }
});
