
import { UI } from './ui';

export function showToast(message: string, type: 'info' | 'error' = 'info') {
    let container = document.getElementById('toast-container');

    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;

    container.appendChild(toast);

    // Initial show (trigger reflow for transition)
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // After 3 seconds, start the 5 second gradual fade out
    setTimeout(() => {
        toast.classList.add('fade-out');

        // Remove from DOM after the 5s fade-out transition is complete
        setTimeout(() => {
            toast.remove();
        }, 5000);

    }, 3000);
}
