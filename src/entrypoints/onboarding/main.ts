import './style.css';
import '@/content/components/language-selector/language-selector.css';

import '@/content/languages/base-language-adapter';
import '@/content/languages/chinese-adapter';
import '@/content/languages/space-separated-adapter';
import '@/content/languages/language-registry';
import '@/content/vocab-manager';
import '@/content/dictionary-bridge';
import '@/content/dictionary-manager';
import '@/content/frequency-manager';
import '@/content/text-highlighter';
import '@/content/page-processor';
import '@/content/pronunciation-manager';
import '@/content/pronunciation';
import '@/content/anki-manager';
import '@/content/popup/components/popup-positioner';
import '@/content/popup/components/popup-content-builder';
import '@/content/popup/components/popup-event-handler';
import '@/content/popup/components/card-navigator';
import '@/content/popup/components/definition-filter';
import '@/content/popup/components/card-manager';
import '@/content/popup/popup-settings-manager';
import '@/content/popup/popup-manager';
import '@/content/popup/multi-card-popup-manager';
import '@/content/utils/activation-controller';
import '@/content/utils/lookup-controller';
import '@/content/components/language-selector/language-selector';
import '@/content/onboarding/first-run-detector';
import '@/content/onboarding/onboarding-controller';
import '@/ui/onboarding/onboarding';

// Floating characters background animation.
// Was an inline <script> in onboarding.html — blocked by MV3 CSP, so it never
// ran. Moved here as module code, where it now actually executes.
function createFloatingCharacters(): void {
  // Create floating characters
  const characters = [
    "学", "習", "語", "言", "美", "丽", "技", "術", "知", "道",
    "한", "국", "서", "울", "á", "é", "í", "ñ", "ç", "è",
    "ä", "ö", "ü", "ß", "д", "л", "я", "б", "й", "ц"
  ];

  const floatingBg = document.getElementById('floating-bg')!;

  characters.forEach((char, i) => {
    const div = document.createElement('div');
    div.className = 'floating-char';
    div.textContent = char;
    div.style.left = `${Math.random() * 100}%`;
    div.style.top = `${Math.random() * 100}%`;
    div.style.fontSize = `${Math.random() * 40 + 30}px`;
    div.style.animationDelay = `${Math.random() * 3}s`;
    div.style.animationDuration = `${Math.random() * 6 + 8}s`;
    div.style.fontWeight = `${Math.random() > 0.5 ? 900 : 300}`;
    floatingBg.appendChild(div);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createFloatingCharacters);
} else {
  createFloatingCharacters();
}
