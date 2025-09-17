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
            // File paths are centralized in src/config/paths.js
            link.href = window.PATHS ? window.PATHS.getChromeURL('CSS.BANNER') : chrome.runtime.getURL('src/ui/banner/banner.css');
            document.head.appendChild(link);
        }
    }

    async createBanner() {
        // Fetch the HTML for the banner
        // File paths are centralized in src/config/paths.js
        const bannerUrl = window.PATHS ? window.PATHS.getChromeURL('HTML.BANNER') : chrome.runtime.getURL('src/ui/banner/banner.html');
        const response = await fetch(bannerUrl);
        const html = await response.text();
        const temp = document.createElement('div');
        temp.innerHTML = html;
        this.banner = temp.firstElementChild;
        this.banner.id = 'comprehension-banner';
        document.body.prepend(this.banner);
        
        // Now that the banner is in the DOM, we can instantiate the banner logic
        new HeliosComprehensionBanner();

        const comprehension = window.pageProcessor.calculateComprehensionPercentage();
        this.updateComprehension(comprehension);
        this.updateKnownWords(window.vocabManager.getKnownWordsCount());
    }

    updateComprehension(comprehension) {
        if (!this.banner) return;

        const comprehensionElement = this.banner.querySelector('#comprehension-percentage');
        if (comprehensionElement) {
            comprehensionElement.textContent = `${comprehension}%`;
        }
    }

    updateKnownWords(knownWords) {
        if (!this.banner) return;

        const knownWordsElement = this.banner.querySelector('#known-words');
        if (knownWordsElement) {
            knownWordsElement.textContent = `${knownWords}`;
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