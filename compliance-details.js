document.addEventListener('DOMContentLoaded', () => {
    console.log('LinkedIn Post Saver: Compliance details page loaded');

    // Close dialog button
    const closeBtn = document.getElementById('closeDialog');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            window.close();
        });
    }

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Enter') {
            window.close();
        }
    });

    // Track page view for analytics (if needed)
    try {
        chrome.runtime.sendMessage({
            action: 'trackEvent',
            event: 'compliance_details_viewed',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        // Ignore errors if extension context is not available
    }
});