document.addEventListener('DOMContentLoaded', () => {
    const consentCheckbox = document.getElementById('consentCheckbox');
    const acceptBtn = document.getElementById('acceptBtn');
    const declineBtn = document.getElementById('declineBtn');

    // Enable/disable accept button based on checkbox
    consentCheckbox.addEventListener('change', () => {
        acceptBtn.disabled = !consentCheckbox.checked;
    });

    // Handle accept button click
    acceptBtn.addEventListener('click', async () => {
        if (!consentCheckbox.checked) return;

        try {
            acceptBtn.disabled = true;
            acceptBtn.textContent = '⏳ Saving...';

            // Send consent to background script
            const response = await chrome.runtime.sendMessage({
                action: 'setUserConsent',
                consent: true
            });

            if (response && response.success) {
                // Show success message
                acceptBtn.textContent = '✅ Saved!';
                acceptBtn.style.background = '#4caf50';

                // Close the popup after a short delay
                setTimeout(() => {
                    window.close();
                }, 1000);
            } else {
                throw new Error('Failed to save consent');
            }
        } catch (error) {
            console.error('Error saving consent:', error);
            acceptBtn.textContent = '❌ Error';
            acceptBtn.style.background = '#f44336';
            acceptBtn.disabled = false;

            // Reset button after 2 seconds
            setTimeout(() => {
                acceptBtn.textContent = '✅ Accept & Continue';
                acceptBtn.style.background = '#0077b5';
            }, 2000);
        }
    });

    // Handle decline button click
    declineBtn.addEventListener('click', async () => {
        try {
            declineBtn.disabled = true;
            declineBtn.textContent = '⏳ Closing...';

            // Send decline to background script
            await chrome.runtime.sendMessage({
                action: 'setUserConsent',
                consent: false
            });

            // Close the popup
            window.close();
        } catch (error) {
            console.error('Error handling decline:', error);
            window.close();
        }
    });

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            declineBtn.click();
        } else if (e.key === 'Enter' && consentCheckbox.checked) {
            acceptBtn.click();
        }
    });

    // Log page view for debugging
    console.log('LinkedIn Post Saver: Consent dialog loaded');
});