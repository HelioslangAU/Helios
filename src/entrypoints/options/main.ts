// Shared first: the palette, type and shape the marketing site is built from.
// `style.css` extends these and must not redeclare them.
import '@/styles/theme.css';
import '@/styles/ambient.css';
import './style.css';
import '@/config/paths';
import '@/content/languages/base-language-adapter';
import '@/content/languages/chinese-adapter';
import '@/content/languages/space-separated-adapter';
import '@/content/languages/language-registry';
import '@/content/settings/settings-storage';
import '@/content/settings/settings-ui';
import '@/content/anki-manager';
import '@/content/settings/settings-anki';
import '@/content/dictionary-manager';
import '@/content/vocab-manager';
import '@/content/settings/settings-vocabulary';
import '@/content/settings/settings-advanced';
import '@/content/settings/helios-settings';

import { mountAmbientBackground } from '@/ui/shared/ambient-background';

// The glyph field is decoration with no state, so it is mounted once the
// document is parsed and never touched again.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => mountAmbientBackground());
} else {
  mountAmbientBackground();
}
