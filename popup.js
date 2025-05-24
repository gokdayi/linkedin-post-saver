/**
 * LinkedIn Post Saver - Popup JavaScript
 * Handles the extension popup interface and user interactions
 */

class PopupController {
    constructor() {
        this.currentTab = 'saved-posts';
        this.currentPage = 1;
        this.postsPerPage = 10;
        this.totalPosts = 0;
        this.currentPosts = [];
        this.settings = {};
        this.userConsent = false;

        this.init();
    }

    async init() {
        console.log('LinkedIn Post Saver Popup: Initializing...');

        // Check user consent first
        await this.checkUserConsent();

        // If no consent, show consent dialog instead
        if (!this.userConsent) {
            this.showConsentRequired();
            return;
        }

        // Setup event listeners
        this.setupEventListeners();

        this.initializeStorageSettings();

        // Load initial data
        await this.loadInitialData();

        // Setup tab navigation
        this.setupTabNavigation();

        // Start storage monitoring
        this.startStorageMonitoring();

        console.log('LinkedIn Post Saver Popup: Initialized successfully');
    }

    async checkUserConsent() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getUserConsent' });
            if (response && response.success) {
                this.userConsent = response.data.hasConsent;
                console.log('User consent status:', this.userConsent);
            }
        } catch (error) {
            console.error('Error checking user consent:', error);
            this.userConsent = false;
        }
    }

    showConsentRequired() {
        // Replace popup content with consent notice
        const consentHTML = `
        <div style="width: 350px; padding: 20px; text-align: center; font-family: Arial, sans-serif;">
          <div style="background: linear-gradient(135deg, #0077b5, #005885); color: white; padding: 20px; margin: -20px -20px 20px -20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 18px;">🔒 Privacy Consent Required</h1>
          </div>
          
          <div style="margin: 20px 0;">
            <p style="margin-bottom: 16px; color: #666; line-height: 1.4;">
              Before using LinkedIn Post Saver, please review and accept our privacy terms.
            </p>
            
            <div style="background: #f8f9fa; padding: 16px; border-radius: 6px; margin: 16px 0; text-align: left;">
              <h3 style="margin: 0 0 8px 0; color: #333; font-size: 14px;">Quick Summary:</h3>
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; color: #666;">
                <li>Saves posts locally on your device only</li>
                <li>No data sent to external servers</li>
                <li>Respects LinkedIn's Terms of Service</li>
                <li>You control all your data</li>
              </ul>
            </div>
          </div>
          
          <button id="showConsentDialog" style="
            background: #0077b5; 
            color: white; 
            border: none; 
            padding: 12px 24px; 
            border-radius: 6px; 
            cursor: pointer; 
            font-size: 14px;
            font-weight: 500;
            width: 100%;
            margin-bottom: 10px;
          ">
            📋 Review Terms & Give Consent
          </button>
          
          <button id="closePopup" style="
            background: #f1f3f4; 
            color: #666; 
            border: 1px solid #e0e0e0; 
            padding: 10px 20px; 
            border-radius: 6px; 
            cursor: pointer; 
            font-size: 13px;
            width: 100%;
          ">
            ❌ Close Without Consent
          </button>
          
          <p style="margin-top: 16px; font-size: 11px; color: #999; line-height: 1.3;">
            This extension requires your explicit consent to save LinkedIn posts locally on your device.
          </p>
        </div>
      `;

        // Clear existing content and set new HTML
        document.body.innerHTML = consentHTML;

        // Add event listeners AFTER setting innerHTML to avoid CSP issues
        const showConsentBtn = document.getElementById('showConsentDialog');
        const closeBtn = document.getElementById('closePopup');

        if (showConsentBtn) {
            showConsentBtn.addEventListener('click', () => {
                this.openConsentDialog();
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.close();
            });
        }
    }

    openConsentDialog() {
        // Open consent dialog in a new tab or popup
        chrome.tabs.create({
            url: chrome.runtime.getURL('consent-dialog.html'),
            active: true
        });

        // Close current popup
        window.close();
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Saved Posts tab
        document.getElementById('refreshPosts')?.addEventListener('click', () => this.refreshPosts());
        document.getElementById('exportPosts')?.addEventListener('click', () => this.exportPosts());
        document.getElementById('authorFilter')?.addEventListener('change', () => this.filterPosts());
        document.getElementById('dateFilter')?.addEventListener('change', () => this.filterPosts());
        document.getElementById('prevPage')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage')?.addEventListener('click', () => this.nextPage());

        // Search tab
        document.getElementById('searchButton')?.addEventListener('click', () => this.performSearch());
        document.getElementById('searchInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.performSearch();
        });
        document.getElementById('searchInput')?.addEventListener('input', this.debounce(() => this.performSearch(), 300));

        // Stats tab
        document.getElementById('refreshStats')?.addEventListener('click', () => this.loadStats());
        document.getElementById('cleanupOldPosts')?.addEventListener('click', () => this.cleanupOldPosts());
        document.getElementById('exportAllPosts')?.addEventListener('click', () => this.exportAllPosts());

        // Settings tab
        document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('importPosts')?.addEventListener('click', () => this.importPosts());
        document.getElementById('importFile')?.addEventListener('change', (e) => this.handleFileImport(e));
        document.getElementById('clearAllData')?.addEventListener('click', () => this.clearAllData());
        document.getElementById('reviewConsent')?.addEventListener('click', () => this.reviewConsent());
        document.getElementById('revokeConsent')?.addEventListener('click', () => this.revokeConsent());
        document.getElementById('viewComplianceDetails')?.addEventListener('click', () => this.viewComplianceDetails());
        document.getElementById('openComplianceDetails')?.addEventListener('click', () => this.viewComplianceDetails());
        document.getElementById('runComplianceCheck')?.addEventListener('click', () => this.runComplianceCheck());
        document.getElementById('reviewLinkedInTerms')?.addEventListener('click', () => this.reviewLinkedInTerms());
        document.getElementById('viewOpenSource')?.addEventListener('click', () => this.viewOpenSource());
        document.getElementById('reportCompliance')?.addEventListener('click', () => this.reportCompliance());

        // Storage Management
        document.getElementById('optimizeStorage')?.addEventListener('click', () => this.optimizeStorage());
        document.getElementById('checkStorageQuota')?.addEventListener('click', () => this.checkStorageQuota());
        document.getElementById('forceCleanup')?.addEventListener('click', () => this.forceCleanup());
        document.getElementById('exportBeforeCleanup')?.addEventListener('click', () => this.exportBeforeCleanup());
        document.getElementById('dismissStorageAlert')?.addEventListener('click', () => this.dismissStorageAlert());
        document.getElementById('emergencyOptimize')?.addEventListener('click', () => this.emergencyOptimize());
        document.getElementById('emergencyCleanup')?.addEventListener('click', () => this.emergencyCleanup());
        document.getElementById('exportAndClear')?.addEventListener('click', () => this.exportAndClear());
        document.getElementById('resetStorageSettings')?.addEventListener('click', () => this.resetStorageSettings());

        // Footer
        document.getElementById('openLinkedIn')?.addEventListener('click', () => this.openLinkedIn());

        // Notification close
        document.getElementById('closeNotification')?.addEventListener('click', () => this.hideNotification());
    }

    async loadInitialData() {
        try {
            this.showLoading('Loading data...');

            // Load settings
            await this.loadSettings();

            // Load posts for the current tab
            await this.loadPosts();

            // Update header stats
            await this.updateHeaderStats();

        } catch (error) {
            console.error('Error loading initial data:', error);
            this.showNotification('Error loading data', 'error');
        } finally {
            this.hideLoading();
        }
    }

    async loadSettings() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSettings' });

            if (response.success) {
                this.settings = response.data;
                this.populateSettingsForm();
            }

            // Also load and display consent status
            await this.loadConsentStatus();

            // Load compliance status
            await this.loadComplianceStatus();
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async loadConsentStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getUserConsent' });

            if (response && response.success) {
                const consentData = response.data;
                const statusElement = document.getElementById('consentStatusText');

                if (statusElement) {
                    if (consentData.hasConsent) {
                        statusElement.textContent = `✅ Granted on ${new Date(consentData.consentDate).toLocaleDateString()}`;
                        statusElement.style.color = '#4caf50';
                    } else {
                        statusElement.textContent = '❌ Not granted';
                        statusElement.style.color = '#f44336';
                    }
                }
            }
        } catch (error) {
            console.error('Error loading consent status:', error);
        }
    }

    async loadComplianceStatus() {
        try {
            // Check compliance status with background script
            const response = await chrome.runtime.sendMessage({ action: 'checkCompliance' });

            if (response && response.success) {
                const complianceData = response.data;
                this.updateComplianceStatusDisplay(complianceData);
            }
        } catch (error) {
            console.error('Error loading compliance status:', error);
        }
    }

    updateComplianceStatusDisplay(complianceData) {
        const statusElement = document.querySelector('.compliance-status h4');
        const statusDescription = document.querySelector('.compliance-status p');

        if (statusElement && statusDescription) {
            const allCompliant = Object.values(complianceData).every(status => status === true);

            if (allCompliant) {
                statusElement.textContent = '✅ Compliance Status: Active';
                statusElement.style.color = '#4caf50';
                statusDescription.textContent = 'All compliance measures are active and functioning correctly';
            } else {
                statusElement.textContent = '⚠️ Compliance Status: Issues Detected';
                statusElement.style.color = '#ff9800';
                statusDescription.textContent = 'Some compliance measures need attention. Click "View Full Compliance Details" for more info.';
            }
        }
    }

    populateSettingsForm() {
        // Storage settings
        const maxPosts = document.getElementById('maxPosts');
        if (maxPosts) maxPosts.value = this.settings.maxPosts || 1000;

        const autoCleanup = document.getElementById('autoCleanup');
        if (autoCleanup) autoCleanup.checked = this.settings.autoCleanup !== false;

        const cleanupDays = document.getElementById('cleanupDays');
        if (cleanupDays) cleanupDays.value = this.settings.cleanupDays || 30;

        // Content settings
        const saveImages = document.getElementById('saveImages');
        if (saveImages) saveImages.checked = this.settings.saveImages !== false;

        const saveVideos = document.getElementById('saveVideos');
        if (saveVideos) saveVideos.checked = this.settings.saveVideos === true;

        // Notification settings
        const enableNotifications = document.getElementById('enableNotifications');
        if (enableNotifications) enableNotifications.checked = this.settings.enableNotifications !== false;

        // NEW: Storage management settings
        const enableStorageOptimization = document.getElementById('enableStorageOptimization');
        if (enableStorageOptimization) enableStorageOptimization.checked = this.settings.enableStorageOptimization !== false;

        const storageWarningThreshold = document.getElementById('storageWarningThreshold');
        if (storageWarningThreshold) storageWarningThreshold.value = this.settings.storageWarningThreshold || 80;

        const enableStorageNotifications = document.getElementById('enableStorageNotifications');
        if (enableStorageNotifications) enableStorageNotifications.checked = this.settings.enableStorageNotifications !== false;
    }

    async loadPosts(filters = {}) {
        try {
            const response = await chrome.runtime.sendMessage({
                action: 'getPosts',
                filters: {
                    ...filters,
                    page: this.currentPage,
                    limit: this.postsPerPage
                }
            });

            if (response.success) {
                this.currentPosts = response.data.posts;
                this.totalPosts = response.data.totalCount;
                this.displayPosts(this.currentPosts);
                this.updatePagination(response.data);
                this.populateAuthorFilter();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showNotification('Error loading posts', 'error');
        }
    }

    displayPosts(posts) {
        const container = document.getElementById('postsContainer');
        const loading = document.getElementById('postsLoading');

        if (loading) loading.style.display = 'none';

        if (!container) return;

        if (posts.length === 0) {
            container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📝</div>
            <div class="empty-state-title">No Posts Found</div>
            <div class="empty-state-description">
              Visit LinkedIn and scroll through your feed to start saving posts automatically.
            </div>
          </div>
        `;
            return;
        }

        container.innerHTML = posts.map(post => this.createPostHTML(post)).join('');

        // Add click handlers for post items
        container.querySelectorAll('.post-item').forEach((item, index) => {
            item.addEventListener('click', () => this.openPost(posts[index]));
        });

        // Add click handlers for post links (CSP compliant)
        container.querySelectorAll('.post-link[data-post-link="true"]').forEach(link => {
            link.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent post item click
            });
        });
    }

    createPostHTML(post) {
        const formattedDate = this.formatDate(post.savedAt || post.timestamp);

        // SANITIZE ALL OUTPUT DATA
        const authorAvatar = this.sanitizeForDisplay(post.author?.avatar) || '/api/placeholder/40/40';
        const authorName = this.sanitizeForDisplay(post.author?.name) || 'Unknown Author';
        const authorTitle = this.sanitizeForDisplay(post.author?.title) || '';
        const postTitle = this.sanitizeForDisplay(post.title) || 'LinkedIn Post';
        const postText = this.sanitizeForDisplay(post.text) || '';
        const mediaCount = post.media ? post.media.length : 0;

        // Validate URLs before using them
        const safePostUrl = this.validateUrl(post.postUrl);

        return `
        <div class="post-item" data-post-id="${this.escapeHtml(post.id)}">
          <div class="post-header">
            <img src="${this.escapeHtml(authorAvatar)}" alt="${this.escapeHtml(authorName)}" class="post-avatar" 
                 onerror="this.src='/api/placeholder/40/40'">
            <div class="post-author">
              <div class="post-author-name">${this.escapeHtml(authorName)}</div>
              ${authorTitle ? `<div class="post-author-title">${this.escapeHtml(authorTitle)}</div>` : ''}
            </div>
            <div class="post-date">${this.escapeHtml(formattedDate)}</div>
          </div>
          
          <div class="post-content">
            <div class="post-title">${this.escapeHtml(postTitle)}</div>
            ${postText ? `<div class="post-text">${this.escapeHtml(postText)}</div>` : ''}
          </div>
          
          ${this.createMediaHTML(post.media)}
          
          <div class="post-actions">
            <div class="post-engagement">
              ${post.engagement?.likes ? `👍 ${this.escapeHtml(post.engagement.likes.toString())}` : ''}
              ${post.engagement?.comments ? `💬 ${this.escapeHtml(post.engagement.comments.toString())}` : ''}
              ${post.engagement?.shares ? `🔄 ${this.escapeHtml(post.engagement.shares.toString())}` : ''}
              ${mediaCount > 0 ? `📎 ${this.escapeHtml(mediaCount.toString())} media` : ''}
            </div>
            ${safePostUrl ?
                `<a href="${this.escapeHtml(safePostUrl)}" target="_blank" class="post-link" data-post-link="true">
                View Original
              </a>` : ''
            }
          </div>
        </div>
      `;
    }

    createMediaHTML(media) {
        if (!media || media.length === 0) return '';

        // Sanitize and validate media items
        const safeMedia = media
            .slice(0, 3) // Limit display
            .filter(item => item && item.type && item.url)
            .map(item => ({
                type: item.type,
                url: this.validateUrl(item.url),
                alt: this.sanitizeForDisplay(item.alt) || 'Media content'
            }))
            .filter(item => item.url); // Only include items with valid URLs

        if (safeMedia.length === 0) return '';

        const mediaItems = safeMedia.map(item => {
            if (item.type === 'image') {
                return `<img src="${this.escapeHtml(item.url)}" alt="${this.escapeHtml(item.alt)}" class="post-media-item" 
                       onerror="this.style.display='none'">`;
            }
            return '';
        }).join('');

        const moreCount = media.length > 3 ? media.length - 3 : 0;

        return `
        <div class="post-media">
          ${mediaItems}
          ${moreCount > 0 ? `<div class="post-media-more">+${this.escapeHtml(moreCount.toString())} more</div>` : ''}
        </div>
      `;
    }

    // Sanitize text for display (removes HTML, scripts, etc.)
    sanitizeForDisplay(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }

        let sanitized = text;

        // Remove HTML tags
        sanitized = sanitized.replace(/<[^>]*>/g, '');

        // Remove script protocols
        sanitized = sanitized.replace(/javascript:/gi, '');
        sanitized = sanitized.replace(/vbscript:/gi, '');
        sanitized = sanitized.replace(/data:/gi, '');

        // Remove control characters
        sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

        // Limit length for display
        if (sanitized.length > 1000) {
            sanitized = sanitized.substring(0, 1000) + '...';
        }

        return sanitized.trim();
    }

    // Validate URLs before using them - FIXED to allow LinkedIn media
    validateUrl(url) {
        if (!url || typeof url !== 'string') {
            return '';
        }

        try {
            const urlObj = new URL(url);

            // Only allow HTTP/HTTPS
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                return '';
            }

            // Allow LinkedIn URLs AND LinkedIn media CDN URLs
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
        } catch (error) {
            return '';
        }
    }

    // Enhanced HTML escaping
    escapeHtml(text) {
        if (!text) return '';

        const div = document.createElement('div');
        div.textContent = text.toString();
        return div.innerHTML;
    }

    populateAuthorFilter() {
        const authorFilter = document.getElementById('authorFilter');
        if (!authorFilter) return;

        const authors = new Set();
        this.currentPosts.forEach(post => {
            if (post.author?.name) {
                authors.add(post.author.name);
            }
        });

        const currentValue = authorFilter.value;
        authorFilter.innerHTML = '<option value="">All authors</option>';

        Array.from(authors).sort().forEach(author => {
            const option = document.createElement('option');
            option.value = author;
            option.textContent = author;
            authorFilter.appendChild(option);
        });

        authorFilter.value = currentValue;
    }

    async updateHeaderStats() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStats' });

            if (response.success) {
                const stats = response.data;
                const totalPostsElement = document.getElementById('totalPosts');
                if (totalPostsElement) {
                    totalPostsElement.textContent = `${stats.totalPosts} posts`;
                }
            }
        } catch (error) {
            console.error('Error updating header stats:', error);
        }
    }

    updatePagination(data) {
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        const pageInfo = document.getElementById('pageInfo');

        if (prevButton) {
            prevButton.disabled = data.page <= 1;
        }

        if (nextButton) {
            nextButton.disabled = !data.hasMore;
        }

        if (pageInfo) {
            const totalPages = Math.ceil(data.totalCount / data.limit);
            pageInfo.textContent = `Page ${data.page} of ${totalPages}`;
        }
    }

    setupTabNavigation() {
        // Set initial active tab
        this.switchTab(this.currentTab);
    }

    switchTab(tabName) {
        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.getElementById(tabName)?.classList.add('active');

        this.currentTab = tabName;

        // Load tab-specific data
        this.loadTabData(tabName);
    }

    async loadTabData(tabName) {
        try {
            switch (tabName) {
                case 'saved-posts':
                    await this.loadPosts();
                    break;
                case 'search':
                    // Search tab doesn't need initial loading
                    break;
                case 'stats':
                    await this.loadStats();
                    break;
                case 'settings':
                    await this.loadSettings();
                    break;
            }
        } catch (error) {
            console.error(`Error loading ${tabName} data:`, error);
        }
    }

    async loadStats() {
        try {
            this.showLoading('Loading statistics...');

            const response = await chrome.runtime.sendMessage({ action: 'getStats' });

            if (response.success) {
                this.displayStats(response.data);

                // Also load storage info when loading stats
                await this.loadStorageInfo();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            this.showNotification('Error loading statistics', 'error');
        } finally {
            this.hideLoading();
        }
    }

    displayStats(stats) {
        // Update stat cards
        const statElements = {
            'statTotalPosts': stats.totalPosts,
            'statPostsToday': stats.postsToday,
            'statPostsWeek': stats.postsThisWeek,
            'statPostsMonth': stats.postsThisMonth,
            'statWithMedia': stats.postsWithMedia,
            'statAuthors': stats.uniqueAuthors
        };

        Object.entries(statElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value || 0;
        });

        // Update storage info
        const storageUsed = document.getElementById('storageUsed');
        if (storageUsed && stats.storageSize) {
            storageUsed.textContent = stats.storageSize.formatted;
        }

        const oldestPost = document.getElementById('oldestPost');
        if (oldestPost) {
            oldestPost.textContent = stats.oldestPost ?
                this.formatDate(stats.oldestPost) : '-';
        }

        const newestPost = document.getElementById('newestPost');
        if (newestPost) {
            newestPost.textContent = stats.newestPost ?
                this.formatDate(stats.newestPost) : '-';
        }
    }

    async performSearch() {
        const searchInput = document.getElementById('searchInput');
        const searchResults = document.getElementById('searchResults');

        if (!searchInput || !searchResults) return;

        const query = searchInput.value.trim();

        if (query.length === 0) {
            searchResults.innerHTML = `
          <div class="search-placeholder">
            <p>🔍 Enter a search term to find your saved posts</p>
          </div>
        `;
            return;
        }

        try {
            this.showLoading('Searching posts...');

            const filters = {
                hasMedia: document.getElementById('searchWithMedia')?.checked
            };

            const response = await chrome.runtime.sendMessage({
                action: 'searchPosts',
                query: query,
                filters: filters
            });

            if (response.success) {
                this.displaySearchResults(response.data.posts, query);
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error searching posts:', error);
            this.showNotification('Error searching posts', 'error');
        } finally {
            this.hideLoading();
        }
    }

    displaySearchResults(posts, query) {
        const container = document.getElementById('searchResults');
        if (!container) return;

        if (posts.length === 0) {
            container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No Results Found</div>
            <div class="empty-state-description">
              No posts found matching "${this.escapeHtml(query)}". Try different keywords.
            </div>
          </div>
        `;
            return;
        }

        container.innerHTML = `
        <div class="search-summary">
          <p>Found ${posts.length} posts matching "${this.escapeHtml(query)}"</p>
        </div>
        ${posts.map(post => this.createPostHTML(post)).join('')}
      `;

        // Add click handlers for search results
        container.querySelectorAll('.post-item').forEach((item, index) => {
            item.addEventListener('click', () => this.openPost(posts[index]));
        });

        // Add click handlers for post links in search results (CSP compliant)
        container.querySelectorAll('.post-link[data-post-link="true"]').forEach(link => {
            link.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent post item click
            });
        });
    }

    async filterPosts() {
        const authorFilter = document.getElementById('authorFilter');
        const dateFilter = document.getElementById('dateFilter');

        const filters = {};

        if (authorFilter?.value) {
            filters.author = authorFilter.value;
        }

        if (dateFilter?.value) {
            const now = new Date();
            switch (dateFilter.value) {
                case 'today':
                    filters.dateFrom = new Date(now.setHours(0, 0, 0, 0)).toISOString();
                    break;
                case 'week':
                    filters.dateFrom = new Date(now.setDate(now.getDate() - 7)).toISOString();
                    break;
                case 'month':
                    filters.dateFrom = new Date(now.setDate(now.getDate() - 30)).toISOString();
                    break;
            }
        }

        this.currentPage = 1;
        await this.loadPosts(filters);
    }

    async refreshPosts() {
        this.currentPage = 1;
        await this.loadPosts();
        await this.updateHeaderStats();
        this.showNotification('Posts refreshed successfully');
    }

    async previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            await this.loadPosts();
        }
    }

    async nextPage() {
        this.currentPage++;
        await this.loadPosts();
    }

    async saveSettings() {
        try {
            const newSettings = {
                maxPosts: parseInt(document.getElementById('maxPosts')?.value) || 1000,
                autoCleanup: document.getElementById('autoCleanup')?.checked,
                cleanupDays: parseInt(document.getElementById('cleanupDays')?.value) || 30,
                saveImages: document.getElementById('saveImages')?.checked,
                saveVideos: document.getElementById('saveVideos')?.checked,
                enableNotifications: document.getElementById('enableNotifications')?.checked,

                // NEW: Storage management settings
                enableStorageOptimization: document.getElementById('enableStorageOptimization')?.checked,
                storageWarningThreshold: parseInt(document.getElementById('storageWarningThreshold')?.value) || 80,
                enableStorageNotifications: document.getElementById('enableStorageNotifications')?.checked
            };

            // Validate settings
            if (newSettings.maxPosts < 100 || newSettings.maxPosts > 5000) {
                throw new Error('Maximum posts must be between 100 and 5000');
            }

            if (newSettings.cleanupDays < 7 || newSettings.cleanupDays > 365) {
                throw new Error('Cleanup days must be between 7 and 365');
            }

            const response = await chrome.runtime.sendMessage({
                action: 'updateSettings',
                settings: newSettings
            });

            if (response.success) {
                this.settings = newSettings;
                this.showNotification('Settings saved successfully');

                // Refresh storage info to reflect new settings
                await this.loadStorageInfo();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            this.showNotification(error.message || 'Error saving settings', 'error');
        }
    }

    async exportPosts() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'exportPosts' });

            if (response.success) {
                this.downloadJSON(response.data, `linkedin-posts-${new Date().toISOString().split('T')[0]}.json`);
                this.showNotification('Posts exported successfully');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error exporting posts:', error);
            this.showNotification('Error exporting posts', 'error');
        }
    }

    async exportAllPosts() {
        await this.exportPosts();
    }

    importPosts() {
        const fileInput = document.getElementById('importFile');
        if (fileInput) {
            fileInput.click();
        }
    }

    async handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await this.readFileAsText(file);
            const data = JSON.parse(text);

            const response = await chrome.runtime.sendMessage({
                action: 'importPosts',
                data: data
            });

            if (response.success) {
                this.showNotification('Posts imported successfully');
                await this.refreshPosts();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error importing posts:', error);
            this.showNotification('Error importing posts. Please check the file format.', 'error');
        }
    }

    async cleanupOldPosts() {
        if (!confirm('This will remove old posts according to your cleanup settings. Continue?')) {
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({ action: 'cleanup' });

            if (response.success) {
                this.showNotification('Old posts cleaned up successfully');
                await this.refreshPosts();
                await this.loadStats();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error cleaning up posts:', error);
            this.showNotification('Error cleaning up posts', 'error');
        }
    }

    async clearAllData() {
        if (!confirm('⚠️ This will permanently delete ALL saved posts and settings. This action cannot be undone. Are you sure?')) {
            return;
        }

        if (!confirm('Last warning: This will delete EVERYTHING. Continue?')) {
            return;
        }

        try {
            // Note: We'd need to add this action to background script
            const response = await chrome.runtime.sendMessage({ action: 'clearAllData' });

            if (response.success) {
                this.showNotification('All data cleared successfully');
                await this.loadInitialData();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error clearing data:', error);
            this.showNotification('Error clearing data', 'error');
        }
    }

    async openPost(post) {
        if (post.postUrl) {
            chrome.tabs.create({ url: post.postUrl });
        } else if (post.url) {
            chrome.tabs.create({ url: post.url });
        } else {
            this.showNotification('No URL available for this post', 'warning');
        }
    }

    async openLinkedIn() {
        chrome.tabs.create({ url: 'https://www.linkedin.com/feed/' });
    }

    // Utility Methods

    formatDate(dateString) {
        if (!dateString) return 'Unknown';

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Invalid Date';

        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor(diffMs / (1000 * 60));

        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;

        return date.toLocaleDateString();
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    showLoading(text = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');

        if (overlay) {
            overlay.classList.remove('hidden');
            if (loadingText) loadingText.textContent = text;
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showNotification(message, type = 'success') {
        const toast = document.getElementById('notificationToast');
        const text = document.getElementById('notificationText');

        if (!toast || !text) return;

        // Remove existing type classes
        toast.classList.remove('error', 'warning', 'success');

        // Add new type class
        if (type !== 'success') {
            toast.classList.add(type);
        }

        text.textContent = message;
        toast.classList.remove('hidden');

        // Auto hide after 3 seconds
        setTimeout(() => {
            this.hideNotification();
        }, 3000);
    }

    hideNotification() {
        const toast = document.getElementById('notificationToast');
        if (toast) {
            toast.classList.add('hidden');
        }
    }

    // Consent management methods
    reviewConsent() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('consent-dialog.html'),
            active: true
        });
    }

    async revokeConsent() {
        if (!confirm('⚠️ Are you sure you want to revoke consent?\n\nThis will:\n• Stop saving new posts\n• Keep existing data (unless you delete it)\n• Require consent again to resume\n\nContinue?')) {
            return;
        }

        try {
            const response = await chrome.runtime.sendMessage({
                action: 'setUserConsent',
                consent: false
            });

            if (response && response.success) {
                this.showNotification('Consent revoked successfully');
                await this.loadConsentStatus();

                // Update user consent status
                this.userConsent = false;

                // Show consent required message
                setTimeout(() => {
                    this.showConsentRequired();
                }, 1500);
            } else {
                throw new Error('Failed to revoke consent');
            }
        } catch (error) {
            console.error('Error revoking consent:', error);
            this.showNotification('Error revoking consent', 'error');
        }
    }

    viewComplianceDetails() {
        chrome.tabs.create({
            url: chrome.runtime.getURL('compliance-details.html'),
            active: true
        });
    }

    reviewLinkedInTerms() {
        chrome.tabs.create({
            url: 'https://www.linkedin.com/legal/user-agreement',
            active: true
        });
    }

    viewOpenSource() {
        chrome.tabs.create({
            url: 'https://github.com/gokdayi/linkedin-post-saver',
            active: true
        });
    }

    reportCompliance() {
        // Create a simple mailto link for compliance reports
        const subject = encodeURIComponent('LinkedIn Post Saver - Compliance Concern');
        const body = encodeURIComponent(`
  Please describe your compliance concern:
  
  Extension Version: 1.0
  Date: ${new Date().toISOString()}
  LinkedIn URL: ${window.location?.href || 'N/A'}
  
  Concern Details:
  [Please describe the issue]
  
  Steps to Reproduce:
  [If applicable]
  
  Expected Behavior:
  [What should happen instead]
      `);

        // You can replace this email with your actual contact email
        const mailto = `mailto:hi@gokdayi.com?subject=${subject}&body=${body}`;
        chrome.tabs.create({ url: mailto });
    }

    async runComplianceCheck() {
        try {
            const checkButton = document.getElementById('runComplianceCheck');
            if (checkButton) {
                checkButton.disabled = true;
                checkButton.textContent = '🔍 Checking...';
            }

            // Run compliance check
            await this.loadComplianceStatus();

            // Show notification
            this.showNotification('Compliance check completed successfully');

            // Reset button
            setTimeout(() => {
                if (checkButton) {
                    checkButton.disabled = false;
                    checkButton.innerHTML = '<span class="btn-icon">🔍</span> Run Compliance Check';
                }
            }, 2000);

        } catch (error) {
            console.error('Error running compliance check:', error);
            this.showNotification('Error running compliance check', 'error');

            // Reset button on error
            const checkButton = document.getElementById('runComplianceCheck');
            if (checkButton) {
                checkButton.disabled = false;
                checkButton.innerHTML = '<span class="btn-icon">🔍</span> Run Compliance Check';
            }
        }
    }

    /**
     * Emergency optimize storage
     */
    async emergencyOptimize() {
        if (!confirm('⚠️ This will aggressively optimize all saved posts to reduce storage usage.\n\nSome content may be truncated. Continue?')) {
            return;
        }

        const button = document.getElementById('emergencyOptimize');
        if (!button) return;

        try {
            button.classList.add('loading');
            button.disabled = true;

            // First, optimize storage
            const optimizeResponse = await chrome.runtime.sendMessage({ action: 'optimizeStorage' });

            if (optimizeResponse.success) {
                // Then check quota and perform additional cleanup if needed
                const quotaResponse = await chrome.runtime.sendMessage({ action: 'checkStorageQuota' });

                if (quotaResponse.success && quotaResponse.data.status === 'critical') {
                    // Force additional cleanup
                    await chrome.runtime.sendMessage({ action: 'forceStorageCleanup' });
                }

                this.showNotification('Emergency optimization completed successfully');

                // Refresh all data
                await this.loadStorageInfo();
                await this.refreshPosts();
                await this.loadStats();
            } else {
                throw new Error(optimizeResponse.error);
            }
        } catch (error) {
            console.error('Error in emergency optimize:', error);
            this.showNotification('Error performing emergency optimization', 'error');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    /**
     * Emergency cleanup
     */
    async emergencyCleanup() {
        if (!confirm('⚠️ This will remove a significant number of old posts to free up storage space.\n\nThis action cannot be undone. Continue?')) {
            return;
        }

        if (!confirm('Last warning: This will permanently delete old posts. Are you sure?')) {
            return;
        }

        const button = document.getElementById('emergencyCleanup');
        if (!button) return;

        try {
            button.classList.add('loading');
            button.disabled = true;

            // Perform aggressive cleanup
            const response = await chrome.runtime.sendMessage({ action: 'forceStorageCleanup' });

            if (response.success) {
                this.showNotification('Emergency cleanup completed successfully');

                // Refresh all data
                await this.loadStorageInfo();
                await this.refreshPosts();
                await this.loadStats();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error in emergency cleanup:', error);
            this.showNotification('Error performing emergency cleanup', 'error');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    /**
     * Export and clear all data
     */
    async exportAndClear() {
        if (!confirm('⚠️ This will export all your data and then clear all saved posts.\n\nThis is irreversible. Continue?')) {
            return;
        }

        if (!confirm('Final confirmation: Export data and delete ALL saved posts?')) {
            return;
        }

        const button = document.getElementById('exportAndClear');
        if (!button) return;

        try {
            button.classList.add('loading');
            button.disabled = true;

            // First export the data
            const exportResponse = await chrome.runtime.sendMessage({ action: 'exportPosts' });

            if (exportResponse.success) {
                // Download the export
                this.downloadJSON(
                    exportResponse.data,
                    `linkedin-posts-full-backup-${new Date().toISOString().split('T')[0]}.json`
                );

                // Wait a moment for download to start
                await new Promise(resolve => setTimeout(resolve, 1000));

                // Then clear all data
                const clearResponse = await chrome.runtime.sendMessage({ action: 'clearAllData' });

                if (clearResponse.success) {
                    this.showNotification('Data exported and all posts cleared successfully');

                    // Refresh all data
                    await this.loadStorageInfo();
                    await this.refreshPosts();
                    await this.loadStats();
                } else {
                    this.showNotification('Export successful, but failed to clear data', 'warning');
                }
            } else {
                throw new Error(exportResponse.error);
            }
        } catch (error) {
            console.error('Error in export and clear:', error);
            this.showNotification('Error exporting and clearing data', 'error');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    /**
     * Reset storage settings to defaults
     */
    async resetStorageSettings() {
        if (!confirm('Reset all storage settings to default values?')) {
            return;
        }

        try {
            const defaultStorageSettings = {
                maxPosts: 1000,
                autoCleanup: true,
                cleanupDays: 30,
                enableStorageOptimization: true,
                storageWarningThreshold: 80,
                enableStorageNotifications: true
            };

            // Merge with existing settings
            const currentSettings = await this.getSettingsForHealth();
            const newSettings = { ...currentSettings, ...defaultStorageSettings };

            const response = await chrome.runtime.sendMessage({
                action: 'updateSettings',
                settings: newSettings
            });

            if (response.success) {
                this.settings = newSettings;
                this.populateSettingsForm();
                this.showNotification('Storage settings reset to defaults');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error resetting storage settings:', error);
            this.showNotification('Error resetting storage settings', 'error');
        }
    }

    /**
     * Add storage validation warnings
     */
    addStorageValidationWarnings() {
        // Add validation for max posts input
        const maxPostsInput = document.getElementById('maxPosts');
        if (maxPostsInput) {
            maxPostsInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                const warningElement = this.getOrCreateWarning(e.target, 'maxPostsWarning');

                if (value < 100) {
                    warningElement.textContent = '⚠️ Very low limit - you may lose recent posts';
                    warningElement.style.color = '#f44336';
                } else if (value > 3000) {
                    warningElement.textContent = '⚠️ High limit - may cause storage issues on mobile';
                    warningElement.style.color = '#ff9800';
                } else {
                    warningElement.textContent = '';
                }
            });
        }

        // Add validation for cleanup days
        const cleanupDaysInput = document.getElementById('cleanupDays');
        if (cleanupDaysInput) {
            cleanupDaysInput.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                const warningElement = this.getOrCreateWarning(e.target, 'cleanupDaysWarning');

                if (value < 14) {
                    warningElement.textContent = '⚠️ Very short retention - posts will be deleted quickly';
                    warningElement.style.color = '#f44336';
                } else if (value > 90) {
                    warningElement.textContent = '⚠️ Long retention - may cause storage issues';
                    warningElement.style.color = '#ff9800';
                } else {
                    warningElement.textContent = '';
                }
            });
        }
    }

    /**
     * Get or create validation warning element
     */
    getOrCreateWarning(inputElement, warningId) {
        let warningElement = document.getElementById(warningId);

        if (!warningElement) {
            warningElement = document.createElement('div');
            warningElement.id = warningId;
            warningElement.style.cssText = `
            font-size: 11px;
            margin-top: 4px;
            font-weight: 500;
        `;
            inputElement.parentNode.appendChild(warningElement);
        }

        return warningElement;
    }

    /**
    * Initialize storage settings monitoring
    */
    initializeStorageSettings() {
        // Add validation warnings
        this.addStorageValidationWarnings();

        // Monitor storage warning threshold changes
        const thresholdSelect = document.getElementById('storageWarningThreshold');
        if (thresholdSelect) {
            thresholdSelect.addEventListener('change', async () => {
                // Update the quota manager thresholds if needed
                await this.loadStorageInfo();
            });
        }
    }

    /**
    * Load and display storage information
    */
    async loadStorageInfo() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getStorageInfo' });

            if (response.success) {
                this.displayStorageInfo(response.data);
                await this.updateStorageHealth(response.data);
            } else {
                console.error('Error loading storage info:', response.error);
                this.showStorageError();
            }
        } catch (error) {
            console.error('Error loading storage info:', error);
            this.showStorageError();
        }
    }

    /**
     * Display storage information in the UI
     */
    displayStorageInfo(storageInfo) {
        // Update usage progress bar
        const progressBar = document.getElementById('storageUsageProgress');
        const usageText = document.getElementById('storageUsageText');

        if (progressBar && usageText) {
            const percentUsed = Math.round(storageInfo.percentUsed * 100);
            progressBar.style.width = `${percentUsed}%`;
            usageText.textContent = `${storageInfo.formatted.totalSize} of ${storageInfo.formatted.estimatedQuota} used (${percentUsed}%)`;

            // Update progress bar color based on usage
            if (percentUsed >= 95) {
                progressBar.style.background = '#f44336';
            } else if (percentUsed >= 80) {
                progressBar.style.background = '#ff9800';
            } else {
                progressBar.style.background = '#4caf50';
            }
        }

        // Update detail cards
        const elements = {
            'totalStorageUsage': storageInfo.formatted.totalSize,
            'postsStorageUsage': storageInfo.formatted.postsSize,
            'storageUsagePercent': storageInfo.formatted.percentUsed,
            'postCountValue': storageInfo.postCount.toLocaleString()
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });

        // Show storage alert if needed
        this.showStorageAlert(storageInfo);
    }

    /**
     * Show storage alert based on usage
     */
    showStorageAlert(storageInfo) {
        const alert = document.getElementById('storageAlert');
        const title = document.getElementById('storageAlertTitle');
        const message = document.getElementById('storageAlertMessage');

        if (!alert || !title || !message) return;

        const percentUsed = Math.round(storageInfo.percentUsed * 100);

        if (percentUsed >= 95) {
            alert.classList.remove('hidden');
            alert.classList.add('critical');
            title.textContent = '🚨 Critical Storage Usage';
            message.textContent = `Storage is ${percentUsed}% full. Old posts are being automatically removed. Consider exporting your data.`;
        } else if (percentUsed >= 80) {
            alert.classList.remove('hidden', 'critical');
            title.textContent = '⚠️ High Storage Usage';
            message.textContent = `Storage is ${percentUsed}% full. Consider cleaning up old posts or optimizing storage.`;
        } else {
            alert.classList.add('hidden');
        }
    }

    /**
     * Update storage health indicators
     */
    async updateStorageHealth(storageInfo) {
        try {
            // Check quota status
            const quotaIndicator = document.getElementById('quotaHealthIndicator');
            const quotaValue = document.getElementById('quotaHealthValue');

            if (quotaIndicator && quotaValue) {
                const percentUsed = Math.round(storageInfo.percentUsed * 100);
                quotaIndicator.className = 'health-indicator';

                if (percentUsed < 80) {
                    quotaIndicator.classList.add('healthy');
                    quotaValue.textContent = 'Healthy';
                    quotaIndicator.querySelector('.health-icon').textContent = '🟢';
                } else if (percentUsed < 95) {
                    quotaIndicator.classList.add('warning');
                    quotaValue.textContent = 'Warning';
                    quotaIndicator.querySelector('.health-icon').textContent = '🟡';
                } else {
                    quotaIndicator.classList.add('critical');
                    quotaValue.textContent = 'Critical';
                    quotaIndicator.querySelector('.health-icon').textContent = '🔴';
                }
            }

            // Check cleanup status
            const cleanupIndicator = document.getElementById('cleanupHealthIndicator');
            const cleanupValue = document.getElementById('cleanupHealthValue');

            if (cleanupIndicator && cleanupValue) {
                const settings = await this.getSettingsForHealth();
                cleanupIndicator.className = 'health-indicator';

                if (settings.autoCleanup) {
                    cleanupIndicator.classList.add('healthy');
                    cleanupValue.textContent = `Enabled (${settings.cleanupDays || 30} days)`;
                    cleanupIndicator.querySelector('.health-icon').textContent = '🟢';
                } else {
                    cleanupIndicator.classList.add('warning');
                    cleanupValue.textContent = 'Disabled';
                    cleanupIndicator.querySelector('.health-icon').textContent = '🟡';
                }
            }

            // Check optimization status
            const optimizationIndicator = document.getElementById('optimizationHealthIndicator');
            const optimizationValue = document.getElementById('optimizationHealthValue');

            if (optimizationIndicator && optimizationValue) {
                optimizationIndicator.className = 'health-indicator healthy';
                optimizationValue.textContent = 'Active';
                optimizationIndicator.querySelector('.health-icon').textContent = '🟢';
            }

        } catch (error) {
            console.error('Error updating storage health:', error);
        }
    }

    /**
     * Get settings for health check
     */
    async getSettingsForHealth() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getSettings' });
            return response.success ? response.data : {};
        } catch (error) {
            return {};
        }
    }

    /**
     * Show storage error state
     */
    showStorageError() {
        const usageText = document.getElementById('storageUsageText');
        if (usageText) {
            usageText.textContent = 'Error loading storage information';
        }

        ['totalStorageUsage', 'postsStorageUsage', 'storageUsagePercent', 'postCountValue'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = 'Error';
        });
    }

    /**
     * Optimize storage
     */
    async optimizeStorage() {
        const button = document.getElementById('optimizeStorage');
        if (!button) return;

        try {
            button.classList.add('loading');
            button.disabled = true;

            const response = await chrome.runtime.sendMessage({ action: 'optimizeStorage' });

            if (response.success) {
                const optimizedCount = response.data.optimizedCount;
                if (optimizedCount > 0) {
                    this.showNotification(`Optimized ${optimizedCount} posts successfully`);
                } else {
                    this.showNotification('Storage already optimized');
                }

                // Refresh storage info
                await this.loadStorageInfo();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error optimizing storage:', error);
            this.showNotification('Error optimizing storage', 'error');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    /**
     * Check storage quota
     */
    async checkStorageQuota() {
        const button = document.getElementById('checkStorageQuota');
        if (!button) return;

        try {
            button.classList.add('loading');
            button.disabled = true;

            const response = await chrome.runtime.sendMessage({ action: 'checkStorageQuota' });

            if (response.success) {
                const status = response.data.status;
                let message = '';

                switch (status) {
                    case 'ok':
                        message = 'Storage quota is healthy';
                        break;
                    case 'warning':
                        message = 'Storage quota warning - consider cleanup';
                        break;
                    case 'critical':
                        message = 'Storage quota critical - automatic cleanup performed';
                        break;
                    default:
                        message = 'Storage quota checked';
                }

                this.showNotification(message, status === 'ok' ? 'success' : 'warning');

                // Refresh storage info
                await this.loadStorageInfo();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error checking storage quota:', error);
            this.showNotification('Error checking storage quota', 'error');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    /**
     * Force cleanup old posts
     */
    async forceCleanup() {
        if (!confirm('This will remove old posts according to your cleanup settings. Continue?')) {
            return;
        }

        const button = document.getElementById('forceCleanup');
        if (!button) return;

        try {
            button.classList.add('loading');
            button.disabled = true;

            const response = await chrome.runtime.sendMessage({ action: 'cleanup' });

            if (response.success) {
                this.showNotification('Old posts cleaned up successfully');

                // Refresh data
                await this.loadStorageInfo();
                await this.refreshPosts();
                await this.loadStats();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error performing cleanup:', error);
            this.showNotification('Error cleaning up posts', 'error');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    /**
     * Export data before cleanup
     */
    async exportBeforeCleanup() {
        const button = document.getElementById('exportBeforeCleanup');
        if (!button) return;

        try {
            button.classList.add('loading');
            button.disabled = true;

            // First export the data
            const exportResponse = await chrome.runtime.sendMessage({ action: 'exportPosts' });

            if (exportResponse.success) {
                // Download the export
                this.downloadJSON(exportResponse.data, `linkedin-posts-backup-${new Date().toISOString().split('T')[0]}.json`);

                // Ask if user wants to proceed with cleanup
                if (confirm('Data exported successfully! Do you want to proceed with cleanup?')) {
                    const cleanupResponse = await chrome.runtime.sendMessage({ action: 'cleanup' });

                    if (cleanupResponse.success) {
                        this.showNotification('Data exported and old posts cleaned up');

                        // Refresh data
                        await this.loadStorageInfo();
                        await this.refreshPosts();
                        await this.loadStats();
                    } else {
                        this.showNotification('Export successful, but cleanup failed', 'warning');
                    }
                } else {
                    this.showNotification('Data exported successfully');
                }
            } else {
                throw new Error(exportResponse.error);
            }
        } catch (error) {
            console.error('Error in export before cleanup:', error);
            this.showNotification('Error exporting data', 'error');
        } finally {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    /**
     * Dismiss storage alert
     */
    dismissStorageAlert() {
        const alert = document.getElementById('storageAlert');
        if (alert) {
            alert.classList.add('hidden');
        }
    }

    /**
     * Update the loadStats method to include storage info
     */
    async loadStats() {
        try {
            this.showLoading('Loading statistics...');

            const response = await chrome.runtime.sendMessage({ action: 'getStats' });

            if (response.success) {
                this.displayStats(response.data);

                // Also load storage info when loading stats
                await this.loadStorageInfo();
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
            this.showNotification('Error loading statistics', 'error');
        } finally {
            this.hideLoading();
        }
    }

    /**
     * Add storage monitoring
     */
    startStorageMonitoring() {
        // Check storage every 2 minutes when popup is open
        this.storageMonitorInterval = setInterval(async () => {
            try {
                await this.loadStorageInfo();
            } catch (error) {
                console.error('Error in storage monitoring:', error);
            }
        }, 2 * 60 * 1000);
    }

    /**
     * Stop storage monitoring
     */
    stopStorageMonitoring() {
        if (this.storageMonitorInterval) {
            clearInterval(this.storageMonitorInterval);
            this.storageMonitorInterval = null;
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    this.popupController = new PopupController();
});

/**
 * Add cleanup on window unload
 */
window.addEventListener('beforeunload', () => {
    if (this.popupController) {
        this.popupController.stopStorageMonitoring();
    }
});