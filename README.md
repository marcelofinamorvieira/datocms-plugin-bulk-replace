# DatoCMS Plugin Bulk Replace

Find and replace strings (or regexes) across your DatoCMS project

## Features

- Search for exact strings or regex patterns across all your DatoCMS records
- View all matches organized by model and field with context snippets
- Modern highlight effect on matched terms
- Shows 4 words before and after each match for better context
- Displays locale information for matches in localized fields
- Direct links to edit matching records
- Support for searching in all field types including JSON and structured text
- Real-time search with progress indication

## Installation

To install this plugin:

1. Go to Settings > Plugins in your DatoCMS project
2. Click on "Install a new plugin"
3. Search for "Bulk Replace" 
4. Click Install

## Usage

1. Open the plugin from the Plugins menu in your DatoCMS dashboard
2. Enter a search string or regex pattern in the input field
3. Toggle "Use Regular Expression" if you want to use regex search
4. Click "Search for Matches" to find all occurrences across your content
5. Review the results and click "Edit Record" to open any matching record

### Search Examples

**Exact String Search:**
- Search for: `example@email.com`
- Finds all exact occurrences of this email address

**Regular Expression Search:**
- Search for: `\d{3}-\d{3}-\d{4}`
- Finds all phone numbers in the format XXX-XXX-XXXX
- Search for: `https?://[^\s]+`
- Finds all HTTP/HTTPS URLs

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