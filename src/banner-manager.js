class BannerManager {
    constructor() {
        this.banner = null;
        this.init();
    }

    init() {
        this.injectBannerCSS();
        this.createBanner();
    }

    injectBannerCSS() {
        if (!document.getElementById('language-extension-banner-css')) {
            const link = document.createElement('link');
            link.id = 'language-extension-banner-css';
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = chrome.runtime.getURL('banner.css');
            document.head.appendChild(link);
        }
    }

    async createBanner() {
        // Fetch the HTML for the banner
        const response = await fetch(chrome.runtime.getURL('banner.html'));
        const html = await response.text();
        const temp = document.createElement('div');
        temp.innerHTML = html;
        this.banner = temp.firstElementChild;
        this.banner.id = 'comprehension-banner';
        document.body.prepend(this.banner);
        const comprehension = window.pageProcessor.calculateComprehensionPercentage();
        this.updateComprehension(comprehension);
    }

    updateComprehension(comprehension) {
        if (!this.banner) return;

        const comprehensionElement = this.banner.querySelector('#comprehension-percentage');
        if (comprehensionElement) {
            comprehensionElement.textContent = `Comprehension: ${comprehension}%`;
        }
    }


    hideBanner() {
        if (this.banner) {
            this.banner.style.display = 'none';
        }
    }

    showBanner() {
        if (this.banner) {
            this.banner.style.display = 'block';
        }
    }
}