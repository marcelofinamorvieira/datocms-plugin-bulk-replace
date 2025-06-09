import type { RenderConfigScreenCtx } from 'datocms-plugin-sdk';
import { Canvas, Button, TextField, Spinner } from 'datocms-react-ui';
import { buildClient } from '@datocms/cma-client-browser';
import { useState, useEffect } from 'react';
import s from './styles.module.css';
import { logger } from '../utils/logger';

type Props = {
  ctx: RenderConfigScreenCtx;
};

type FieldMatch = {
  fieldName: string;
  fieldApiKey: string;
  matches?: { match: string; context: string; index: number }[];
  locale?: string;
  localeMatches?: Record<string, { match: string; context: string; index: number }[]>;
};

type SearchResult = {
  itemId: string;
  itemTypeId: string;
  itemTypeName: string;
  itemTitle: string;
  fields: FieldMatch[];
  replaced?: boolean;
};

// Intermediate type for results before grouping
type IntermediateResult = {
  itemId: string;
  itemTypeId: string;
  itemTypeName: string;
  itemTitle: string;
  fieldApiKey: string;
  matches?: { match: string; context: string; index: number }[];
  locale?: string;
};

type ReplaceProgress = {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
};

const HighlightedText: React.FC<{ text: string; searchPattern: string }> = ({ text, searchPattern }) => {
  if (!text || !searchPattern) {
    return <>{text || ''}</>;
  }

  const parts: { text: string; highlight: boolean }[] = [];
  
  // Create a case-insensitive search pattern
  const escapedPattern = searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedPattern})`, 'gi');
  
  // Split the text by the search pattern, keeping the delimiters
  const segments = text.split(regex);
  
  segments.forEach((segment) => {
    if (segment) {
      // Check if this segment matches the search pattern (case-insensitive)
      const isMatch = segment.toLowerCase() === searchPattern.toLowerCase();
      parts.push({ text: segment, highlight: isMatch });
    }
  });
  
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
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [replaceInput, setReplaceInput] = useState('');
  const [replaceProgress, setReplaceProgress] = useState<ReplaceProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: false
  });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [replaceAll, setReplaceAll] = useState(false);
  const [replaceAllManuallyUnchecked, setReplaceAllManuallyUnchecked] = useState(false);

  // Handle Replace All checkbox changes
  useEffect(() => {
    if (replaceAll) {
      // Check all non-replaced items
      const allKeys = searchResults
        .filter(r => !r.replaced)
        .map(r => r.itemId);
      setSelectedItems(new Set(allKeys));
      logger.debug('Replace All checked - selected all items', {
        count: allKeys.length
      });
    } else if (replaceAllManuallyUnchecked) {
      // Only clear all selections when user manually unchecks Replace All
      setSelectedItems(new Set());
      setReplaceAllManuallyUnchecked(false);
      logger.debug('Replace All unchecked - cleared all selections');
    }
  }, [replaceAll, searchResults, replaceAllManuallyUnchecked]);


  const searchInValue = (value: any, searchPattern: string): { match: string; context: string; index: number }[] => {
    const matches: { match: string; context: string; index: number }[] = [];
    
    let textToSearch = '';
    if (typeof value === 'string') {
      textToSearch = value;
    } else if (typeof value === 'object' && value !== null) {
      textToSearch = JSON.stringify(value);
    } else {
      return matches;
    }

    let index = textToSearch.toLowerCase().indexOf(searchPattern.toLowerCase());
    while (index !== -1) {
      const match = textToSearch.substring(index, index + searchPattern.length);
      const context = getContextAroundMatch(textToSearch, index, match.length);
      matches.push({ match, context, index });
      index = textToSearch.toLowerCase().indexOf(searchPattern.toLowerCase(), index + 1);
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
    logger.info('Search initiated', {
      pattern: searchInput,
      timestamp: new Date().toISOString()
    });

    if (!searchInput.trim()) {
      setError('Please enter a search string');
      logger.warn('Search attempted with empty pattern');
      return;
    }

    setError(null);
    setIsSearching(true);
    setSearchResults([]);
    logger.time('searchOperation');

    try {
      const results: IntermediateResult[] = [];
      const client = buildClient({ 
        apiToken: ctx.currentUserAccessToken!,
        environment: ctx.environment 
      });

      logger.debug('API client initialized', {
        environment: ctx.environment,
        hasToken: !!ctx.currentUserAccessToken
      });

      // Get site info to get the main locale
      const site = await client.site.find();
      const mainLocale = site.locales[0]; // First locale is typically the main locale
      logger.debug('Site info retrieved', {
        locales: site.locales,
        mainLocale
      });

      // Single API call to search across ALL models!
      const itemTypeCache = new Map(); // Cache for item types
      const fieldsCache = new Map(); // Cache for fields per item type

      // Using the built-in async iterator to fetch all pages
      logger.debug('Starting paginated search with query filter');
      
      // Use the async iterator approach for pagination
      const allItems: any[] = [];
      for await (const item of client.items.listPagedIterator({
        filter: {
          query: searchInput  // Search across all models at once!
        },
        per_page: 100  // Use per_page instead of page.limit
      })) {
        allItems.push(item);
      }
      
      logger.debug(`Retrieved ${allItems.length} total matching items`);

      // Process all the found items
      for (const item of allItems) {
            const itemTypeId = item.item_type.id;
            
            // Get item type info (fetch only if not cached)
            let itemType = itemTypeCache.get(itemTypeId);
            if (!itemType) {
              itemType = await client.itemTypes.find(itemTypeId);
              itemTypeCache.set(itemTypeId, itemType);
            }

            // Get fields for this item type (fetch only if not cached)
            let fields = fieldsCache.get(itemTypeId);
            if (!fields) {
              fields = await client.fields.list(itemTypeId);
              fieldsCache.set(itemTypeId, fields);
            }

            const localizedFields = new Set(
              fields
                .filter((field: any) => field.localized)
                .map((field: any) => field.api_key)
            );

            // Get item title
            let itemTitle = '';
            if (itemType.title_field?.id) {
              const titleField = fields.find((f: any) => f.id === itemType.title_field!.id);
              if (titleField && item[titleField.api_key]) {
                const titleValue = item[titleField.api_key];
                if (typeof titleValue === 'object' && titleValue !== null && !Array.isArray(titleValue)) {
                  const localizedValue = titleValue as Record<string, any>;
                  const localeValue = localizedValue[mainLocale] || Object.values(localizedValue)[0];
                  itemTitle = localeValue?.toString() || '';
                } else {
                  itemTitle = titleValue?.toString() || '';
                }
              }
            }

            // Search through all fields to find exact matches for highlighting
            for (const [fieldApiKey, fieldValue] of Object.entries(item)) {
              if (fieldApiKey === 'id' || fieldApiKey === 'item_type' || fieldApiKey === 'meta') continue;
              
              if (localizedFields.has(fieldApiKey)) {
                // Localized field
                if (typeof fieldValue === 'object' && fieldValue !== null) {
                  for (const [locale, localeValue] of Object.entries(fieldValue)) {
                    const matches = searchInValue(localeValue, searchInput);
                    if (matches.length > 0) {
                      results.push({
                        itemId: item.id,
                        itemTypeId: itemType.id,
                        itemTypeName: itemType.name,
                        itemTitle: itemTitle,
                        fieldApiKey: fieldApiKey,
                        matches: matches,
                        locale: locale
                      });
                    }
                  }
                }
              } else {
                // Non-localized field
                const matches = searchInValue(fieldValue, searchInput);
                if (matches.length > 0) {
                  results.push({
                    itemId: item.id,
                    itemTypeId: itemType.id,
                    itemTypeName: itemType.name,
                    itemTitle: itemTitle,
                    fieldApiKey: fieldApiKey,
                    matches: matches
                  });
                }
              }
            }
          }

      // Group results by record (itemId only)
      const groupedResultsMap = new Map<string, SearchResult>();
      
      results.forEach(result => {
        const existing = groupedResultsMap.get(result.itemId);
        
        if (!existing) {
          // Create new SearchResult with first field
          const fieldMatch: FieldMatch = {
            fieldName: result.fieldApiKey,
            fieldApiKey: result.fieldApiKey
          };
          
          if (result.locale) {
            fieldMatch.localeMatches = { [result.locale]: result.matches || [] };
          } else {
            fieldMatch.matches = result.matches;
          }
          
          groupedResultsMap.set(result.itemId, {
            itemId: result.itemId,
            itemTypeId: result.itemTypeId,
            itemTypeName: result.itemTypeName,
            itemTitle: result.itemTitle,
            fields: [fieldMatch],
            replaced: false
          });
        } else {
          // Add to existing record's fields
          const existingField = existing.fields.find(f => f.fieldApiKey === result.fieldApiKey);
          
          if (existingField) {
            // Add to existing field's locales
            if (result.locale) {
              if (!existingField.localeMatches) {
                existingField.localeMatches = {};
              }
              existingField.localeMatches[result.locale] = result.matches || [];
            }
          } else {
            // New field for this record
            const fieldMatch: FieldMatch = {
              fieldName: result.fieldApiKey,
              fieldApiKey: result.fieldApiKey
            };
            
            if (result.locale) {
              fieldMatch.localeMatches = { [result.locale]: result.matches || [] };
            } else {
              fieldMatch.matches = result.matches;
            }
            
            existing.fields.push(fieldMatch);
          }
        }
      });

      const finalResults = Array.from(groupedResultsMap.values());
      setSearchResults(finalResults);
      
      logger.timeEnd('searchOperation');
      logger.info('Search completed', {
        totalMatches: results.length,
        uniqueRecords: finalResults.length,
        searchPattern: searchInput
      });
      
      if (results.length === 0) {
        ctx.notice('No matches found');
      } else {
        ctx.notice(`Found ${results.length} matches across your content`);
      }
    } catch (error: any) {
      logger.error('Search operation failed', {
        error: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      setError(`Search error: ${error.message}`);
      ctx.alert('An error occurred during search. Please check the console for details.');
    } finally {
      setIsSearching(false);
      logger.timeEnd('searchOperation');
    }
  };

  const performReplace = async (result: SearchResult, newValue: string): Promise<boolean> => {
    logger.group(`Replacing in item ${result.itemId}`);
    logger.info('Starting replace operation', {
      itemId: result.itemId,
      itemType: result.itemTypeName,
      fieldsCount: result.fields.length,
      searchPattern: searchInput,
      replaceWith: newValue
    });

    try {
      const client = buildClient({ 
        apiToken: ctx.currentUserAccessToken!,
        environment: ctx.environment 
      });

      // Fetch the current item
      logger.debug('Fetching current item data');
      const item = await client.items.find(result.itemId);
      logger.debug('Item fetched successfully', {
        itemId: item.id,
        itemType: item.item_type,
        fields: Object.keys(item)
      });
      
      // Prepare update payload for all fields at once
      const updatePayload: Record<string, any> = {};
      
      // Process each field that has matches
      for (const field of result.fields) {
        let fieldValue = item[field.fieldApiKey];
        logger.debug('Processing field', {
          fieldApiKey: field.fieldApiKey,
          valueType: typeof fieldValue,
          hasLocaleMatches: !!field.localeMatches
        });
        
        if (field.localeMatches) {
          logger.debug('Processing localized field');
          // Handle localized field
          if (typeof fieldValue === 'object' && fieldValue !== null) {
            const updatedValue = { ...fieldValue } as Record<string, any>;
            
            // Update each locale that had matches
            for (const [locale] of Object.entries(field.localeMatches)) {
              let localeValue = updatedValue[locale];
              logger.debug(`Processing locale: ${locale}`, {
                valueType: typeof localeValue,
                hasValue: !!localeValue
              });
              
              if (typeof localeValue === 'string') {
                // Simple string replacement
                const originalValue = localeValue;
                // Replace all occurrences
                updatedValue[locale] = localeValue.split(searchInput).join(newValue);
                logger.debug(`Replaced string value in locale ${locale}`, {
                  original: originalValue.substring(0, 100),
                  updated: updatedValue[locale].substring(0, 100)
                });
              } else if (typeof localeValue === 'object' && localeValue !== null) {
                // Handle JSON content
                let jsonString = JSON.stringify(localeValue);
                const originalJson = jsonString;
                jsonString = jsonString.split(searchInput).join(newValue);
                updatedValue[locale] = JSON.parse(jsonString);
                logger.debug(`Replaced in JSON value for locale ${locale}`, {
                  originalLength: originalJson.length,
                  updatedLength: jsonString.length,
                  replacementCount: (originalJson.length - jsonString.length) / (searchInput.length - newValue.length)
                });
              }
            }
            
            updatePayload[field.fieldApiKey] = updatedValue;
          } else {
            logger.warn('Localized field value is not an object', {
              actualType: typeof fieldValue,
              fieldValue
            });
          }
        } else {
          logger.debug('Processing non-localized field');
          // Handle non-localized field
          if (typeof fieldValue === 'string') {
            // Simple string replacement
            const originalValue = fieldValue;
            // Replace all occurrences
            fieldValue = fieldValue.split(searchInput).join(newValue);
            updatePayload[field.fieldApiKey] = fieldValue;
            logger.debug('Replaced string value', {
              original: originalValue.substring(0, 100),
              updated: (fieldValue as string).substring(0, 100),
              originalLength: originalValue.length,
              updatedLength: (fieldValue as string).length
            });
          } else if (typeof fieldValue === 'object' && fieldValue !== null) {
            // Handle JSON content
            let jsonString = JSON.stringify(fieldValue);
            const originalJson = jsonString;
            jsonString = jsonString.split(searchInput).join(newValue);
            fieldValue = JSON.parse(jsonString);
            updatePayload[field.fieldApiKey] = fieldValue;
            logger.debug('Replaced in JSON value', {
              originalLength: originalJson.length,
              updatedLength: jsonString.length,
              fieldType: Array.isArray(fieldValue) ? 'array' : 'object'
            });
          } else {
            logger.warn('Field value is neither string nor object', {
              actualType: typeof fieldValue,
              fieldValue
            });
          }
        }
      }

      logger.info('Preparing to update item', {
        itemId: result.itemId,
        fieldsToUpdate: Object.keys(updatePayload),
        fieldsCount: Object.keys(updatePayload).length
      });

      // Log the exact API call details
      logger.debug('API Update Request', {
        method: 'PUT',
        endpoint: `items/${result.itemId}`,
        payloadFields: Object.keys(updatePayload)
      });

      // Update the item with all changed fields at once
      logger.debug('Sending update request to DatoCMS API');
      const updateResponse = await client.items.update(result.itemId, updatePayload);

      logger.info('Update successful', {
        itemId: result.itemId,
        responseId: updateResponse.id,
        responseType: updateResponse.item_type,
        updatedFields: Object.keys(updatePayload)
      });
      
      logger.groupEnd();
      return true;
    } catch (error: any) {
      logger.error('Replace operation failed', {
        itemId: result.itemId,
        fieldsAttempted: result.fields.map(f => f.fieldApiKey),
        errorMessage: error.message,
        errorType: error.name,
        statusCode: error.response?.status,
        responseData: error.response?.data,
        responseHeaders: error.response?.headers,
        stack: error.stack
      });

      // Log specific API error details if available
      if (error.response?.data) {
        logger.error('API Error Response', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data,
          errors: error.response.data.errors || error.response.data.error
        });
      }

      logger.groupEnd();
      return false;
    }
  };

  const handleReplace = async () => {
    logger.info('Replace operation initiated', {
      replaceAll,
      selectedCount: selectedItems.size,
      totalResults: searchResults.length,
      replaceWith: replaceInput
    });

    if (!replaceInput && replaceInput !== '') {
      setError('Please enter a replacement string');
      logger.warn('Replace attempted without replacement string');
      return;
    }

    const itemsToReplace = replaceAll 
      ? searchResults 
      : searchResults.filter(r => selectedItems.has(r.itemId));

    logger.debug('Items to replace', {
      count: itemsToReplace.length,
      itemIds: itemsToReplace.map(r => r.itemId)
    });

    if (itemsToReplace.length === 0) {
      setError('Please select items to replace or check "Replace All"');
      logger.warn('No items selected for replacement');
      return;
    }

    // Confirm with user using DatoCMS confirmation dialog
    const confirmed = await ctx.openConfirm({
      title: replaceAll 
        ? `Replace in all ${searchResults.length} results?`
        : `Replace in ${itemsToReplace.length} selected items?`,
      content: `This will replace "${searchInput}" with "${replaceInput}" in the selected records. This action cannot be undone.`,
      cancel: {
        label: 'Cancel',
        value: false
      },
      choices: [{
        label: 'Replace',
        value: true,
        intent: 'negative' // Since it's a destructive action
      }]
    });

    if (!confirmed) {
      logger.info('User cancelled replace operation');
      return;
    }

    logger.info('User confirmed replace operation');

    setError(null);
    setReplaceProgress({
      total: itemsToReplace.length,
      completed: 0,
      failed: 0,
      inProgress: true
    });

    let completed = 0;
    let failed = 0;

    // Process replacements in batches to avoid rate limits
    const batchSize = 5;
    logger.info('Starting batch processing', {
      totalItems: itemsToReplace.length,
      batchSize,
      totalBatches: Math.ceil(itemsToReplace.length / batchSize)
    });

    logger.time('replaceOperation');

    for (let i = 0; i < itemsToReplace.length; i += batchSize) {
      const batch = itemsToReplace.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      logger.debug(`Processing batch ${batchNumber}`, {
        batchSize: batch.length,
        itemIds: batch.map(r => r.itemId)
      });
      
      await Promise.all(
        batch.map(async (result) => {
          const success = await performReplace(result, replaceInput);
          if (success) {
            completed++;
            // Mark as replaced in the UI
            result.replaced = true;
            logger.debug(`Item ${result.itemId} replaced successfully`);
          } else {
            failed++;
            logger.warn(`Item ${result.itemId} replacement failed`);
          }
          
          setReplaceProgress(prev => ({
            ...prev,
            completed: completed,
            failed: failed
          }));
          
          return success;
        })
      );
      
      logger.debug(`Batch ${batchNumber} completed`, {
        completed,
        failed,
        remaining: itemsToReplace.length - (i + batch.length)
      });
    }

    logger.timeEnd('replaceOperation');

    setReplaceProgress(prev => ({
      ...prev,
      inProgress: false
    }));

    // Update search results to show replaced items
    setSearchResults([...searchResults]);

    logger.info('Replace operation completed', {
      total: itemsToReplace.length,
      completed,
      failed,
      successRate: `${((completed / itemsToReplace.length) * 100).toFixed(1)}%`
    });

    if (failed === 0) {
      ctx.notice(`Successfully replaced in ${completed} items`);
    } else {
      ctx.alert(`Replaced in ${completed} items, failed in ${failed} items`);
      logger.warn('Some replacements failed', {
        failedCount: failed,
        successCount: completed
      });
    }

    // Clear selections
    setSelectedItems(new Set());
    setReplaceAll(false);
  };

  return (
    <Canvas ctx={ctx}>
      <div className={s.container}>
        <div className={s.header}>
          <div className={s.headerContent}>
            <div className={s.headerIcon}></div>
            <h2>Bulk Search & Replace</h2>
            <p>Search for strings across all your DatoCMS records</p>
          </div>
        </div>

        <div className={s.cardsWrapper}>
          <form className={s.searchSection} onSubmit={(e) => {
            e.preventDefault();
            if (!isSearching && searchInput.trim()) {
              handleSearch();
            }
          }}>
            <div className={s.searchCard}>
              <div className={s.searchIcon}>🔍</div>
              <div className={s.searchContent}>
                <div className={s.inputGroup}>
                  <TextField
                    id="search-pattern"
                    name="search-pattern"
                    label="Search String"
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder="Enter search string"
                    hint="Search is case-insensitive and finds all occurrences"
                  />
                </div>

                <div className={s.controls}>
                  <Button
                    onClick={handleSearch}
                    buttonType="primary"
                    buttonSize="l"
                    disabled={isSearching || !searchInput.trim()}
                    leftIcon={!isSearching ? '🔎' : undefined}
                    fullWidth
                  >
                    {isSearching ? <><Spinner size={20} /> Searching...</> : 'Search for Matches'}
                  </Button>
                </div>
              </div>
            </div>
          </form>

          <div className={s.replaceSection}>
            <div className={s.replaceCard}>
              <div className={s.replaceIcon}>✏️</div>
              <div className={s.replaceContent}>
                <div className={s.inputGroup}>
                  <TextField
                    id="replace-string"
                    name="replace-string"
                    label="Replace with"
                    value={replaceInput}
                    onChange={setReplaceInput}
                    placeholder="Enter replacement string"
                    hint="This will replace all occurrences of the search pattern"
                  />
                </div>
                
                <div className={s.replaceActions}>
                  <Button
                    onClick={handleReplace}
                    buttonType={searchResults.length === 0 ? "muted" : "primary"}
                    buttonSize="l"
                    disabled={replaceProgress.inProgress || searchResults.length === 0 || selectedItems.size === 0}
                    fullWidth
                  >
                    {replaceProgress.inProgress ? (
                      <>
                        <Spinner size={20} />
                        Replacing... ({replaceProgress.completed}/{replaceProgress.total})
                      </>
                    ) : (
                      searchResults.length === 0 ? 'Replace Selected (0)' : `Replace Selected (${selectedItems.size})`
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className={s.error}>
            {error}
          </div>
        )}

        {replaceProgress.total > 0 && !replaceProgress.inProgress && (
          <div className={s.replaceStatus}>
            <p>
              Replacement complete: {replaceProgress.completed} successful, {replaceProgress.failed} failed
            </p>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className={s.results}>
            
            <h3>
              Search Results ({searchResults.length} record{searchResults.length !== 1 ? 's' : ''}, {searchResults.reduce((sum, r) => {
                return sum + r.fields.reduce((fieldSum, field) => {
                  if (field.localeMatches) {
                    return fieldSum + Object.values(field.localeMatches).reduce((localeSum, matches) => localeSum + matches.length, 0);
                  }
                  return fieldSum + (field.matches?.length || 0);
                }, 0);
              }, 0)} match{searchResults.reduce((sum, r) => {
                return sum + r.fields.reduce((fieldSum, field) => {
                  if (field.localeMatches) {
                    return fieldSum + Object.values(field.localeMatches).reduce((localeSum, matches) => localeSum + matches.length, 0);
                  }
                  return fieldSum + (field.matches?.length || 0);
                }, 0);
              }, 0) !== 1 ? 'es' : ''})
            </h3>
            
            <div className={s.selectAllWrapper}>
              <Button
                onClick={() => {
                  if (searchResults.length > 0) {
                    if (selectedItems.size === searchResults.length) {
                      // Deselect all
                      setSelectedItems(new Set());
                      setReplaceAll(false);
                    } else {
                      // Select all
                      const allIds = new Set(searchResults.map(r => r.itemId));
                      setSelectedItems(allIds);
                      setReplaceAll(true);
                    }
                  }
                }}
                buttonType="muted"
                buttonSize="l"
                disabled={replaceProgress.inProgress}
                fullWidth
              >
                {selectedItems.size === searchResults.length && searchResults.length > 0 ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            
            <div className={s.resultsList}>
              {searchResults.map((result, index) => {
                const isExpanded = expandedItems.has(result.itemId);
                const totalMatches = result.fields.reduce((sum, field) => {
                  if (field.localeMatches) {
                    return sum + Object.values(field.localeMatches).reduce((localeSum, matches) => localeSum + matches.length, 0);
                  }
                  return sum + (field.matches?.length || 0);
                }, 0);
                
                return (
                  <div 
                    key={index} 
                    className={`${s.resultItem} ${result.replaced ? s.replacedItem : ''} ${selectedItems.has(result.itemId) && !result.replaced ? s.selectedItem : ''}`}
                  >
                    <div className={s.resultItemHeader}>
                      <div className={s.resultHeader}>
                        <div className={s.headerLeft}>
                          <button
                            className={`${s.selectionButton} ${selectedItems.has(result.itemId) ? s.selected : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!replaceProgress.inProgress && !result.replaced) {
                                const newSelected = new Set(selectedItems);
                                if (selectedItems.has(result.itemId)) {
                                  newSelected.delete(result.itemId);
                                  // If unchecking an item while Replace All is active, uncheck Replace All
                                  if (replaceAll) {
                                    setReplaceAll(false);
                                    logger.debug('Individual item unchecked - disabling Replace All');
                                  }
                                } else {
                                  newSelected.add(result.itemId);
                                }
                                setSelectedItems(newSelected);
                                logger.debug('Selection changed', {
                                  itemId: result.itemId,
                                  selected: newSelected.has(result.itemId),
                                  totalSelected: newSelected.size
                                });
                              }
                            }}
                            disabled={replaceProgress.inProgress || result.replaced}
                            aria-label={selectedItems.has(result.itemId) ? 'Deselect item' : 'Select item'}
                          >
                            {selectedItems.has(result.itemId) ? '✓' : ''}
                          </button>
                          {(totalMatches > 1 || result.fields.length > 1) && (
                            <button
                              className={s.expandButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newExpanded = new Set(expandedItems);
                                if (isExpanded) {
                                  newExpanded.delete(result.itemId);
                                } else {
                                  newExpanded.add(result.itemId);
                                }
                                setExpandedItems(newExpanded);
                              }}
                              aria-label={isExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                          )}
                        </div>
                        <div 
                          className={s.headerContent}
                          onClick={() => {
                            if (totalMatches > 1 || result.fields.length > 1) {
                              const newExpanded = new Set(expandedItems);
                              if (isExpanded) {
                                newExpanded.delete(result.itemId);
                              } else {
                                newExpanded.add(result.itemId);
                              }
                              setExpandedItems(newExpanded);
                            }
                          }}
                          style={{ cursor: (totalMatches > 1 || result.fields.length > 1) ? 'pointer' : 'default' }}
                        >
                          <div className={s.headerTop}>
                            <span className={s.modelType}>
                              <span className={s.modelIcon}>📄</span>
                              {result.itemTypeName}
                            </span>
                            <span className={s.recordId}>{result.itemId}</span>
                          </div>
                          <div className={s.headerMain}>
                            <span className={s.recordTitle}>
                              {result.itemTitle || 'Untitled'}
                            </span>
                          </div>
                          <div className={s.headerStats}>
                            <span className={s.matchCount}>
                              {totalMatches} {totalMatches === 1 ? 'match' : 'matches'}
                            </span>
                            {result.fields.length > 1 && (
                              <span className={s.fieldCount}>
                                {result.fields.length} fields
                              </span>
                            )}
                            {result.replaced && <span className={s.replacedBadge}>Replaced</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={s.resultContent}>
                      {result.fields.map((field, fieldIndex) => {
                        const fieldMatches: Array<{locale?: string; match: { match: string; context: string; index: number }; key: string}> = field.localeMatches 
                          ? Object.entries(field.localeMatches).flatMap(([locale, localeMatches]) => 
                              localeMatches.map((match, matchIndex) => ({ locale, match, key: `${locale}-${matchIndex}` }))
                            )
                          : (field.matches || []).map((match, matchIndex) => ({ match, key: `match-${matchIndex}` }));
                        
                        const shouldShowField = isExpanded || fieldIndex === 0;
                        const matchesToShow = isExpanded ? fieldMatches : fieldMatches.slice(0, 1);
                        
                        if (!shouldShowField && fieldIndex > 0) return null;
                        
                        return (
                          <div key={field.fieldApiKey} className={s.fieldSection}>
                            {result.fields.length > 1 && (
                              <div className={s.fieldHeader}>
                                <span className={s.fieldName}>{field.fieldApiKey}</span>
                              </div>
                            )}
                            {field.localeMatches ? (
                              // Localized field - show matches grouped by locale
                              <>
                                {matchesToShow.map((item) => (
                                  <div key={item.key} className={s.matchContextWrapper}>
                                    <div className={s.matchContext}>
                                      <HighlightedText 
                                        text={item.match.context} 
                                        searchPattern={searchInput} 
                                      />
                                    </div>
                                    <span className={s.localeTag}>{(item.locale || '').toUpperCase()}</span>
                                  </div>
                                ))}
                                {!isExpanded && fieldMatches.length > 1 && (
                                  <div className={s.moreMatchesSection}>
                                    <div className={s.moreFields}>
                                      ...and {fieldMatches.length - 1} more {fieldMatches.length - 1 === 1 ? 'match' : 'matches'}
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              // Non-localized field
                              <>
                                {matchesToShow.map(({ match, key }) => (
                                  <div key={key} className={s.matchContextWrapper}>
                                    <div className={s.matchContext}>
                                      <HighlightedText 
                                        text={match.context} 
                                        searchPattern={searchInput} 
                                      />
                                    </div>
                                  </div>
                                ))}
                                {!isExpanded && fieldMatches.length > 1 && (
                                  <div className={s.moreMatchesSection}>
                                    <div className={s.moreFields}>
                                      ...and {fieldMatches.length - 1} more {fieldMatches.length - 1 === 1 ? 'match' : 'matches'}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                      {!isExpanded && result.fields.length > 1 && (
                        <div className={s.moreFields}>
                          ...and {result.fields.length - 1} more field{result.fields.length - 1 > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Canvas>
  );
}
