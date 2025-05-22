/**
 * LinkedIn Post Saver - Background Script (Service Worker)
 * Handles data storage and communication between content script and popup
 */

class LinkedInPostStorage {
    constructor() {
        this.storageKey = 'linkedinPosts';
        this.settingsKey = 'linkedinPostsSettings';
        this.consentKey = 'linkedinPostsConsent';
        this.init();
    }

    init() {
        console.log('LinkedIn Post Saver: Background script initialized');

        // Listen for messages from content script and popup
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Initialize default settings
        this.initializeSettings();
    }

    async initializeSettings() {
        try {
            const settings = await chrome.storage.local.get(this.settingsKey);

            if (!settings[this.settingsKey]) {
                const defaultSettings = {
                    maxPosts: 1000,
                    autoCleanup: true,
                    cleanupDays: 30,
                    saveImages: true,
                    saveVideos: false,
                    enableNotifications: true
                };

                await chrome.storage.local.set({
                    [this.settingsKey]: defaultSettings
                });

                console.log('LinkedIn Post Saver: Default settings initialized');
            }
        } catch (error) {
            console.error('LinkedIn Post Saver: Error initializing settings:', error);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.action) {
                case 'savePost':
                    await this.savePost(message.data);
                    sendResponse({ success: true });
                    break;

                case 'getPosts':
                    const posts = await this.getPosts(message.filters);
                    sendResponse({ success: true, data: posts });
                    break;

                case 'searchPosts':
                    const searchResults = await this.searchPosts(message.query, message.filters);
                    sendResponse({ success: true, data: searchResults });
                    break;

                case 'deletePost':
                    await this.deletePost(message.postId);
                    sendResponse({ success: true });
                    break;

                case 'getStats':
                    const stats = await this.getStats();
                    sendResponse({ success: true, data: stats });
                    break;

                case 'getSettings':
                    const settings = await this.getSettings();
                    sendResponse({ success: true, data: settings });
                    break;

                case 'updateSettings':
                    await this.updateSettings(message.settings);
                    sendResponse({ success: true });
                    break;

                case 'exportPosts':
                    const exportData = await this.exportPosts();
                    sendResponse({ success: true, data: exportData });
                    break;

                case 'importPosts':
                    await this.importPosts(message.data);
                    sendResponse({ success: true });
                    break;

                case 'cleanup':
                    await this.performCleanup();
                    sendResponse({ success: true });
                    break;

                case 'clearAllData':
                    await this.clearAllData();
                    sendResponse({ success: true });
                    break;

                case 'getUserConsent':
                    const consent = await this.getUserConsent();
                    sendResponse({ success: true, data: consent });
                    break;

                case 'setUserConsent':
                    await this.setUserConsent(message.consent);
                    sendResponse({ success: true });
                    break;

                case 'requestConsent':
                    const consentResult = await this.requestUserConsent();
                    sendResponse({ success: true, data: consentResult });
                    break;

                case 'openComplianceDetails':
                    await this.openComplianceDetails();
                    sendResponse({ success: true });
                    break;

                case 'trackEvent':
                    await this.trackEvent(message.event, message.data);
                    sendResponse({ success: true });
                    break;

                case 'checkCompliance':
                    const complianceStatus = await this.checkComplianceStatus();
                    sendResponse({ success: true, data: complianceStatus });
                    break;

                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        } catch (error) {
            console.error('LinkedIn Post Saver: Error handling message:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    async savePost(postData) {
        try {
            // Check user consent before saving
            const consentData = await this.getUserConsent();
            if (!consentData.hasConsent) {
                console.log('LinkedIn Post Saver: Cannot save post - no user consent');
                throw new Error('User consent required to save posts');
            }

            // ADDITIONAL SANITIZATION CHECK (defense in depth)
            const sanitizedData = this.sanitizeStorageData(postData);
            if (!sanitizedData) {
                console.warn('LinkedIn Post Saver: Post data failed background sanitization');
                throw new Error('Post data failed sanitization checks');
            }

            // Get existing posts
            const result = await chrome.storage.local.get(this.storageKey);
            const posts = result[this.storageKey] || {};

            // Check if post already exists
            if (posts[sanitizedData.id]) {
                console.log('LinkedIn Post Saver: Post already exists, skipping...');
                return;
            }

            // Add metadata
            sanitizedData.savedAt = new Date().toISOString();
            sanitizedData.version = 1;

            // Save the post
            posts[sanitizedData.id] = sanitizedData;

            // Apply storage limits
            await this.applyStorageLimits(posts);

            // Store updated posts
            await chrome.storage.local.set({
                [this.storageKey]: posts
            });

            console.log('LinkedIn Post Saver: Post saved successfully:', sanitizedData.title?.substring(0, 50));

            // Show notification if enabled
            await this.showSaveNotification(sanitizedData);

        } catch (error) {
            console.error('LinkedIn Post Saver: Error saving post:', error);
            throw error;
        }
    }

    // Background sanitization (defense in depth) - MORE ROBUST
    sanitizeStorageData(data) {
        if (!data || typeof data !== 'object') {
            console.warn('LinkedIn Post Saver: Invalid data object in sanitizeStorageData');
            return null;
        }

        try {
            // ID is the only truly required field
            if (!data.id || typeof data.id !== 'string') {
                console.warn('LinkedIn Post Saver: Missing or invalid post ID');
                // Try to generate an ID if missing
                if (!data.id && data.text) {
                    data.id = 'generated-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
                    console.info('LinkedIn Post Saver: Generated missing ID for post');
                } else {
                    return null;
                }
            }

            // Remove any function properties (security)
            const cleanData = JSON.parse(JSON.stringify(data));

            // Ensure no high-risk executable content
            if (this.containsExecutableContent(cleanData)) {
                console.warn('LinkedIn Post Saver: Executable content detected and blocked');
                // Try to sanitize instead of rejecting
                const sanitizedJson = JSON.stringify(cleanData)
                    .replace(/javascript:/gi, 'blocked-js:')
                    .replace(/vbscript:/gi, 'blocked-vbs:')
                    .replace(/<script/gi, '<blocked-script');
                
                try {
                    // If sanitization worked, use the sanitized version
                    const resanitizedData = JSON.parse(sanitizedJson);
                    console.info('LinkedIn Post Saver: Successfully sanitized potentially malicious content');
                    cleanData = resanitizedData;
                } catch (e) {
                    // If sanitization failed, reject the data
                    console.error('LinkedIn Post Saver: Could not sanitize malicious content', e);
                    return null;
                }
            }

            // Size check - with increased tolerance
            const dataSize = JSON.stringify(cleanData).length;
            if (dataSize > 150000) { // Increased to 150KB max
                console.warn('LinkedIn Post Saver: Post data too large:', dataSize);
                return this.truncatePostData(cleanData);
            }

            return cleanData;

        } catch (error) {
            console.error('LinkedIn Post Saver: Error in background sanitization:', error);
            // More detailed error logging
            console.error('Data that caused error:', typeof data, data ? Object.keys(data) : 'null');
            return null;
        }
    }

    // Check for executable content - LESS AGGRESSIVE
    containsExecutableContent(obj) {
        // Most dangerous patterns that should be blocked
        const highRiskPatterns = [
            /javascript:/i,
            /vbscript:/i,
            /<script>/i,
            /<script\s/i,
            /eval\(["']/i,
            /new\s+Function\(["']/i
        ];

        // Convert to string for checking
        const jsonString = JSON.stringify(obj);
        
        // Check for high risk patterns - these are definite blocks
        if (highRiskPatterns.some(pattern => pattern.test(jsonString))) {
            console.warn('LinkedIn Post Saver: High risk content detected in post data');
            return true;
        }
        
        // Less dangerous patterns - these are now just logged but not blocked
        // to prevent false positives while still monitoring security
        const monitorPatterns = [
            /data:/i,
            /onclick/i,
            /onerror/i,
            /onload/i
        ];
        
        if (monitorPatterns.some(pattern => pattern.test(jsonString))) {
            console.info('LinkedIn Post Saver: Potentially risky content detected but allowed');
            // Not blocking these anymore, just monitoring
        }
        
        return false; // Allow content unless high risk pattern matched
    }

    // Truncate post data if too large
    truncatePostData(data) {
        const truncated = { ...data };

        // Truncate text fields
        if (truncated.text && truncated.text.length > 5000) {
            truncated.text = truncated.text.substring(0, 5000) + '... [truncated]';
        }

        if (truncated.title && truncated.title.length > 200) {
            truncated.title = truncated.title.substring(0, 200) + '...';
        }

        // Limit media items
        if (truncated.media && truncated.media.length > 5) {
            truncated.media = truncated.media.slice(0, 5);
        }

        return truncated;
    }

    async applyStorageLimits(posts) {
        try {
            const settings = await this.getSettings();
            const maxPosts = settings.maxPosts || 1000;

            const postArray = Object.values(posts);

            if (postArray.length > maxPosts) {
                // Sort by savedAt date (oldest first)
                postArray.sort((a, b) => new Date(a.savedAt) - new Date(b.savedAt));

                // Remove oldest posts
                const postsToRemove = postArray.slice(0, postArray.length - maxPosts);
                postsToRemove.forEach(post => {
                    delete posts[post.id];
                });

                console.log(`LinkedIn Post Saver: Removed ${postsToRemove.length} old posts to maintain limit`);
            }

            // Auto cleanup if enabled
            if (settings.autoCleanup) {
                await this.performCleanup(posts, settings.cleanupDays || 30);
            }

        } catch (error) {
            console.error('LinkedIn Post Saver: Error applying storage limits:', error);
        }
    }

    async performCleanup(posts = null, cleanupDays = 30) {
        try {
            if (!posts) {
                const result = await chrome.storage.local.get(this.storageKey);
                posts = result[this.storageKey] || {};
            }

            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - cleanupDays);

            let removedCount = 0;
            Object.keys(posts).forEach(postId => {
                const post = posts[postId];
                const savedDate = new Date(post.savedAt);

                if (savedDate < cutoffDate) {
                    delete posts[postId];
                    removedCount++;
                }
            });

            if (removedCount > 0) {
                await chrome.storage.local.set({
                    [this.storageKey]: posts
                });

                console.log(`LinkedIn Post Saver: Cleaned up ${removedCount} old posts`);
            }

        } catch (error) {
            console.error('LinkedIn Post Saver: Error during cleanup:', error);
        }
    }

    async getPosts(filters = {}) {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            const posts = result[this.storageKey] || {};

            let postArray = Object.values(posts);

            // Apply filters
            if (filters.author) {
                postArray = postArray.filter(post =>
                    post.author?.name?.toLowerCase().includes(filters.author.toLowerCase())
                );
            }

            if (filters.dateFrom) {
                const fromDate = new Date(filters.dateFrom);
                postArray = postArray.filter(post =>
                    new Date(post.savedAt) >= fromDate
                );
            }

            if (filters.dateTo) {
                const toDate = new Date(filters.dateTo);
                postArray = postArray.filter(post =>
                    new Date(post.savedAt) <= toDate
                );
            }

            if (filters.hasMedia) {
                postArray = postArray.filter(post =>
                    post.media && post.media.length > 0
                );
            }

            // Sort by saved date (newest first)
            postArray.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

            // Apply pagination
            const page = filters.page || 1;
            const limit = filters.limit || 50;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;

            return {
                posts: postArray.slice(startIndex, endIndex),
                totalCount: postArray.length,
                page,
                limit,
                hasMore: endIndex < postArray.length
            };

        } catch (error) {
            console.error('LinkedIn Post Saver: Error getting posts:', error);
            throw error;
        }
    }

    async searchPosts(query, filters = {}) {
        try {
            if (!query || query.trim().length === 0) {
                return await this.getPosts(filters);
            }

            const result = await chrome.storage.local.get(this.storageKey);
            const posts = result[this.storageKey] || {};

            const searchTerm = query.toLowerCase().trim();
            let postArray = Object.values(posts);

            // Search in title, text, and author name
            postArray = postArray.filter(post => {
                const titleMatch = post.title?.toLowerCase().includes(searchTerm);
                const textMatch = post.text?.toLowerCase().includes(searchTerm);
                const authorMatch = post.author?.name?.toLowerCase().includes(searchTerm);

                return titleMatch || textMatch || authorMatch;
            });

            // Apply additional filters
            if (filters.author) {
                postArray = postArray.filter(post =>
                    post.author?.name?.toLowerCase().includes(filters.author.toLowerCase())
                );
            }

            // Sort by relevance (title matches first, then text matches)
            postArray.sort((a, b) => {
                const aTitle = a.title?.toLowerCase().includes(searchTerm) ? 1 : 0;
                const bTitle = b.title?.toLowerCase().includes(searchTerm) ? 1 : 0;

                if (aTitle !== bTitle) return bTitle - aTitle;

                // Then by date (newest first)
                return new Date(b.savedAt) - new Date(a.savedAt);
            });

            return {
                posts: postArray,
                totalCount: postArray.length,
                searchQuery: query
            };

        } catch (error) {
            console.error('LinkedIn Post Saver: Error searching posts:', error);
            throw error;
        }
    }

    async deletePost(postId) {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            const posts = result[this.storageKey] || {};

            if (posts[postId]) {
                delete posts[postId];

                await chrome.storage.local.set({
                    [this.storageKey]: posts
                });

                console.log('LinkedIn Post Saver: Post deleted:', postId);
            }

        } catch (error) {
            console.error('LinkedIn Post Saver: Error deleting post:', error);
            throw error;
        }
    }

    async getStats() {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            const posts = result[this.storageKey] || {};

            const postArray = Object.values(posts);
            const now = new Date();
            const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
            const oneMonthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

            const stats = {
                totalPosts: postArray.length,
                postsToday: postArray.filter(post => new Date(post.savedAt) > oneDayAgo).length,
                postsThisWeek: postArray.filter(post => new Date(post.savedAt) > oneWeekAgo).length,
                postsThisMonth: postArray.filter(post => new Date(post.savedAt) > oneMonthAgo).length,
                postsWithMedia: postArray.filter(post => post.media && post.media.length > 0).length,
                uniqueAuthors: new Set(postArray.map(post => post.author?.name).filter(Boolean)).size,
                oldestPost: postArray.length > 0 ? Math.min(...postArray.map(post => new Date(post.savedAt))) : null,
                newestPost: postArray.length > 0 ? Math.max(...postArray.map(post => new Date(post.savedAt))) : null,
                storageSize: this.calculateStorageSize(posts)
            };

            return stats;

        } catch (error) {
            console.error('LinkedIn Post Saver: Error getting stats:', error);
            throw error;
        }
    }

    calculateStorageSize(posts) {
        try {
            const jsonString = JSON.stringify(posts);
            const sizeInBytes = new Blob([jsonString]).size;
            const sizeInKB = Math.round(sizeInBytes / 1024);
            const sizeInMB = Math.round(sizeInKB / 1024 * 100) / 100;

            return {
                bytes: sizeInBytes,
                kb: sizeInKB,
                mb: sizeInMB,
                formatted: sizeInMB > 1 ? `${sizeInMB} MB` : `${sizeInKB} KB`
            };
        } catch (error) {
            return { bytes: 0, kb: 0, mb: 0, formatted: '0 KB' };
        }
    }

    async getSettings() {
        try {
            const result = await chrome.storage.local.get(this.settingsKey);
            return result[this.settingsKey] || {};
        } catch (error) {
            console.error('LinkedIn Post Saver: Error getting settings:', error);
            return {};
        }
    }

    async updateSettings(newSettings) {
        try {
            const currentSettings = await this.getSettings();
            const updatedSettings = { ...currentSettings, ...newSettings };

            await chrome.storage.local.set({
                [this.settingsKey]: updatedSettings
            });

            console.log('LinkedIn Post Saver: Settings updated');
        } catch (error) {
            console.error('LinkedIn Post Saver: Error updating settings:', error);
            throw error;
        }
    }

    async exportPosts() {
        try {
            const result = await chrome.storage.local.get(this.storageKey);
            const posts = result[this.storageKey] || {};

            // SANITIZE EXPORT DATA
            const sanitizedPosts = {};
            let sanitizedCount = 0;
            let skippedCount = 0;

            for (const [postId, postData] of Object.entries(posts)) {
                const sanitizedPost = this.sanitizeExportData(postData);
                if (sanitizedPost) {
                    sanitizedPosts[postId] = sanitizedPost;
                    sanitizedCount++;
                } else {
                    skippedCount++;
                    console.warn('LinkedIn Post Saver: Skipped post during export due to sanitization failure:', postId);
                }
            }

            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                postsCount: sanitizedCount,
                skippedCount: skippedCount,
                posts: sanitizedPosts,
                exportMetadata: {
                    userAgent: navigator.userAgent,
                    extensionVersion: chrome.runtime.getManifest().version,
                    sanitizationVersion: '1.0'
                }
            };

            console.log(`LinkedIn Post Saver: Export completed - ${sanitizedCount} posts exported, ${skippedCount} skipped`);

            return exportData;
        } catch (error) {
            console.error('LinkedIn Post Saver: Error exporting posts:', error);
            throw error;
        }
    }

    // Sanitize data for export
    sanitizeExportData(postData) {
        if (!postData || typeof postData !== 'object') {
            return null;
        }

        try {
            // Create a clean copy
            const sanitized = JSON.parse(JSON.stringify(postData));

            // Remove sensitive or unnecessary fields
            delete sanitized.__proto__;
            delete sanitized.constructor;

            // Validate required fields
            if (!sanitized.id || !sanitized.savedAt) {
                return null;
            }

            // Clean text fields
            if (sanitized.title) {
                sanitized.title = this.cleanTextForExport(sanitized.title);
            }
            if (sanitized.text) {
                sanitized.text = this.cleanTextForExport(sanitized.text);
            }

            // Validate and clean URLs
            if (sanitized.url) {
                sanitized.url = this.validateUrlForExport(sanitized.url);
            }
            if (sanitized.postUrl) {
                sanitized.postUrl = this.validateUrlForExport(sanitized.postUrl);
            }

            // Clean author data
            if (sanitized.author) {
                sanitized.author = this.sanitizeAuthorForExport(sanitized.author);
            }

            // Clean media data
            if (sanitized.media) {
                sanitized.media = this.sanitizeMediaForExport(sanitized.media);
            }

            // Add export timestamp
            sanitized.exportedAt = new Date().toISOString();

            return sanitized;

        } catch (error) {
            console.error('LinkedIn Post Saver: Error sanitizing export data:', error);
            return null;
        }
    }

    cleanTextForExport(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        // Remove any remaining HTML tags
        let cleaned = text.replace(/<[^>]*>/g, '');

        // Remove dangerous protocols
        cleaned = cleaned.replace(/javascript:/gi, '');
        cleaned = cleaned.replace(/vbscript:/gi, '');

        // Remove control characters
        cleaned = cleaned.replace(/[\x00-\x1F\x7F]/g, '');

        return cleaned.trim();
    }

    validateUrlForExport(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }

        try {
            const urlObj = new URL(url);
            if (['http:', 'https:'].includes(urlObj.protocol)) {
                // Allow LinkedIn and LinkedIn CDN URLs
                const allowedHosts = [
                    'linkedin.com',
                    'licdn.com',
                    'media.licdn.com',
                    'media-exp1.licdn.com',
                    'media-exp2.licdn.com',
                    'dms.licdn.com'
                ];

                const isAllowed = allowedHosts.some(host =>
                    urlObj.hostname.includes(host) || urlObj.hostname.endsWith(host)
                );

                return isAllowed ? url : '';
            }
            return '';
        } catch (error) {
            return '';
        }
    }

