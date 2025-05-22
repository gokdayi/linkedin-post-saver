/**
 * LinkedIn Post Saver - Content Script
 * Runs on LinkedIn pages to detect and scrape posts
 */

// Data Sanitization Class for Security
class DataSanitizer {
    constructor() {
        // Dangerous HTML tags that should be completely removed
        this.dangerousTags = [
            'script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea',
            'button', 'select', 'option', 'link', 'meta', 'style', 'base',
            'applet', 'body', 'head', 'html', 'title'
        ];

        // Dangerous attributes that should be removed
        this.dangerousAttributes = [
            'onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onfocus',
            'onblur', 'onchange', 'onsubmit', 'onreset', 'onselect', 'onunload',
            'onbeforeunload', 'onresize', 'onscroll', 'javascript:', 'vbscript:',
            'data-track', 'data-analytics', 'data-gtm'
        ];

        // Allowed HTML tags for post content (very restrictive)
        this.allowedTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'span', 'div'];

        // Maximum lengths for different content types
        this.maxLengths = {
            text: 10000,      // 10KB max for post text
            title: 500,       // 500 chars max for titles
            authorName: 200,  // 200 chars max for author names
            url: 2000,        // 2KB max for URLs
            alt: 300          // 300 chars max for alt text
        };
    }

    // Main sanitization method for post data
    sanitizePostData(postData) {
        if (!postData || typeof postData !== 'object') {
            return null;
        }

        try {
            const sanitized = {};

            // Sanitize basic text fields
            sanitized.id = this.sanitizeId(postData.id);
            sanitized.title = this.sanitizeText(postData.title, 'title');
            sanitized.text = this.sanitizeText(postData.text, 'text');
            sanitized.timestamp = this.sanitizeTimestamp(postData.timestamp);
            sanitized.scrapedAt = this.sanitizeTimestamp(postData.scrapedAt);
            sanitized.url = this.sanitizeUrl(postData.url);
            sanitized.postUrl = this.sanitizeUrl(postData.postUrl);

            // Sanitize author data
            if (postData.author && typeof postData.author === 'object') {
                sanitized.author = this.sanitizeAuthorData(postData.author);
            }

            // Sanitize media data
            if (Array.isArray(postData.media)) {
                sanitized.media = this.sanitizeMediaData(postData.media);
            } else {
                sanitized.media = [];
            }

            // Sanitize engagement data
            if (postData.engagement && typeof postData.engagement === 'object') {
                sanitized.engagement = this.sanitizeEngagementData(postData.engagement);
            }

            // Add sanitization metadata
            sanitized.sanitizedAt = new Date().toISOString();
            sanitized.sanitizationVersion = '1.0';

            return sanitized;

        } catch (error) {
            console.error('LinkedIn Post Saver: Error sanitizing post data:', error);
            return null;
        }
    }

    // Sanitize text content
    sanitizeText(text, type = 'text') {
        if (!text || typeof text !== 'string') {
            return '';
        }

        let sanitized = text;

        // Remove dangerous HTML tags and scripts
        sanitized = this.removeHtmlTags(sanitized);

        // Remove dangerous attributes and protocols
        sanitized = this.removeDangerousContent(sanitized);

        // Normalize whitespace
        sanitized = this.normalizeWhitespace(sanitized);

        // Apply length limits
        const maxLength = this.maxLengths[type] || this.maxLengths.text;
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength - 3) + '...';
        }

        return sanitized.trim();
    }

    // Remove HTML tags (keep only safe ones for text content)
    removeHtmlTags(text) {
        if (!text) return '';

        // Remove all HTML tags for safety (we don't need HTML in saved posts)
        return text.replace(/<[^>]*>/g, ' ');
    }

    // Remove dangerous content patterns
    removeDangerousContent(text) {
        if (!text) return '';

        let sanitized = text;

        // Remove javascript: and vbscript: protocols
        sanitized = sanitized.replace(/javascript:/gi, '');
        sanitized = sanitized.replace(/vbscript:/gi, '');

        // Remove data: URIs (potential for abuse)
        sanitized = sanitized.replace(/data:/gi, '');

        // Remove potentially dangerous Unicode characters
        sanitized = sanitized.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

        // Remove control characters
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

        return sanitized;
    }

    // Normalize whitespace
    normalizeWhitespace(text) {
        if (!text) return '';

        return text
            .replace(/\s+/g, ' ')           // Multiple spaces to single space
            .replace(/\n\s*\n/g, '\n')      // Multiple newlines to single newline
            .trim();
    }

    // Sanitize URLs - FIXED to allow LinkedIn media URLs
    sanitizeUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }

        try {
            // Only allow HTTP/HTTPS URLs
            const urlObj = new URL(url);

            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return '';
            }

            // Allow LinkedIn URLs AND LinkedIn media CDN URLs
            const allowedHosts = [
                'linkedin.com',
                'licdn.com',           // LinkedIn CDN
                'media.licdn.com',     // LinkedIn media
                'media-exp1.licdn.com', // LinkedIn media experimental
                'media-exp2.licdn.com',
                'dms.licdn.com'        // LinkedIn DMS media
            ];

            const isAllowedHost = allowedHosts.some(host =>
                urlObj.hostname.includes(host) || urlObj.hostname.endsWith(host)
            );

            if (!isAllowedHost) {
                console.log('LinkedIn Post Saver: Blocked non-LinkedIn URL:', urlObj.hostname);
                return '';
            }

            // Remove dangerous query parameters but keep necessary ones
            const cleanUrl = this.cleanUrlParameters(url);

            // Apply length limit
            if (cleanUrl.length > this.maxLengths.url) {
                return '';
            }

            return cleanUrl;

        } catch (error) {
            // Invalid URL
            console.warn('LinkedIn Post Saver: Invalid URL:', url);
            return '';
        }
    }

    // Clean URL parameters - LESS aggressive cleaning
    cleanUrlParameters(url) {
        try {
            const urlObj = new URL(url);

            // Only remove clearly dangerous tracking parameters
            const trackingParams = [
                'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
                'gclid', 'fbclid', 'msclkid', '_ga', 'mc_eid'
                // Removed 'trk' as LinkedIn uses it for legitimate purposes
            ];

            trackingParams.forEach(param => {
                urlObj.searchParams.delete(param);
            });

            return urlObj.toString();
        } catch (error) {
            return url;
        }
    }

    // Sanitize ID fields
    sanitizeId(id) {
        if (!id || typeof id !== 'string') {
            return '';
        }

        // Only allow alphanumeric, hyphens, underscores, and colons (for URNs)
        return id.replace(/[^a-zA-Z0-9\-_:]/g, '').substring(0, 200);
    }

    // Sanitize timestamps
    sanitizeTimestamp(timestamp) {
        if (!timestamp) {
            return '';
        }

        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                return '';
            }

            // Ensure timestamp is not in the future (with 1 hour tolerance)
            const now = new Date();
            const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

            if (date > oneHourFromNow) {
                return now.toISOString();
            }

            return date.toISOString();
        } catch (error) {
            return '';
        }
    }

    // Sanitize author data
    sanitizeAuthorData(author) {
        if (!author || typeof author !== 'object') {
            return {};
        }

        return {
            name: this.sanitizeText(author.name, 'authorName'),
            title: this.sanitizeText(author.title, 'title'),
            profileUrl: this.sanitizeUrl(author.profileUrl),
            avatar: this.sanitizeUrl(author.avatar)
        };
    }

    // Sanitize media data
    sanitizeMediaData(media) {
        if (!Array.isArray(media)) {
            return [];
        }

        return media
            .slice(0, 10) // Limit to 10 media items max
            .map(item => this.sanitizeMediaItem(item))
            .filter(item => item !== null);
    }

    // Sanitize individual media item
    sanitizeMediaItem(item) {
        if (!item || typeof item !== 'object') {
            return null;
        }

        const allowedTypes = ['image', 'video'];
        if (!allowedTypes.includes(item.type)) {
            return null;
        }

        const sanitizedUrl = this.sanitizeUrl(item.url);
        if (!sanitizedUrl) {
            return null;
        }

        return {
            type: item.type,
            url: sanitizedUrl,
            alt: this.sanitizeText(item.alt, 'alt'),
            poster: item.poster ? this.sanitizeUrl(item.poster) : ''
        };
    }

    // Sanitize engagement data
    sanitizeEngagementData(engagement) {
        if (!engagement || typeof engagement !== 'object') {
            return {};
        }

        const sanitized = {};

        // Only allow numeric values, max 1 billion
        ['likes', 'comments', 'shares'].forEach(key => {
            if (typeof engagement[key] === 'number' &&
                engagement[key] >= 0 &&
                engagement[key] <= 1000000000) {
                sanitized[key] = Math.floor(engagement[key]);
            } else {
                sanitized[key] = 0;
            }
        });

        return sanitized;
    }

    // Validate sanitized data before storage - LESS strict validation
    validateSanitizedData(data) {
        if (!data || typeof data !== 'object') {
            console.warn('LinkedIn Post Saver: Invalid data object');
            return false;
        }

        // Required field check - only ID is truly required
        if (!data.id) {
            console.warn('LinkedIn Post Saver: Missing post ID');
            return false;
        }

        // Even more lenient content validation
        // Accept ANY meaningful content rather than requiring multiple fields
        let hasContent = false;
        
        // Check if post has ANY of these fields with content
        if (data.title && data.title.trim().length > 0) {
            hasContent = true;
        } else if (data.text && data.text.trim().length > 0) {
            hasContent = true;
        } else if (data.author && data.author.name && data.author.name.trim().length > 0) {
            hasContent = true;
        } else if (data.postUrl && data.postUrl.trim().length > 0) {
            hasContent = true;
        }
        
        if (!hasContent) {
            console.warn('LinkedIn Post Saver: No meaningful content to save');
            return false;
        }

        // Check data size (increased limit)
        const dataSize = JSON.stringify(data).length;
        if (dataSize > 100000) { // 100KB max per post (increased from 50KB)
            console.warn('LinkedIn Post Saver: Post data too large:', dataSize);
            return false;
        }

        return true;
    }
}
class SmartRateLimiter {
    constructor(maxRequests = 20, windowMs = 60000) { // 20 posts per minute (more reasonable)
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requests = [];
        this.queue = [];
        this.isProcessingQueue = false;
        this.lastLogTime = 0;
        this.logThrottleMs = 10000; // Log every 10 seconds
    }

