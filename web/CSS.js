/**
 * File: CSS.js
 * Project: ComfyUI-WanMove-Path-Animator
 * Defines styles, SVG icons, and CSS injection logic.
 */

export const CSS_STYLES = `
    .wm-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease-out; }
    .wm-container { background: linear-gradient(145deg, #2d2d2d, #252525); border-radius: 12px; border: 1px solid #3a3a3a; width: 95%; height: 95%; max-width: 2000px; max-height: 1400px; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05); animation: slideIn 0.3s ease-out; outline: none; }
    .wm-header { padding: 20px 24px 16px 24px; border-bottom: 1px solid #404040; background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%); display: flex; flex-direction: column; gap: 16px; border-radius: 12px 12px 0 0; }
    .wm-header-top { display: flex; justify-content: space-between; align-items: center; }
    .wm-close-btn { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #fff; cursor: pointer; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; transition: all 0.2s ease; }
    .wm-close-btn:hover { background: rgba(255, 77, 77, 0.8); transform: scale(1.05); }
    .wm-controls-row { display: flex; gap: 32px; align-items: center; padding: 12px 16px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05); }
    .wm-main { flex: 1; display: flex; overflow: hidden; }
    .wm-toolbar { width: 70px; background: linear-gradient(180deg, #1e1e1e 0%, #181818 100%); border-right: 1px solid #3a3a3a; padding: 12px 10px; display: flex; flex-direction: column; gap: 8px; box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3); }
    .wm-tool-btn { width: 50px; height: 50px; border: 2px solid rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.05); color: #fff; cursor: pointer; border-radius: 8px; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; }
    .wm-tool-btn:hover:not(.active) { background: rgba(255, 255, 255, 0.1); transform: scale(1.05); }
    .wm-tool-btn.active { border-color: #4ECDC4; background: rgba(78, 205, 196, 0.2); box-shadow: 0 0 12px rgba(78, 205, 196, 0.3); }
    .wm-separator { height: 1px; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent); margin: 8px 0; }
    .wm-canvas-area { flex: 1; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, #1e1e1e 0%, #0a0a0a 100%); position: relative; overflow: hidden; padding: 20px; }
    .wm-canvas { border: 1px solid #4a4a4a; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6); max-width: 100%; max-height: 100%; border-radius: 4px; }
    .wm-sidebar { width: 280px; background: #1e1e1e; border-left: 1px solid #444; padding: 15px; overflow-y: auto; }
    .wm-path-item { padding: 10px; background: #2b2b2b; border: 2px solid #444; border-radius: 4px; cursor: pointer; color: #fff; font-size: 12px; display: flex; flex-direction: column; gap: 6px; transition: all 0.2s ease; }
    .wm-path-item.selected { background: rgba(0, 255, 65, 0.15); border-color: #00FF41; }
    .wm-del-btn { background: rgba(255, 77, 77, 0.2); border: 1px solid rgba(255, 77, 77, 0.4); border-radius: 4px; color: #ff4d4d; cursor: pointer; font-size: 14px; padding: 4px 8px; transition: all 0.2s ease; }
    .wm-del-btn:hover { background: rgba(255, 77, 77, 0.4); border-color: rgba(255, 77, 77, 0.8); }
    .wm-footer { padding: 15px 20px; border-top: 1px solid #444; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .wm-btn { padding: 8px 20px; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 14px; }
    .wm-btn-cancel { background: #444; }
    .wm-btn-save { background: #4ECDC4; font-weight: 500; }
    .wm-timeline-controls { margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; gap: 12px; }
    .wm-timeline-slider { position: relative; height: 40px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; padding: 8px; }
    .wm-range-track { position: absolute; left: 8px; right: 8px; top: 50%; transform: translateY(-50%); height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px; }
    .wm-range-active { position: absolute; height: 100%; background: #4ECDC4; border-radius: 3px; }
    .wm-range-handle { position: absolute; top: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #4ECDC4; border: 2px solid #fff; border-radius: 50%; z-index: 10; transition: transform 0.1s ease; }
    .wm-range-handle:hover { transform: translate(-50%, -50%) scale(1.2); }
    .wm-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10px; color: #ccc; margin-top: 2px; }
    .wm-label { color: #fff; font-size: 11px; font-weight: 500; opacity: 0.9; }
    .wm-field { display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 3px 6px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.05); }
    .wm-input { width: 40px; background: #1a1a1a; border: 1px solid #444; color: #4ECDC4; text-align: center; font-size: 10px; border-radius: 2px; padding: 2px; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideIn { from { opacity: 0; transform: scale(0.95) translateY(-20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
`;

export const Icons = {
    pencil: () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>`,
    pin: () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></svg>`,
    trash: () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    cursor: () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"/></svg>`,
    image: () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    xCircle: () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    lock: () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    edit: () => `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    close: () => `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    arrowRight: () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
    target: () => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
};

export function injectCSS() {
    if (!document.getElementById('wm-path-animator-styles')) {
        const style = document.createElement('style');
        style.id = 'wm-path-animator-styles';
        style.textContent = CSS_STYLES;
        document.head.appendChild(style);
    }
}