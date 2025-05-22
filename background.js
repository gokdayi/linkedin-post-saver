/**
 * LinkedIn Post Saver - Background Script (Service Worker)
 * Handles data storage and communication between content script and popup
 */

class LinkedInPostStorage {
    constructor() {
      this.storageKey = 'linkedinPosts';
      this.settingsKey = 'linkedinPostsSettings';
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
        // Validate post data
        if (!postData || !postData.id) {
          throw new Error('Invalid post data');
        }
  
        // Get existing posts
        const result = await chrome.storage.local.get(this.storageKey);
        const posts = result[this.storageKey] || {};
  
        // Check if post already exists
        if (posts[postData.id]) {
          console.log('LinkedIn Post Saver: Post already exists, skipping...');
          return;
        }
  
        // Add metadata
        postData.savedAt = new Date().toISOString();
        postData.version = 1;
  
        // Save the post
        posts[postData.id] = postData;
  
        // Apply storage limits
        await this.applyStorageLimits(posts);
  
        // Store updated posts
        await chrome.storage.local.set({
          [this.storageKey]: posts
        });
  
        console.log('LinkedIn Post Saver: Post saved successfully:', postData.title?.substring(0, 50));
  
        // Show notification if enabled
        await this.showSaveNotification(postData);
  
      } catch (error) {
        console.error('LinkedIn Post Saver: Error saving post:', error);
        throw error;
      }
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
        
        const exportData = {
          version: '1.0',
          exportDate: new Date().toISOString(),
          postsCount: Object.keys(posts).length,
          posts: posts
        };
        
        return exportData;
      } catch (error) {
        console.error('LinkedIn Post Saver: Error exporting posts:', error);
        throw error;
      }
    }
  
    async importPosts(importData) {
      try {
        if (!importData || !importData.posts) {
          throw new Error('Invalid import data');
        }
  
        const result = await chrome.storage.local.get(this.storageKey);
        const existingPosts = result[this.storageKey] || {};
        
        // Merge imported posts with existing ones
        const mergedPosts = { ...existingPosts, ...importData.posts };
        
        // Apply storage limits
        await this.applyStorageLimits(mergedPosts);
        
        await chrome.storage.local.set({
          [this.storageKey]: mergedPosts
        });
        
        console.log('LinkedIn Post Saver: Posts imported successfully');
      } catch (error) {
        console.error('LinkedIn Post Saver: Error importing posts:', error);
        throw error;
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