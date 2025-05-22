/**
 * LinkedIn Post Saver - Content Script
 * Runs on LinkedIn pages to detect and scrape posts
 */

class LinkedInPostSaver {
    constructor() {
      this.processedPosts = new Set();
      this.isProcessing = false;
      this.observer = null;
      this.feedContainer = null;
      
      // Throttling for performance
      this.lastProcessTime = 0;
      this.processThrottleMs = 1000;
      
      this.init();
    }
  
    async init() {
      console.log('LinkedIn Post Saver: Initializing...');
      
      // Wait for page to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.start());
      } else {
        this.start();
      }
    }
  
    start() {
      // Only run on LinkedIn feed pages
      if (!this.isLinkedInFeedPage()) {
        console.log('LinkedIn Post Saver: Not a feed page, skipping...');
        return;
      }
  
      console.log('LinkedIn Post Saver: Starting on feed page...');
      
      // Find the main feed container
      this.findFeedContainer();
      
      // Process existing posts
      this.processVisiblePosts();
      
      // Set up observers for new posts
      this.setupObservers();
      
      // Set up scroll detection for viewport posts
      this.setupScrollDetection();
    }
  
    isLinkedInFeedPage() {
      const url = window.location.href;
      const pathname = window.location.pathname;
      
      // Check if we're on the main feed
      return url.includes('linkedin.com') && 
             (pathname === '/feed/' || pathname === '/' || pathname.startsWith('/feed'));
    }
  
    findFeedContainer() {
      // LinkedIn feed selectors (these may need updates as LinkedIn changes their UI)
      const selectors = [
        '.scaffold-finite-scroll__content',  // Main feed container
        '[data-chameleon-result-urn]',       // Individual post containers
        '.feed-container-theme',             // Alternative feed container
        '.core-rail'                         // Core content rail
      ];
  
      for (const selector of selectors) {
        const container = document.querySelector(selector);
        if (container) {
          this.feedContainer = container;
          console.log(`LinkedIn Post Saver: Found feed container with selector: ${selector}`);
          break;
        }
      }
  
      if (!this.feedContainer) {
        console.log('LinkedIn Post Saver: Feed container not found, will retry...');
        // Retry after a delay
        setTimeout(() => this.findFeedContainer(), 20000);
      }
    }
  
    setupObservers() {
      if (!this.feedContainer) return;
  
      // MutationObserver to detect new posts being added
      this.observer = new MutationObserver((mutations) => {
        let hasNewPosts = false;
        
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check if the added node contains posts
                if (this.isPostElement(node) || node.querySelector && this.findPostsInElement(node).length > 0) {
                  hasNewPosts = true;
                }
              }
            });
          }
        });
  
        if (hasNewPosts) {
          this.throttledProcessPosts();
        }
      });
  
      this.observer.observe(this.feedContainer, {
        childList: true,
        subtree: true
      });
  
      console.log('LinkedIn Post Saver: MutationObserver set up');
    }
  
    setupScrollDetection() {
      let scrollTimeout;
      
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.throttledProcessPosts();
        }, 500);
      });
  
      console.log('LinkedIn Post Saver: Scroll detection set up');
    }
  
    throttledProcessPosts() {
      const now = Date.now();
      if (now - this.lastProcessTime < this.processThrottleMs) {
        return;
      }
      
      this.lastProcessTime = now;
      this.processVisiblePosts();
    }
  
    processVisiblePosts() {
      if (this.isProcessing) return;
      
      this.isProcessing = true;
      
      try {
        const posts = this.findVisiblePosts();
        console.log(`LinkedIn Post Saver: Found ${posts.length} visible posts`);
        
        posts.forEach(postElement => {
          this.processPost(postElement);
        });
      } catch (error) {
        console.error('LinkedIn Post Saver: Error processing posts:', error);
      } finally {
        this.isProcessing = false;
      }
    }
  
    findVisiblePosts() {
      // LinkedIn post selectors - these target the main post containers
      const postSelectors = [
        '[data-chameleon-result-urn]',               // Primary post container
        '.feed-shared-update-v2',                    // Update posts
        '.occludable-update',                        // Occludable posts
        '[data-urn*="urn:li:activity"]',            // Activity posts
        '.feed-shared-article',                      // Article posts
        '.feed-shared-video'                         // Video posts
      ];
  
      let allPosts = [];
      
      postSelectors.forEach(selector => {
        const posts = Array.from(document.querySelectorAll(selector));
        allPosts = allPosts.concat(posts);
      });
  
      // Remove duplicates and filter for visible posts
      const uniquePosts = Array.from(new Set(allPosts));
      
      return uniquePosts.filter(post => {
        return this.isElementVisible(post) && !this.isPostProcessed(post);
      });
    }
  
    findPostsInElement(element) {
      const postSelectors = [
        '[data-chameleon-result-urn]',
        '.feed-shared-update-v2',
        '.occludable-update',
        '[data-urn*="urn:li:activity"]'
      ];
  
      let posts = [];
      postSelectors.forEach(selector => {
        posts = posts.concat(Array.from(element.querySelectorAll(selector)));
      });
  
      return posts;
    }
  
    isPostElement(element) {
      const postAttributes = [
        'data-chameleon-result-urn',
        'data-urn'
      ];
  
      return postAttributes.some(attr => element.hasAttribute && element.hasAttribute(attr));
    }
  
    isElementVisible(element) {
      const rect = element.getBoundingClientRect();
      const viewHeight = window.innerHeight || document.documentElement.clientHeight;
      
      // Check if element is in viewport or close to it (with buffer)
      return rect.top < viewHeight + 1000 && rect.bottom > -1000;
    }
  
    isPostProcessed(postElement) {
      const postId = this.extractPostId(postElement);
      return postId && this.processedPosts.has(postId);
    }
  
    extractPostId(postElement) {
      // Try multiple methods to get a unique identifier
      let postId = null;
  
      // Method 1: data-chameleon-result-urn
      postId = postElement.getAttribute('data-chameleon-result-urn');
      if (postId) return postId;
  
      // Method 2: data-urn
      postId = postElement.getAttribute('data-urn');
      if (postId) return postId;
  
      // Method 3: Look for URN in child elements
      const urnElement = postElement.querySelector('[data-urn]');
      if (urnElement) {
        postId = urnElement.getAttribute('data-urn');
        if (postId) return postId;
      }
  
      // Method 4: Generate hash based on content (fallback)
      const textContent = postElement.textContent?.trim();
      if (textContent && textContent.length > 10) {
        return 'hash_' + this.generateSimpleHash(textContent.substring(0, 100));
      }
  
      return null;
    }
  
    generateSimpleHash(str) {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return Math.abs(hash).toString();
    }
  
    async processPost(postElement) {
      try {
        const postId = this.extractPostId(postElement);
        if (!postId || this.processedPosts.has(postId)) {
          return;
        }
  
        const postData = this.extractPostData(postElement);
        if (!postData) {
          console.log('LinkedIn Post Saver: No valid post data extracted');
          return;
        }
  
        postData.id = postId;
        postData.scrapedAt = new Date().toISOString();
        postData.url = window.location.href;
  
        // Mark as processed
        this.processedPosts.add(postId);
  
        // Send to background script for storage
        await this.savePost(postData);
  
        console.log('LinkedIn Post Saver: Processed post:', postData.title?.substring(0, 50) + '...');
  
      } catch (error) {
        console.error('LinkedIn Post Saver: Error processing individual post:', error);
      }
    }
  
    extractPostData(postElement) {
      try {
        // Extract author information
        const author = this.extractAuthorInfo(postElement);
        
        // Extract post content
        const content = this.extractPostContent(postElement);
        
        // Extract media (images, videos)
        const media = this.extractPostMedia(postElement);
        
        // Extract engagement data
        const engagement = this.extractEngagementData(postElement);
        
        // Extract post URL/link
        const postUrl = this.extractPostUrl(postElement);
  
        return {
          author,
          title: content.title,
          text: content.text,
          media,
          engagement,
          postUrl,
          timestamp: content.timestamp
        };
  
      } catch (error) {
        console.error('LinkedIn Post Saver: Error extracting post data:', error);
        return null;
      }
    }
  
    extractAuthorInfo(postElement) {
      const author = {};
  
      // Author name
      const nameSelectors = [
        '.feed-shared-actor__name a',
        '.feed-shared-actor__name',
        '[data-chameleon-result-urn] a[href*="/in/"]',
        '.update-components-actor__name'
      ];
  
      for (const selector of nameSelectors) {
        const nameElement = postElement.querySelector(selector);
        if (nameElement) {
          author.name = nameElement.textContent?.trim();
          author.profileUrl = nameElement.href;
          break;
        }
      }
  
      // Author title/headline
      const titleSelectors = [
        '.feed-shared-actor__description',
        '.update-components-actor__description'
      ];
  
      for (const selector of titleSelectors) {
        const titleElement = postElement.querySelector(selector);
        if (titleElement) {
          author.title = titleElement.textContent?.trim();
          break;
        }
      }
  
      // Author avatar
      const avatarSelectors = [
        '.feed-shared-actor__avatar img',
        '.update-components-actor__avatar img'
      ];
  
      for (const selector of avatarSelectors) {
        const avatarElement = postElement.querySelector(selector);
        if (avatarElement) {
          author.avatar = avatarElement.src;
          break;
        }
      }
  
      return author;
    }
  
    extractPostContent(postElement) {
      const content = {};
  
      // Post text content
      const textSelectors = [
        '.feed-shared-text',
        '.feed-shared-update-v2__description',
        '.update-components-text'
      ];
  
      for (const selector of textSelectors) {
        const textElement = postElement.querySelector(selector);
        if (textElement) {
          content.text = textElement.textContent?.trim();
          // Use first sentence or first 100 chars as title
          content.title = this.generateTitle(content.text);
          break;
        }
      }
  
      // Timestamp
      const timeSelectors = [
        '.feed-shared-actor__sub-description time',
        '.update-components-actor__sub-description time',
        'time[datetime]'
      ];
  
      for (const selector of timeSelectors) {
        const timeElement = postElement.querySelector(selector);
        if (timeElement) {
          content.timestamp = timeElement.getAttribute('datetime') || timeElement.textContent?.trim();
          break;
        }
      }
  
      return content;
    }
  
    generateTitle(text) {
      if (!text) return 'LinkedIn Post';
      
      // Try to get first sentence
      const firstSentence = text.split(/[.!?]/)[0];
      if (firstSentence && firstSentence.length > 10 && firstSentence.length < 100) {
        return firstSentence.trim();
      }
      
      // Fallback to first 80 characters
      return text.length > 80 ? text.substring(0, 80) + '...' : text;
    }
  
    extractPostMedia(postElement) {
      const media = [];
  
      // Images
      const imageSelectors = [
        '.feed-shared-image img',
        '.feed-shared-carousel img',
        '.update-components-image img'
      ];
  
      imageSelectors.forEach(selector => {
        const images = postElement.querySelectorAll(selector);
        images.forEach(img => {
          if (img.src && !img.src.includes('data:image')) {
            media.push({
              type: 'image',
              url: img.src,
              alt: img.alt || ''
            });
          }
        });
      });
  
      // Videos
      const videoSelectors = [
        '.feed-shared-video video',
        '.update-components-video video'
      ];
  
      videoSelectors.forEach(selector => {
        const videos = postElement.querySelectorAll(selector);
        videos.forEach(video => {
          if (video.src) {
            media.push({
              type: 'video',
              url: video.src,
              poster: video.poster || ''
            });
          }
        });
      });
  
      return media;
    }
  
    extractEngagementData(postElement) {
      const engagement = {};
  
      // Likes, comments, shares
      const engagementSelectors = [
        '.social-actions-button',
        '.feed-shared-social-action-bar'
      ];
  
      const engagementElement = postElement.querySelector(engagementSelectors.join(', '));
      if (engagementElement) {
        const likeButton = engagementElement.querySelector('[aria-label*="like"], [aria-label*="Like"]');
        const commentButton = engagementElement.querySelector('[aria-label*="comment"], [aria-label*="Comment"]');
        const shareButton = engagementElement.querySelector('[aria-label*="share"], [aria-label*="Share"]');
  
        if (likeButton) engagement.likes = this.extractEngagementCount(likeButton);
        if (commentButton) engagement.comments = this.extractEngagementCount(commentButton);
        if (shareButton) engagement.shares = this.extractEngagementCount(shareButton);
      }
  
      return engagement;
    }
  
    extractEngagementCount(button) {
      const text = button.textContent || button.getAttribute('aria-label') || '';
      const match = text.match(/(\d+)/);
      return match ? parseInt(match[1]) : 0;
    }
  
    extractPostUrl(postElement) {
      // Look for permalink or timestamp link
      const linkSelectors = [
        'a[href*="/posts/"]',
        'a[href*="/activity-"]',
        '.feed-shared-actor__sub-description a'
      ];
  
      for (const selector of linkSelectors) {
        const linkElement = postElement.querySelector(selector);
        if (linkElement && linkElement.href) {
          return linkElement.href;
        }
      }
  
      return null;
    }
  
    async savePost(postData) {
      try {
        // Send message to background script to save the post
        await chrome.runtime.sendMessage({
          action: 'savePost',
          data: postData
        });
      } catch (error) {
        console.error('LinkedIn Post Saver: Error saving post:', error);
      }
    }
  
    // Cleanup method
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
      }
    }
  }
  
  // Initialize the post saver
  const linkedInPostSaver = new LinkedInPostSaver();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    linkedInPostSaver.destroy();
  });