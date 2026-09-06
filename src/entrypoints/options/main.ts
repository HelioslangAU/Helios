// Shared first: the palette, type and shape the marketing site is built from.
// `style.css` extends these and must not redeclare them.
import '@/styles/theme.css';
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
