/**
 * RudderStack analytics wrapper.
 * Uses the snippet-style global rudderanalytics object loaded via index.html.
 * All calls are no-ops if the SDK hasn't loaded (safe in local dev without keys).
 */

declare global {
    interface Window {
        rudderanalytics?: {
            identify: (userId: string, traits?: Record<string, unknown>) => void;
            track: (event: string, properties?: Record<string, unknown>) => void;
            page: (category?: string, name?: string, properties?: Record<string, unknown>) => void;
            reset: () => void;
        };
    }
}

function rs() {
    return window.rudderanalytics;
}

export function identify(userId: string, traits?: Record<string, unknown>) {
    rs()?.identify(userId, traits);
}

export function track(event: string, properties?: Record<string, unknown>) {
    rs()?.track(event, properties);
}

export function page(name: string, properties?: Record<string, unknown>) {
    rs()?.page(undefined, name, properties);
}