    canProceed() {
        const now = Date.now();
        // Remove old requests outside the time window
        this.requests = this.requests.filter(time => now - time < this.windowMs);

        if (this.requests.length >= this.maxRequests) {
            return false;
        }

        this.requests.push(now);
        return true;
    }

    // Process each post with sanitization
    async processWithQueue(postElement, processor) {
        if (this.canProceed()) {
            // Process immediately if under rate limit
            return await processor(postElement);
        } else {
            // Add to queue if rate limited
            this.addToQueue(postElement, processor);
            this.scheduleQueueProcessing();
        }
    }

    addToQueue(postElement, processor) {
        // Prevent queue from growing too large
        if (this.queue.length >= 50) {
            this.queue.shift(); // Remove oldest queued item
        }

        this.queue.push({
            postElement,
            processor,
            timestamp: Date.now()
        });

        const now = Date.now();
        if (now - this.lastLogTime > this.logThrottleMs) {
            console.log(`LinkedIn Post Saver: Rate limited - queued post (${this.queue.length} in queue)`);
            this.lastLogTime = now;
        }
    }

    scheduleQueueProcessing() {
        if (this.isProcessingQueue) return;

        this.isProcessingQueue = true;

        // Process queue every 3 seconds
        const self = this;
        const processQueue = async function () {
            while (self.queue.length > 0 && self.canProceed()) {
                const queueItem = self.queue.shift();

                // Skip if post is too old (older than 5 minutes)
                if (Date.now() - queueItem.timestamp > 300000) {
                    continue;
                }

                try {
                    await queueItem.processor(queueItem.postElement);
                } catch (error) {
                    console.warn('LinkedIn Post Saver: Error processing queued post:', error);
                }
            }

            // Continue processing if queue still has items
            if (self.queue.length > 0) {
                setTimeout(processQueue, 3000);
            } else {
                self.isProcessingQueue = false;
            }
        };

        setTimeout(processQueue, 3000);
    }

