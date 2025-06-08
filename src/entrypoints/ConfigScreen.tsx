import type { RenderConfigScreenCtx } from 'datocms-plugin-sdk';
import { Canvas, Button, TextField, Spinner } from 'datocms-react-ui';
import { buildClient } from '@datocms/cma-client-browser';
import { useState } from 'react';
import s from './styles.module.css';

type Props = {
  ctx: RenderConfigScreenCtx;
};

type SearchResult = {
  itemId: string;
  itemTypeId: string;
  itemTypeName: string;
  itemTitle: string;
  fieldName: string;
  fieldApiKey: string;
  matches?: { match: string; context: string; index: number }[];
  locale?: string;
  localeMatches?: Record<string, { match: string; context: string; index: number }[]>;
};

const HighlightedText: React.FC<{ text: string; searchPattern: string | RegExp }> = ({ text, searchPattern }) => {
  const parts: { text: string; highlight: boolean }[] = [];
  
  if (typeof searchPattern === 'string') {
    const regex = new RegExp(searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.substring(lastIndex, match.index), highlight: false });
      }
      parts.push({ text: match[0], highlight: true });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push({ text: text.substring(lastIndex), highlight: false });
    }
  } else {
    const regex = new RegExp(searchPattern.source, 'gi');
    let lastIndex = 0;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ text: text.substring(lastIndex, match.index), highlight: false });
      }
      parts.push({ text: match[0], highlight: true });
      lastIndex = match.index + match[0].length;
    }
    
    if (lastIndex < text.length) {
      parts.push({ text: text.substring(lastIndex), highlight: false });
    }
  }
  
  if (parts.length === 0) {
    return <>{text}</>;
  }
  
  return (
    <>
      {parts.map((part, index) => (
        part.highlight ? (
          <mark key={index} className={s.highlight}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      ))}
    </>
  );
};

