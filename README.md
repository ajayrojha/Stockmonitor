# Stockmonitor

Live S&P 500 dashboard built with React, TypeScript and Vite.

## Signing in

The app now needs a login. Until the Phase 2 backend exists, a mock API runs in the browser with [Mock Service Worker](https://mswjs.io) (`src/mocks/`) and answers every `/api/*` call. All three demo accounts use the password `Demo@1234`:

| Email | Role |
| --- | --- |
| admin@stockmonitor.dev | admin |
| analyst@stockmonitor.dev | analyst |
| viewer@stockmonitor.dev | viewer |

Set `VITE_USE_MOCKS=false` and `VITE_API_URL` to point the app at a real API.

| Angular | Here |
| --- | --- |
| `AuthService` + DI | `AuthProvider` context and the `useAuth()` hook (`src/auth/`) |
| `HttpInterceptor` | `apiFetch()` in `src/api/client.ts` (adds the token, refreshes on 401) |
| `CanActivate` guard | `<ProtectedRoute>` in `src/auth/ProtectedRoute.tsx` |
| Reactive Forms + Validators | React Hook Form + a Zod schema (`src/pages/LoginPage.tsx`) |
| `RouterModule.forRoot(routes)` | `createHashRouter` in `src/router.tsx` |

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
