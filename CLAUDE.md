# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a DatoCMS plugin that allows users to search and replace strings across all content in their DatoCMS project. The plugin provides a configuration screen UI where users can enter search strings, view matching records, and perform bulk replacements.

## Commands

```bash
# Install dependencies
npm install

# Run development server (opens at http://localhost:5173)
npm run dev

# Build for production (outputs to dist/)
npm run build

# Preview production build
npm run preview
```

## Architecture

### Plugin Structure
- **Entry Point**: `src/main.tsx` - Registers the plugin with DatoCMS SDK using the `connect()` function
- **Config Screen**: `src/entrypoints/ConfigScreen.tsx` - Main UI component that renders when the plugin is opened
- **Utilities**:
  - `src/utils/render.tsx` - Helper for rendering React components with StrictMode
  - `src/utils/logger.ts` - Custom logger with development/production modes and log history
- **Styling**: CSS modules (`styles.module.css`) using DatoCMS design system variables

### Key Dependencies
- `datocms-plugin-sdk`: Core SDK for plugin development
- `datocms-react-ui`: UI components following DatoCMS design system
- `@datocms/cma-client-browser`: Client for accessing DatoCMS Content Management API

### Plugin Configuration
The plugin is configured in `package.json` under the `datoCmsPlugin` field:
- Requires `currentUserAccessToken` permission to access content
- Entry point is `dist/index.html` (built output)
- Plugin metadata includes title, images, and permissions

### Search and Replace Implementation
The ConfigScreen component implements:
1. String input with validation
2. Search across all models and records using CMA client
3. Pagination handling for large datasets (100 records per page)
4. Results display with links to edit records in DatoCMS
5. Replace functionality with:
   - Selective replacement using checkboxes
   - "Replace All" option
   - Progress tracking during replacements
   - Visual feedback for replaced items

### Development Notes
- Uses Vite for fast development and building
- TypeScript for type safety
- React 18 with hooks for state management
- All API calls use the browser CMA client with user's access token
- Logger utility provides console output only in development mode (localhost)