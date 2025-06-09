# DatoCMS Plugin Bulk Replace

Find and replace strings across your DatoCMS project

## Features

- Search for strings across all your DatoCMS records
- **Replace functionality** - Replace matched strings with new values
- Selective replacement - Choose specific items or replace all at once
- View all matches organized by model and field with context snippets
- Modern highlight effect on matched terms
- Shows 4 words before and after each match for better context
- Displays locale information for matches in localized fields
- Support for searching in all field types including JSON and structured text
- Real-time search and replace with progress indication
- Visual feedback for replaced items

## Installation

To install this plugin:

1. Go to Settings > Plugins in your DatoCMS project
2. Click on "Install a new plugin"
3. Search for "Bulk Replace" 
4. Click Install

## Usage

### Searching
1. Open the plugin from the Plugins menu in your DatoCMS dashboard
2. Enter a search string in the input field
3. Click "Search for Matches" to find all occurrences across your content

### Replacing
1. After searching, enter the replacement string in the "Replace with" field
2. Choose your replacement method:
   - Select individual items using checkboxes for selective replacement
   - Check "Replace All" to replace in all found items
3. Click the "Replace" button to perform the replacement
4. Confirm the action in the dialog
5. Monitor the progress and view results

### Search Examples

- Search for: `example@email.com`
- Finds all occurrences of this email address
- Search for: `old company name`
- Finds all occurrences of this text

### Replace Examples

- Search: `example@email.com`
- Replace with: `contact@company.com`
- Replaces all occurrences of the old email with the new one

- Search: `old company name`
- Replace with: `new company name`
- Updates all references to the company name

## Permissions

This plugin requires the `currentUserAccessToken` permission to access and search through your content.

## Development

To develop this plugin locally:

```bash
npm install
npm run dev
```

## License

MIT