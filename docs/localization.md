# App localization

The Expo client uses `i18next` with `react-i18next` for UI copy and `expo-localization` for device locale information. English (`en`) is the first-run default. Vietnamese (`vi`) is included as a second locale. A selected locale is stored in web local storage or Expo SecureStore on iOS and Android.

## Install

From the repository root:

```sh
pnpm --filter @memory-chess/client add i18next react-i18next
pnpm --filter @memory-chess/client exec expo install expo-localization
```

The dependencies and Expo config plugin are already added to this project.

## Use translations in a component

```js
import { useTranslation } from 'react-i18next';

function ExampleButton() {
  const { t } = useTranslation();
  return <Button>{t('menu.findMatch')}</Button>;
}
```

Add matching keys to both `apps/client/src/i18n/locales/en.json` and `vi.json`. The client test suite checks that both dictionaries have identical key paths.

## Add a language picker later

Call the exported `changeAppLanguage` helper from a picker; it validates and persists the choice:

```js
import { changeAppLanguage } from './src/i18n';

await changeAppLanguage('vi');
```

Supported locales are listed in `supportedLanguages` in `apps/client/src/i18n/index.js`. `deviceLocales` is available for a future “Use device language” option. The current first-run language remains English regardless of device locale.

## Chess and API errors

Chess result reasons are translated by their stable result key, such as `game.reasons.timeout`. API and Socket.IO errors are translated from stable error codes in `src/i18n/index.js`; the UI does not display server-provided Vietnamese error strings directly.