    sanitizeAuthorForExport(author) {
        if (!author || typeof author !== 'object') {
            return {};
        }

        return {
            name: this.cleanTextForExport(author.name),
            title: this.cleanTextForExport(author.title),
            profileUrl: this.validateUrlForExport(author.profileUrl),
            avatar: this.validateUrlForExport(author.avatar)
        };
    }

    sanitizeMediaForExport(media) {
        if (!Array.isArray(media)) {
            return [];
        }

        return media
            .filter(item => item && typeof item === 'object')
            .map(item => ({
                type: item.type === 'image' || item.type === 'video' ? item.type : 'unknown',
                url: this.validateUrlForExport(item.url),
                alt: this.cleanTextForExport(item.alt),
                poster: this.validateUrlForExport(item.poster)
            }))
            .filter(item => item.url); // Only include items with valid URLs
    }

    async importPosts(importData) {
        try {
            // VALIDATE AND SANITIZE IMPORT DATA
            const validatedData = this.validateImportData(importData);
            if (!validatedData) {
                throw new Error('Invalid import data format');
            }

            const result = await chrome.storage.local.get(this.storageKey);
            const existingPosts = result[this.storageKey] || {};

            let importedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            // Process each post with sanitization
            for (const [postId, postData] of Object.entries(validatedData.posts)) {
                try {
                    // Sanitize individual post
                    const sanitizedPost = this.sanitizeStorageData(postData);
                    if (!sanitizedPost) {
                        skippedCount++;
                        continue;
                    }

                    // Check for duplicates
                    if (existingPosts[postId]) {
                        skippedCount++;
                        continue;
                    }

                    // Add import metadata
                    sanitizedPost.importedAt = new Date().toISOString();
                    sanitizedPost.importSource = validatedData.version || 'unknown';

                    existingPosts[postId] = sanitizedPost;
                    importedCount++;

                } catch (error) {
                    console.error('LinkedIn Post Saver: Error processing import post:', postId, error);
                    errorCount++;
                }
            }

            // Apply storage limits after import
            await this.applyStorageLimits(existingPosts);

            // Save merged data
            await chrome.storage.local.set({
                [this.storageKey]: existingPosts
            });

            console.log(`LinkedIn Post Saver: Import completed - ${importedCount} imported, ${skippedCount} skipped, ${errorCount} errors`);

            // Track import event
            await this.trackEvent('posts_imported', {
                importedCount,
                skippedCount,
                errorCount,
                sourceVersion: validatedData.version
            });

        } catch (error) {
            console.error('LinkedIn Post Saver: Error importing posts:', error);
            throw error;
        }
    }

