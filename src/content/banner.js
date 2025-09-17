console.log('Banner script loaded');

console.log('DOMContentLoaded fired');
class HeliosComprehensionBanner {
    constructor() {
        console.log('HeliosComprehensionBanner constructor');
        this.banner = document.getElementById('comprehension-banner');
        this.tab = document.getElementById('bannerTab');
        this.content = document.getElementById('bannerContent');
        this.isExpanded = false;
        
        this.initEventListeners();
    }

    initEventListeners() {
        console.log('Initializing event listeners for HeliosComprehensionBanner');
        if (this.tab) {
            this.tab.addEventListener('click', () => this.toggleBanner());
        } else {
            console.warn('bannerTab not found');
        }

        // Add mouse move listener to the whole document
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // Initially hide the tab if the mouse is not at the top
        // We'll trigger the check once shortly after initialization
        setTimeout(() => {
            if (!this.isExpanded) {
                this.tab.classList.add('hidden');
            }
        }, 500);
    }

    handleMouseMove(event) {
        const threshold = 50; // pixels from the top
        if (!this.tab) return;

        if (event.clientY < threshold) {
            // Show the tab when mouse is near the top
            this.tab.classList.remove('hidden');
        } else {
            // Hide the tab if the banner is not expanded
            if (!this.isExpanded) {
                this.tab.classList.add('hidden');
            }
        }
    }

    toggleBanner() {
        console.log('Toggling banner visibility');
        if (this.isExpanded) {
            this.collapseBanner();
        } else {
            this.expandBanner();
        }
    }

    expandBanner() {
        this.banner.classList.add('banner-expanded');
        // When expanded, the tab should always be visible
        if (this.tab) {
            this.tab.classList.remove('hidden');
        }
        this.isExpanded = true;
    }

    collapseBanner() {
        this.banner.classList.remove('banner-expanded');
        this.isExpanded = false;
        // After collapsing, check mouse position to decide if tab should be hidden
        // The mousemove handler will take care of this automatically.
    }
};