export default function ConfigScreen({ ctx }: Props) {
  const [searchInput, setSearchInput] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const validateRegex = (pattern: string): boolean => {
    try {
      new RegExp(pattern);
      return true;
    } catch (e) {
      return false;
    }
  };

  const searchInValue = (value: any, searchPattern: string | RegExp): { match: string; context: string; index: number }[] => {
    const matches: { match: string; context: string; index: number }[] = [];
    
    let textToSearch = '';
    if (typeof value === 'string') {
      textToSearch = value;
    } else if (typeof value === 'object' && value !== null) {
      textToSearch = JSON.stringify(value);
    } else {
      return matches;
    }

    if (typeof searchPattern === 'string') {
      let index = textToSearch.toLowerCase().indexOf(searchPattern.toLowerCase());
      while (index !== -1) {
        const match = textToSearch.substring(index, index + searchPattern.length);
        const context = getContextAroundMatch(textToSearch, index, match.length);
        matches.push({ match, context, index });
        index = textToSearch.toLowerCase().indexOf(searchPattern.toLowerCase(), index + 1);
      }
    } else {
      const regex = new RegExp(searchPattern.source, 'gi');
      let match;
      while ((match = regex.exec(textToSearch)) !== null) {
        const context = getContextAroundMatch(textToSearch, match.index, match[0].length);
        matches.push({ match: match[0], context, index: match.index });
      }
    }
    
    return matches;
  };

  const getContextAroundMatch = (text: string, matchIndex: number, matchLength: number): string => {
    const wordsBeforeAfter = 4;
    
    // Check if the match is within a quoted string in JSON
    // Look for surrounding quotes and extract just the string value
    const beforeMatch = text.substring(0, matchIndex);
    const afterMatch = text.substring(matchIndex + matchLength);
    
    // Find the opening quote before the match
    let openQuoteIndex = -1;
    for (let i = beforeMatch.length - 1; i >= 0; i--) {
      if (beforeMatch[i] === '"' && (i === 0 || beforeMatch[i - 1] !== '\\')) {
        openQuoteIndex = i;
        break;
      }
      // Stop if we hit a closing quote (means we're not inside a string)
      if (beforeMatch[i] === '"' && i > 0 && beforeMatch[i - 1] === ':') {
        break;
      }
    }
    
    // Find the closing quote after the match
    let closeQuoteIndex = -1;
    for (let i = 0; i < afterMatch.length; i++) {
      if (afterMatch[i] === '"' && (i === 0 || afterMatch[i - 1] !== '\\')) {
        closeQuoteIndex = matchIndex + matchLength + i;
        break;
      }
    }
    
    // If we found both quotes, extract just the string content
    if (openQuoteIndex !== -1 && closeQuoteIndex !== -1) {
      const stringContent = text.substring(openQuoteIndex + 1, closeQuoteIndex);
      
      // Now get context from the clean string
      const cleanMatchIndex = matchIndex - openQuoteIndex - 1;
      const words = stringContent.split(/\s+/);
      let currentIndex = 0;
      let matchWordIndex = -1;
      
      // Find which word contains the match
      for (let i = 0; i < words.length; i++) {
        if (currentIndex <= cleanMatchIndex && cleanMatchIndex < currentIndex + words[i].length) {
          matchWordIndex = i;
          break;
        }
        currentIndex += words[i].length + 1;
      }
      
      if (matchWordIndex !== -1) {
        const startWord = Math.max(0, matchWordIndex - wordsBeforeAfter);
        const endWord = Math.min(words.length, matchWordIndex + wordsBeforeAfter + 1);
        const contextWords = words.slice(startWord, endWord);
        let context = contextWords.join(' ');
        
        // Add ellipsis if needed
        if (startWord > 0) context = '...' + context;
        if (endWord < words.length) context = context + '...';
        
        return context;
      }
    }
    
    // Fallback to original logic if not in a quoted string
    const words = text.split(/\s+/);
    let currentIndex = 0;
    let matchWordIndex = -1;
    
    // Find which word contains the match
    for (let i = 0; i < words.length; i++) {
      if (currentIndex <= matchIndex && matchIndex < currentIndex + words[i].length) {
        matchWordIndex = i;
        break;
      }
      currentIndex += words[i].length + 1; // +1 for the space
    }
    
    if (matchWordIndex === -1) {
      // Fallback to character-based context
      const start = Math.max(0, matchIndex - 100);
      const end = Math.min(text.length, matchIndex + matchLength + 100);
      return text.substring(start, end);
    }
    
    // Get words around the match
    const startWord = Math.max(0, matchWordIndex - wordsBeforeAfter);
    const endWord = Math.min(words.length, matchWordIndex + wordsBeforeAfter + 1);
    
    const contextWords = words.slice(startWord, endWord);
    let context = contextWords.join(' ');
    
    // Add ellipsis if needed
    if (startWord > 0) context = '...' + context;
    if (endWord < words.length) context = context + '...';
    
    return context;
  };

  const handleSearch = async () => {
    if (!searchInput.trim()) {
      setError('Please enter a search string or regex pattern');
      return;
    }

    if (isRegex && !validateRegex(searchInput)) {
      setError('Invalid regex pattern');
      return;
    }

    setError(null);
    setIsSearching(true);
    setSearchResults([]);

    try {
      const searchPattern = isRegex ? new RegExp(searchInput, 'gi') : searchInput;
      const results: SearchResult[] = [];
      const client = buildClient({ 
        apiToken: ctx.currentUserAccessToken!,
        environment: ctx.environment 
      });

      // Get site info to get the main locale
      const site = await client.site.find();
      const mainLocale = site.locales[0]; // First locale is typically the main locale

      // Get all item types
      const itemTypes = await client.itemTypes.list();

      for (const itemType of itemTypes) {
        // Get fields for this item type to check which are localized
        const fields = await client.fields.list(itemType.id);
        const localizedFields = new Set(
          fields
            .filter(field => field.localized)
            .map(field => field.api_key)
        );

        // Skip singleton items that don't have records
        if (itemType.singleton) {
          try {
            const singletonItem = itemType.singleton_item;
            if (!singletonItem) continue;

            // Get the full item data
            const item = await client.items.find(singletonItem.id);
            
            // Get item title using title_field from itemType
            let itemTitle = '';
            if (itemType.title_field?.id) {
              const titleField = fields.find(f => f.id === itemType.title_field!.id);
              if (titleField && item[titleField.api_key]) {
                const titleValue = item[titleField.api_key];
                // Handle localized title fields
                if (typeof titleValue === 'object' && titleValue !== null && !Array.isArray(titleValue)) {
                  // Use main locale value if available
                  const localizedValue = titleValue as Record<string, any>;
                  const localeValue = localizedValue[mainLocale] || Object.values(localizedValue)[0];
                  itemTitle = localeValue?.toString() || '';
                } else {
                  itemTitle = titleValue?.toString() || '';
                }
              }
            }
            
            // Search through all fields
            for (const [fieldApiKey, fieldValue] of Object.entries(item)) {
              if (fieldApiKey === 'id' || fieldApiKey === 'item_type' || fieldApiKey === 'meta') continue;
              
              // Check if this is a localized field
              if (localizedFields.has(fieldApiKey)) {
                // This is a localized field - it should be an object with locale keys
                if (typeof fieldValue === 'object' && fieldValue !== null) {
                  for (const [locale, localeValue] of Object.entries(fieldValue)) {
                    const matches = searchInValue(localeValue, searchPattern);
                    if (matches.length > 0) {
                      results.push({
                        itemId: item.id,
                        itemTypeId: itemType.id,
                        itemTypeName: itemType.name,
                        itemTitle: itemTitle,
                        fieldName: fieldApiKey,
                        fieldApiKey: fieldApiKey,
                        matches: matches,
                        locale: locale
                      });
                    }
                  }
                }
              } else {
                // Non-localized field - search directly in the value
                const matches = searchInValue(fieldValue, searchPattern);
                if (matches.length > 0) {
                  results.push({
                    itemId: item.id,
                    itemTypeId: itemType.id,
                    itemTypeName: itemType.name,
                    itemTitle: itemTitle,
                    fieldName: fieldApiKey,
                    fieldApiKey: fieldApiKey,
                    matches: matches
                  });
                }
              }
            }
          } catch (e) {
            console.error(`Error processing singleton ${itemType.name}:`, e);
          }
        } else {
          // For regular models, iterate through all records
          let page = 1;
          let hasMore = true;

          while (hasMore) {
            try {
              const items = await client.items.list({
                filter: {
                  type: itemType.id
                },
                page: {
                  offset: (page - 1) * 100,
                  limit: 100
                }
              });

              for (const item of items) {
                // Get item title using title_field from itemType
                let itemTitle = '';
                if (itemType.title_field?.id) {
                  const titleField = fields.find(f => f.id === itemType.title_field!.id);
                  if (titleField && item[titleField.api_key]) {
                    const titleValue = item[titleField.api_key];
                    // Handle localized title fields
                    if (typeof titleValue === 'object' && titleValue !== null && !Array.isArray(titleValue)) {
                      // Use main locale value if available
                      const localizedValue = titleValue as Record<string, any>;
                      const localeValue = localizedValue[mainLocale] || Object.values(localizedValue)[0];
                      itemTitle = localeValue?.toString() || '';
                    } else {
                      itemTitle = titleValue?.toString() || '';
                    }
                  }
                }
                
                // Search through all fields
                for (const [fieldApiKey, fieldValue] of Object.entries(item)) {
                  if (fieldApiKey === 'id' || fieldApiKey === 'item_type' || fieldApiKey === 'meta') continue;
                  
                  // Check if this is a localized field
                  if (localizedFields.has(fieldApiKey)) {
                    // This is a localized field - it should be an object with locale keys
                    if (typeof fieldValue === 'object' && fieldValue !== null) {
                      for (const [locale, localeValue] of Object.entries(fieldValue)) {
                        const matches = searchInValue(localeValue, searchPattern);
                        if (matches.length > 0) {
                          results.push({
                            itemId: item.id,
                            itemTypeId: itemType.id,
                            itemTypeName: itemType.name,
                            itemTitle: itemTitle,
                            fieldName: fieldApiKey,
                            fieldApiKey: fieldApiKey,
                            matches: matches,
                            locale: locale
                          });
                        }
                      }
                    }
                  } else {
                    // Non-localized field - search directly in the value
                    const matches = searchInValue(fieldValue, searchPattern);
                    if (matches.length > 0) {
                      results.push({
                        itemId: item.id,
                        itemTypeId: itemType.id,
                        itemTypeName: itemType.name,
                        itemTitle: itemTitle,
                        fieldName: fieldApiKey,
                        fieldApiKey: fieldApiKey,
                        matches: matches
                      });
                    }
                  }
                }
              }

              hasMore = items.length === 100;
              page++;
            } catch (e) {
              console.error(`Error processing items for ${itemType.name}:`, e);
              hasMore = false;
            }
          }
        }
      }

      // Group results by record
      const groupedResultsMap = new Map<string, SearchResult>();
      
      results.forEach(result => {
        const key = `${result.itemId}-${result.fieldApiKey}`;
        const existing = groupedResultsMap.get(key);
        
        if (!existing) {
          if (result.locale) {
            // First result with locale - create localeMatches
            groupedResultsMap.set(key, {
              itemId: result.itemId,
              itemTypeId: result.itemTypeId,
              itemTypeName: result.itemTypeName,
              itemTitle: result.itemTitle,
              fieldName: result.fieldName,
              fieldApiKey: result.fieldApiKey,
              localeMatches: { [result.locale]: result.matches || [] }
            });
          } else {
            // Non-localized result
            groupedResultsMap.set(key, result);
          }
        } else {
          if (result.locale) {
            // Add to existing localeMatches
            if (existing.localeMatches) {
              existing.localeMatches[result.locale] = result.matches || [];
            } else {
              // Convert existing non-locale to locale structure
              existing.localeMatches = { [result.locale]: result.matches || [] };
              delete existing.matches;
              delete existing.locale;
            }
          }
        }
      });

      setSearchResults(Array.from(groupedResultsMap.values()));
      
      if (results.length === 0) {
        ctx.notice('No matches found');
      } else {
        ctx.notice(`Found ${results.length} matches across your content`);
      }
    } catch (error: any) {
      setError(`Search error: ${error.message}`);
      ctx.alert('An error occurred during search. Please check the console for details.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Canvas ctx={ctx}>
      <div className={s.container}>
        <div className={s.header}>
          <h2>Bulk Search & Replace</h2>
          <p>Search for strings or regex patterns across all your DatoCMS records</p>
        </div>

        <form className={s.searchSection} onSubmit={(e) => {
          e.preventDefault();
          if (!isSearching && searchInput.trim()) {
            handleSearch();
          }
        }}>
          <div className={s.inputGroup}>
            <TextField
              id="search-pattern"
              name="search-pattern"
              label="Search Pattern"
              value={searchInput}
              onChange={setSearchInput}
              placeholder={isRegex ? "Enter regex pattern (e.g., \\d{3}-\\d{4})" : "Enter search string"}
              hint={isRegex ? "Using regular expression mode" : "Using exact string match"}
            />
          </div>

          <div className={s.controls}>
            <label className={s.checkbox}>
              <input
                type="checkbox"
                checked={isRegex}
                onChange={(e) => setIsRegex(e.target.checked)}
              />
              Use Regular Expression
            </label>

            <Button
              onClick={handleSearch}
              buttonType="primary"
              disabled={isSearching || !searchInput.trim()}
            >
              {isSearching ? <Spinner size={20} /> : 'Search for Matches'}
            </Button>
          </div>

          {error && (
            <div className={s.error}>
              {error}
            </div>
          )}
        </form>

        {searchResults.length > 0 && (
          <div className={s.results}>
            <h3>
              Search Results ({searchResults.length} record{searchResults.length !== 1 ? 's' : ''}, {searchResults.reduce((sum, r) => {
                if (r.localeMatches) {
                  return sum + Object.values(r.localeMatches).reduce((localeSum, matches) => localeSum + matches.length, 0);
                }
                return sum + (r.matches?.length || 0);
              }, 0)} match{searchResults.reduce((sum, r) => {
                if (r.localeMatches) {
                  return sum + Object.values(r.localeMatches).reduce((localeSum, matches) => localeSum + matches.length, 0);
                }
                return sum + (r.matches?.length || 0);
              }, 0) !== 1 ? 'es' : ''})
            </h3>
            <div className={s.resultsList}>
              {searchResults.map((result, index) => (
                <div key={index} className={s.resultItem}>
                  <div className={s.resultHeader}>
                    <strong>{result.itemTypeName}</strong>
                    <span className={s.recordInfo}>
                      {result.itemTitle ? `${result.itemTitle} ` : ''}
                      <span className={s.recordId}>({result.itemId})</span>
                    </span>
                    <span className={s.fieldName}>Field: {result.fieldApiKey}</span>
                  </div>
                  <div className={s.resultContent}>
                    {result.localeMatches ? (
                      // Localized field - show matches grouped by locale
                      Object.entries(result.localeMatches).map(([locale, localeMatches]) => (
                        localeMatches.map((match, matchIndex) => (
                          <div key={`${locale}-${matchIndex}`} className={s.matchContextWrapper}>
                            <div className={s.matchContext}>
                              <HighlightedText 
                                text={match.context} 
                                searchPattern={isRegex ? new RegExp(searchInput, 'gi') : searchInput} 
                              />
                            </div>
                            <span className={s.localeTag}>{locale.toUpperCase()}</span>
                          </div>
                        ))
                      )).flat()
                    ) : (
                      // Non-localized field
                      result.matches?.map((match, matchIndex) => (
                        <div key={matchIndex} className={s.matchContext}>
                          <HighlightedText 
                            text={match.context} 
                            searchPattern={isRegex ? new RegExp(searchInput, 'gi') : searchInput} 
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Canvas>
  );
}