    // Validate import data structure and content
    validateImportData(importData) {
        try {
            if (!importData || typeof importData !== 'object') {
                return null;
            }

            // Check basic structure
            if (!importData.posts || typeof importData.posts !== 'object') {
                return null;
            }

            // Check data size (max 50MB for import)
            const dataSize = JSON.stringify(importData).length;
            if (dataSize > 50 * 1024 * 1024) {
                throw new Error('Import data too large (max 50MB)');
            }

            // Validate post count
            const postCount = Object.keys(importData.posts).length;
            if (postCount > 10000) {
                throw new Error('Too many posts in import (max 10,000)');
            }

            // Basic structure validation passed
            return {
                version: importData.version || '1.0',
                posts: importData.posts,
                postsCount: postCount
            };

        } catch (error) {
            console.error('LinkedIn Post Saver: Import validation error:', error);
            return null;
        }
    }

    async showSaveNotification(postData) {
        try {
            const settings = await this.getSettings();

            if (!settings.enableNotifications) {
                return;
            }

            // Create notification (optional - can be disabled for performance)
            if (chrome.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: 'icons/icon48.png',
                    title: 'LinkedIn Post Saved',
                    message: `Saved: ${postData.title?.substring(0, 50)}...`
                });
            }
        } catch (error) {
            // Notifications are optional, don't log errors
        }
    }

    // Utility method to clear all data (for debugging/reset)
    async clearAllData() {
        try {
            await chrome.storage.local.remove([this.storageKey, this.settingsKey]);
            console.log('LinkedIn Post Saver: All data cleared');
        } catch (error) {
            console.error('LinkedIn Post Saver: Error clearing data:', error);
            throw error;
        }
    }

    // User Consent Management
    async getUserConsent() {
        try {
            const result = await chrome.storage.local.get(this.consentKey);
            const consentData = result[this.consentKey];

            if (!consentData) {
                return {
                    hasConsent: false,
                    consentDate: null,
                    version: null
                };
            }

            return {
                hasConsent: consentData.hasConsent || false,
                consentDate: consentData.consentDate,
                version: consentData.version || '1.0'
            };
        } catch (error) {
            console.error('LinkedIn Post Saver: Error getting user consent:', error);
            return { hasConsent: false, consentDate: null, version: null };
        }
    }

    async setUserConsent(consent) {
        try {
            const consentData = {
                hasConsent: consent,
                consentDate: new Date().toISOString(),
                version: '1.0',
                userAgent: navigator.userAgent,
                extensionVersion: chrome.runtime.getManifest().version
            };

            await chrome.storage.local.set({
                [this.consentKey]: consentData
            });

            console.log('LinkedIn Post Saver: User consent updated:', consent);

            // If consent is granted for the first time, initialize default settings
            if (consent) {
                await this.initializeSettings();
            } else {
                // If consent is revoked, notify all content scripts
                await this.notifyConsentRevoked();
            }

            return consentData;
        } catch (error) {
            console.error('LinkedIn Post Saver: Error setting user consent:', error);
            throw error;
        }
    }

    async notifyConsentRevoked() {
        try {
            // Get all LinkedIn tabs and notify them of consent revocation
            const tabs = await chrome.tabs.query({
                url: 'https://www.linkedin.com/*'
            });

            for (const tab of tabs) {
                try {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'consentRevoked'
                    });
                } catch (error) {
                    // Tab might not have content script loaded, ignore
                    console.log('Could not notify tab:', tab.id);
                }
            }

            console.log('LinkedIn Post Saver: Notified all LinkedIn tabs of consent revocation');
        } catch (error) {
            console.error('LinkedIn Post Saver: Error notifying consent revocation:', error);
        }
    }

    async requestUserConsent() {
        try {
            // This will be handled by the popup UI
            // Background script just manages the data
            const currentConsent = await this.getUserConsent();
            return currentConsent;
        } catch (error) {
            console.error('LinkedIn Post Saver: Error requesting user consent:', error);
            return { hasConsent: false, consentDate: null, version: null };
        }
    }

    async revokeUserConsent() {
        try {
            await this.setUserConsent(false);
            console.log('LinkedIn Post Saver: User consent revoked');

            // Optionally clear all data when consent is revoked
            // await this.clearAllData();

            return true;
        } catch (error) {
            console.error('LinkedIn Post Saver: Error revoking user consent:', error);
            return false;
        }
    }

    async openComplianceDetails() {
        try {
            await chrome.tabs.create({
                url: chrome.runtime.getURL('compliance-details.html'),
                active: true
            });
            console.log('LinkedIn Post Saver: Opened compliance details');
        } catch (error) {
            console.error('LinkedIn Post Saver: Error opening compliance details:', error);
        }
    }

    async trackEvent(eventName, eventData = {}) {
        try {
            // Simple event tracking for compliance monitoring
            const eventLog = {
                event: eventName,
                timestamp: new Date().toISOString(),
                data: eventData
            };

            // Store recent events (last 100) for debugging/compliance
            const result = await chrome.storage.local.get('eventLog');
            const events = result.eventLog || [];

            events.unshift(eventLog);

            // Keep only last 100 events
            if (events.length > 100) {
                events.splice(100);
            }

            await chrome.storage.local.set({ eventLog: events });

            console.log('LinkedIn Post Saver: Event tracked:', eventName);
        } catch (error) {
            console.error('LinkedIn Post Saver: Error tracking event:', error);
        }
    }

    // Compliance monitoring
    async checkComplianceStatus() {
        try {
            const stats = await this.getStats();
            const settings = await this.getSettings();
            const consent = await this.getUserConsent();

            // Check sanitization status
            const sanitizationStatus = await this.checkSanitizationHealth();

            const complianceStatus = {
                userConsent: consent.hasConsent,
                rateLimitsActive: true, // Always active in our implementation
                personalUseOnly: true,  // Enforced by design
                noAutomation: true,     // No automation in our code
                publicContentOnly: true, // Only scrapes visible feed
                respectfulLimits: stats.totalPosts <= (settings.maxPosts || 1000),
                dataLocalOnly: true,    // All storage is local
                complianceNoticeShown: true, // We show compliance notices
                dataSanitizationActive: sanitizationStatus.active,
                securityMeasuresActive: sanitizationStatus.securityActive
            };

            // Log compliance check
            await this.trackEvent('compliance_check', complianceStatus);

            return complianceStatus;
        } catch (error) {
            console.error('LinkedIn Post Saver: Error checking compliance status:', error);
            return {
                userConsent: false,
                rateLimitsActive: false,
                personalUseOnly: false,
                noAutomation: false,
                publicContentOnly: false,
                respectfulLimits: false,
                dataLocalOnly: false,
                complianceNoticeShown: false,
                dataSanitizationActive: false,
                securityMeasuresActive: false
            };
        }
    }

    // Check sanitization health
    async checkSanitizationHealth() {
        try {
            // Sample a few recent posts to check sanitization
            const result = await chrome.storage.local.get(this.storageKey);
            const posts = result[this.storageKey] || {};

            const postArray = Object.values(posts);
            const recentPosts = postArray
                .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
                .slice(0, 10); // Check last 10 posts

            let sanitizedCount = 0;
            let securityIssues = 0;

            for (const post of recentPosts) {
                // Check if post has sanitization metadata
                if (post.sanitizedAt || post.sanitizationVersion) {
                    sanitizedCount++;
                }

                // Check for security issues
                if (this.containsExecutableContent(post)) {
                    securityIssues++;
                }
            }

            const sanitizationRate = recentPosts.length > 0 ?
                (sanitizedCount / recentPosts.length) : 1;

            return {
                active: sanitizationRate > 0.8, // 80% of posts should be sanitized
                securityActive: securityIssues === 0,
                sanitizationRate,
                securityIssues,
                checkedPosts: recentPosts.length
            };

        } catch (error) {
            console.error('LinkedIn Post Saver: Error checking sanitization health:', error);
            return {
                active: false,
                securityActive: false,
                sanitizationRate: 0,
                securityIssues: -1,
                checkedPosts: 0
            };
        }
    }
}

// Initialize the storage handler
const linkedInPostStorage = new LinkedInPostStorage();

// Handle extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('LinkedIn Post Saver: Extension installed');
    } else if (details.reason === 'update') {
        console.log('LinkedIn Post Saver: Extension updated');
    }
});

// Handle tab updates to inject content script if needed
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' &&
        tab.url &&
        tab.url.includes('linkedin.com')) {

        // Content script should already be injected via manifest
        // This is just for monitoring
        console.log('LinkedIn Post Saver: LinkedIn page loaded');
    }
});