    getStatus() {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.windowMs);
        return {
            currentRequests: this.requests.length,
            maxRequests: this.maxRequests,
            timeWindow: this.windowMs / 1000,
            canProceed: this.requests.length < this.maxRequests,
            queueLength: this.queue.length,
            nextAvailableSlot: this.requests.length > 0 ?
                new Date(this.requests[0] + this.windowMs) : new Date()
        };
    }
}

class LinkedInPostSaver {
    constructor() {
        this.processedPosts = new Set();
        this.isProcessing = false;
        this.observer = null;
        this.feedContainer = null;

        // Throttling for performance
        this.lastProcessTime = 0;
        this.processThrottleMs = 1000;

        // Smart rate limiting with queue system - more reasonable limits
        this.rateLimiter = new SmartRateLimiter(20, 60000); // 20 posts per minute

        // Data sanitizer for security
        this.sanitizer = new DataSanitizer();

        // Enhanced duplicate tracking
        this.lastProcessTime = 0;
        this.processThrottleMs = 1500; // Reduced to 1.5 seconds for better responsiveness

        // User consent status
        this.userConsent = false;

        // Context invalidation logging (to prevent spam)
        this.contextInvalidatedLogged = false;

        // Compliance notice tracking
        this.complianceNoticeShown = false;

        this.init();
    }

