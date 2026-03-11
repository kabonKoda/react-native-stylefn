'use strict';

// Re-export React's JSX runtime. The Babel plugin handles
// the actual JSX transformation; this module exists so that
// TypeScript's jsxImportSource resolution finds a valid runtime.
module.exports = require('react/jsx-runtime');
