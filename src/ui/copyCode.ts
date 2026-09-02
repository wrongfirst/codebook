import { copyToClipboardSafe } from '../core/clipboard';
import { ICONS } from './icons';
import { showPopup } from './popup';

/**
 * Initializes the copy button in the editor toolbar.
 * Copies the current editor code safely to the user's clipboard,
 * temporarily swaps the button icon to a checkmark for visual feedback,
 * and displays a brief toast notification.
 */
export function setupCopyCodeButton(
    btn: HTMLButtonElement,
    getCodeFn: () => string
): void {
    btn.innerHTML = ICONS.COPY;
    let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

    btn.addEventListener('click', async () => {
        const code = getCodeFn();
        if (!code || !code.trim()) {
            showPopup('No code to copy');
            return;
        }

        const success = await copyToClipboardSafe(code);
        if (success) {
            if (feedbackTimeout) {
                clearTimeout(feedbackTimeout);
            }
            btn.innerHTML = ICONS.CHECK;
            showPopup('Code copied to clipboard!');

            feedbackTimeout = setTimeout(() => {
                btn.innerHTML = ICONS.COPY;
                feedbackTimeout = null;
            }, 2000);
        } else {
            showPopup('Failed to copy code');
        }
    });
}
