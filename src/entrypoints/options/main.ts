// Shared first: the palette, faces and easing every Helios surface is built
// from. `style.css` extends them and must not redeclare them.
import '@/styles/tokens.css';
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
