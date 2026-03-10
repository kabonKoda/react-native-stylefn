/**
 * Side-effect-only import that applies the React.createElement patch immediately.
 *
 * When imported (e.g., via the Babel plugin), this patches React.createElement
 * before any component renders, enabling style functions everywhere.
 *
 * Usage:
 *   import 'react-native-stylefn/auto'
 *
 * This is injected automatically by the Babel plugin, so users don't need
 * to import it manually.
 */
import { applyPatch } from './patch';

applyPatch();
