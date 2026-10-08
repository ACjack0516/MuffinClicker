// Best-effort detection that the browser dev tools were opened. This is a deterrent, not real
// security: anyone determined can get around it, which is why the server also sanity-checks scores.
// Once triggered, state.tampered is saved with the game and the current save can't be submitted.
import { state } from './state.js';

const ENABLED = true; // set to false while developing so opening dev tools doesn't flag your save
const CHECK_MS = 2000;

// Check 1: Chromium reads an Error's "stack" when it prints it in an open console.
let consoleHit = false;
const probe = new Error();
Object.defineProperty(probe, 'stack', { get() { consoleHit = true; return ''; } });

// Check 2: a "debugger" statement is a no-op, unless dev tools are open and it pauses the page.
function debuggerPaused() {
    const t = performance.now();
    debugger;
    return performance.now() - t > 300;
}

export function startIntegrityWatch(onFlag) {
    if (!ENABLED || state.tampered) return;
    const timer = setInterval(() => {
        if (state.tampered) { clearInterval(timer); return; }
        console.log(probe);
        if (consoleHit || debuggerPaused()) {
            state.tampered = true;
            clearInterval(timer);
            onFlag();
        }
    }, CHECK_MS);
}