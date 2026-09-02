import { ICONS } from './icons';
import { showPopup } from './popup';

/**
 * Initializes the format button in the editor toolbar.
 * Re-indents the active editor code using CodeMirror syntax tree indentation,
 * temporarily swaps the button icon to a checkmark for visual confirmation,
 * and displays a brief toast notification.
 */
export function setupFormatCodeButton(
    btn: HTMLButtonElement,
    formatCodeFn: () => boolean
): void {
    btn.innerHTML = ICONS.FORMAT;
    let feedbackTimeout: ReturnType<typeof setTimeout> | null = null;

    btn.addEventListener('click', () => {
        const success = formatCodeFn();
        if (success) {
            if (feedbackTimeout) {
                clearTimeout(feedbackTimeout);
            }
            btn.innerHTML = ICONS.CHECK;
            showPopup('Code formatted');

            feedbackTimeout = setTimeout(() => {
                btn.innerHTML = ICONS.FORMAT;
                feedbackTimeout = null;
            }, 1500);
        } else {
            showPopup('Nothing to format');
        }
    });
}
