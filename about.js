document.addEventListener('DOMContentLoaded', function () {
    const track = document.querySelector('.gallery-track');
    const items = document.querySelectorAll('.gallery-item');
    const faceCount = items.length;
    const cylinderWidth = window.innerWidth <= 640 ? 1100 : 1800;
    const faceWidth = (cylinderWidth / faceCount) * 1.5;
    const radius = cylinderWidth / (2 * Math.PI);
    let rotation = 0;
    let isDragging = false;
    let startX = 0;
    let currentX = 0;
    const dragFactor = 0.05;

    // Position items in a circle
    items.forEach((item, i) => {
        item.style.width = `${faceWidth}px`;
        item.style.transform = `rotateY(${i * (360 / faceCount)}deg) translateZ(${radius}px)`;
    });

    // Handle drag events
    track.addEventListener('mousedown', startDrag);
    track.addEventListener('touchstart', startDrag);
    track.addEventListener('mousemove', drag);
    track.addEventListener('touchmove', drag);
    track.addEventListener('mouseup', endDrag);
    track.addEventListener('touchend', endDrag);
    track.addEventListener('mouseleave', endDrag);

    function startDrag(e) {
        isDragging = true;
        startX = e.type === 'mousedown' ? e.pageX : e.touches[0].pageX;
        track.style.transition = 'none';
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        currentX = e.type === 'mousemove' ? e.pageX : e.touches[0].pageX;
        const diff = currentX - startX;
        rotation += diff * dragFactor;
        track.style.transform = `rotateY(${rotation}deg)`;
        startX = currentX;
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        track.style.transition = 'transform 0.3s ease-out';
    }

    // Autoplay
    let autoplayInterval;
    function startAutoplay() {
        autoplayInterval = setInterval(() => {
            rotation -= (360 / faceCount);
            track.style.transform = `rotateY(${rotation}deg)`;
        }, 2000);
    }

    function stopAutoplay() {
        clearInterval(autoplayInterval);
    }

    // Start autoplay
    startAutoplay();

    // Pause on hover
    track.addEventListener('mouseenter', stopAutoplay);
    track.addEventListener('mouseleave', startAutoplay);

    // Handle window resize
    window.addEventListener('resize', () => {
        const newCylinderWidth = window.innerWidth <= 640 ? 1100 : 1800;
        const newFaceWidth = (newCylinderWidth / faceCount) * 1.5;
        const newRadius = newCylinderWidth / (2 * Math.PI);

        items.forEach((item, i) => {
            item.style.width = `${newFaceWidth}px`;
            item.style.transform = `rotateY(${i * (360 / faceCount)}deg) translateZ(${newRadius}px)`;
        });
    });
});