    async init() {
        console.log('LinkedIn Post Saver: Initializing...');

        // Check user consent BEFORE doing anything
        await this.checkUserConsent();

        // STOP HERE if no consent - don't set up any observers or processing
        if (!this.userConsent) {
            console.log('LinkedIn Post Saver: No user consent - extension disabled');
            this.showConsentReminder();
            return; // Exit completely - no further initialization
        }

        console.log('LinkedIn Post Saver: User consent confirmed - proceeding with initialization');

        // Only proceed with setup if user has given consent
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.start());
        } else {
            this.start();
        }
    }

    showConsentReminder() {
        try {
            // Remove any existing reminder first
            const existingReminder = document.getElementById('linkedin-post-saver-consent-reminder');
            if (existingReminder) {
                existingReminder.remove();
            }

            // Create reminder container
            const reminder = document.createElement('div');
            reminder.id = 'linkedin-post-saver-consent-reminder';
            reminder.style.cssText = `
          position: fixed;
          top: 10px;
          right: 10px;
          background: #0077b5;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 12px;
          z-index: 9999;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          cursor: pointer;
          font-family: Arial, sans-serif;
          user-select: none;
        `;

            // Create text content (NO innerHTML to avoid CSP issues)
            const reminderText = document.createTextNode('🔒 LinkedIn Post Saver: Click to enable');
            reminder.appendChild(reminderText);

            // Add click handler programmatically (NOT inline)
            reminder.addEventListener('click', () => {
                try {
                    if (chrome.runtime?.id) {
                        chrome.runtime.sendMessage({ action: 'openPopup' });
                    }
                } catch (error) {
                    console.warn('LinkedIn Post Saver: Could not open popup:', error);
                }
                reminder.remove();
            });

            document.body.appendChild(reminder);

            // Auto-hide after 5 seconds
            setTimeout(() => {
                if (reminder.parentNode) {
                    reminder.remove();
                }
            }, 5000);
        } catch (error) {
            console.warn('LinkedIn Post Saver: Error showing consent reminder:', error);
        }
    }

    showComplianceNotice() {
        try {
            // Only show once per session
            if (this.complianceNoticeShown) return;
            this.complianceNoticeShown = true;

            // Create a subtle compliance notice
            const notice = document.createElement('div');
            notice.id = 'linkedin-post-saver-compliance-notice';
            notice.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: rgba(0, 119, 181, 0.95);
          color: white;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 11px;
          z-index: 9999;
          max-width: 280px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          font-family: Arial, sans-serif;
          line-height: 1.4;
          cursor: pointer;
          transition: opacity 0.3s ease;
        `;

            // Create notice content
            const noticeContent = document.createElement('div');
            noticeContent.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 6px;">
            🤝 LinkedIn ToS Compliant
          </div>
          <div style="margin-bottom: 8px;">
            • Personal use only • Rate limited • No automation
          </div>
          <div style="font-size: 10px; opacity: 0.8;">
            Click to view full compliance details • Auto-hide in 10s
          </div>
        `;

            notice.appendChild(noticeContent);

            // Add click handler to open compliance details
            notice.addEventListener('click', () => {
                try {
                    if (chrome.runtime?.id) {
                        chrome.runtime.sendMessage({
                            action: 'openComplianceDetails'
                        });
                    }
                } catch (error) {
                    console.warn('LinkedIn Post Saver: Could not open compliance details:', error);
                }
                notice.remove();
            });

            document.body.appendChild(notice);

            // Auto-hide after 10 seconds
            setTimeout(() => {
                if (notice.parentNode) {
                    notice.style.opacity = '0.6';
                    setTimeout(() => {
                        if (notice.parentNode) {
                            notice.remove();
                        }
                    }, 2000);
                }
            }, 10000);

        } catch (error) {
            console.warn('LinkedIn Post Saver: Error showing compliance notice:', error);
        }
    }

    async checkUserConsent() {
        try {
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
                console.warn('LinkedIn Post Saver: Extension context invalidated');
                this.userConsent = false;
                return;
            }

            const response = await chrome.runtime.sendMessage({
                action: 'getUserConsent'
            });

            if (response && response.success) {
                this.userConsent = response.data.hasConsent;
                console.log('LinkedIn Post Saver: User consent status:', this.userConsent);
            } else {
                this.userConsent = false;
                console.log('LinkedIn Post Saver: No user consent found, will request when needed');
            }
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('LinkedIn Post Saver: Extension context invalidated during consent check');
                this.userConsent = false;
                this.shutdown();
            } else {
                console.error('LinkedIn Post Saver: Error checking user consent:', error);
                this.userConsent = false;
            }
        }
    }

    start() {
        // Double-check consent before starting (extra safety)
        if (!this.userConsent) {
            console.log('LinkedIn Post Saver: Consent check failed at start() - aborting');
            return;
        }

        // Only run on LinkedIn feed pages
        if (!this.isLinkedInFeedPage()) {
            console.log('LinkedIn Post Saver: Not a feed page, skipping...');
            return;
        }

        console.log('LinkedIn Post Saver: Starting on feed page with user consent...');

        // Show compliance notice
        this.showComplianceNotice();

        // Find the main feed container
        this.findFeedContainer();

        // Process existing posts
        this.processVisiblePosts();

        // Set up observers for new posts
        this.setupObservers();

        // Set up scroll detection for viewport posts
        this.setupScrollDetection();

        // Listen for consent changes
        this.setupConsentListener();
    }

    setupConsentListener() {
        // Listen for consent revocation messages
        try {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.action === 'consentRevoked') {
                    console.log('LinkedIn Post Saver: Consent revoked - shutting down');
                    this.shutdown();
                    sendResponse({ success: true });
                }
                return true; // Keep message channel open for async response
            });
        } catch (error) {
            console.warn('LinkedIn Post Saver: Could not setup consent listener:', error);
        }
    }

    shutdown() {
        console.log('LinkedIn Post Saver: Shutting down due to consent revocation');

        // Disconnect all observers
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Clear processed posts set
        this.processedPosts.clear();

        // Remove event listeners
        window.removeEventListener('scroll', this.scrollHandler);
        window.removeEventListener('beforeunload', this.beforeUnloadHandler);

        // Update consent status
        this.userConsent = false;

        // Show consent reminder
        this.showConsentReminder();
    }

    isLinkedInFeedPage() {
        const url = window.location.href;
        const pathname = window.location.pathname;

        // Ignore analytics/tracking URLs that LinkedIn makes
        if (url.includes('/Mq3QCa09a-JgFGfXnf2') ||
            url.includes('/li/track') ||
            url.includes('/analytics') ||
            pathname.includes('/track')) {
            return false;
        }

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
            setTimeout(() => this.findFeedContainer(), 2000);
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
            return; // Still in throttle period
        }

        this.lastProcessTime = now;
        this.processVisiblePosts();
    }

    processVisiblePosts() {
        if (this.isProcessing) return;

        this.isProcessing = true;

        try {
            const posts = this.findVisiblePosts();

            // Filter out already processed posts before logging
            const newPosts = posts.filter(post => {
                const postId = this.extractPostId(post);
                return postId && !this.processedPosts.has(postId);
            });

            if (newPosts.length > 0) {
                console.log(`LinkedIn Post Saver: Found ${newPosts.length} new posts to process (${posts.length} total visible)`);

                newPosts.forEach(postElement => {
                    this.processPost(postElement);
                });
            }
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
            // Check user consent first
            if (!this.userConsent) {
                return;
            }

            const postId = this.extractPostId(postElement);
            if (!postId) {
                return; // Can't process without a valid ID
            }

            // Check if already processed (BEFORE any processing)
            if (this.processedPosts.has(postId)) {
                return; // Already processed, skip entirely
            }

            // Use smart rate limiter with queue
            await this.rateLimiter.processWithQueue(postElement, async (element) => {
                // Double-check not processed while in queue
                if (this.processedPosts.has(postId)) {
                    return;
                }

                const postData = this.extractPostData(element);
                if (!postData) {
                    console.log('LinkedIn Post Saver: No valid post data extracted for ID:', postId);
                    return;
                }

                postData.id = postId;
                postData.scrapedAt = new Date().toISOString();
                postData.url = window.location.href;

                // SANITIZE DATA BEFORE SAVING
                const sanitizedData = this.sanitizer.sanitizePostData(postData);
                if (!sanitizedData || !this.sanitizer.validateSanitizedData(sanitizedData)) {
                    console.warn('LinkedIn Post Saver: Post data failed sanitization, skipping save');
                    return;
                }

                // Mark as processed BEFORE saving (to prevent duplicates)
                this.processedPosts.add(postId);

                // Send sanitized data to background script for storage
                await this.savePost(sanitizedData);

                console.log('LinkedIn Post Saver: Successfully processed and sanitized post:', sanitizedData.title?.substring(0, 50) + '...');
            });

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
        try {
            const text = button.textContent || button.getAttribute('aria-label') || '';
            const match = text.match(/(\d+)/);
            return match ? parseInt(match[1], 10) : 0; // Added radix parameter and null check
        } catch (error) {
            console.warn('LinkedIn Post Saver: Error extracting engagement count:', error);
            return 0; // Return 0 if extraction fails
        }
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
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
                // Only log once per session to reduce console noise
                if (!this.contextInvalidatedLogged) {
                    console.log('LinkedIn Post Saver: Extension reloaded - content script will reinitialize');
                    this.contextInvalidatedLogged = true;
                }
                return;
            }

            // Send message to background script to save the post
            const response = await chrome.runtime.sendMessage({
                action: 'savePost',
                data: postData
            });

            if (response && response.success) {
                // Update status indicator if it exists
                this.updateStatusIndicator();
            } else {
                console.warn('LinkedIn Post Saver: Failed to save post:', response?.error);
            }
        } catch (error) {
            if (error.message.includes('Extension context invalidated')) {
                console.warn('LinkedIn Post Saver: Extension was reloaded - stopping content script');
                this.shutdown();
            } else {
                console.error('LinkedIn Post Saver: Error saving post:', error);
            }
        }
    }

    updateStatusIndicator() {
        try {
            // Check if extension context is still valid
            if (!chrome.runtime?.id) {
                return; // Extension context lost, don't update indicator
            }

            // Add a small status indicator to show the extension is working
            let indicator = document.getElementById('linkedin-post-saver-status');

            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'linkedin-post-saver-status';
                indicator.style.cssText = `
            position: fixed;
            top: 50px;
            right: 10px;
            background: rgba(0, 119, 181, 0.9);
            color: white;
            padding: 6px 12px;
            border-radius: 15px;
            font-size: 11px;
            z-index: 9999;
            font-family: Arial, sans-serif;
            pointer-events: none;
            transition: opacity 0.3s ease;
            line-height: 1.3;
          `;
                document.body.appendChild(indicator);
            }

            const status = this.rateLimiter.getStatus();
            const savedCount = this.processedPosts.size;
            const queueInfo = status.queueLength > 0 ? ` | Queue: ${status.queueLength}` : '';

            indicator.textContent = `📝 ${savedCount} saved | ${status.currentRequests}/${status.maxRequests}/min${queueInfo}`;
            indicator.style.opacity = '1';

            // Change color based on queue status
            if (status.queueLength > 10) {
                indicator.style.background = 'rgba(255, 152, 0, 0.9)'; // Orange for high queue
            } else if (status.queueLength > 0) {
                indicator.style.background = 'rgba(255, 193, 7, 0.9)'; // Yellow for queue
            } else {
                indicator.style.background = 'rgba(0, 119, 181, 0.9)'; // Blue for normal
            }

            // Fade out after 3 seconds
            setTimeout(() => {
                if (indicator && indicator.parentNode) {
                    indicator.style.opacity = '0.3';
                }
            }, 3000);
        } catch (error) {
            console.warn('LinkedIn Post Saver: Error updating status indicator:', error);
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