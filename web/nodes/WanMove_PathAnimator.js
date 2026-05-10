/**
 * File: WanMove_PathAnimator.js
 * Project: ComfyUI-WanMove-Path-Animator
 * Interactive path animator with drawing editor
 */

import { app } from "../../../../../scripts/app.js";
import { api } from "../../../../../scripts/api.js";

// ==========================================
// 1. CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
    DEFAULT_SIZE: 512,
    DEFAULT_BEZIER:[0.0, 0.0, 0.0, 1.0, 1.0, 1.0],
    COLORS:['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'],
    UI: {
        PATH_THICKNESS: 3,
        BG_OPACITY: 1.0,
        BEZIER_PAD: 15,
        HIT_THRESH_BASE: 10,
		BEZIER_CANVAS_W: 210,
        BEZIER_CANVAS_H: 140
    }
};

const CSS_STYLES = `
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

const Icons = {
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

// ==========================================
// 2. UTILITY CLASSES (SoC)
// ==========================================

const DOMUtils = {
    el(tag, attrs = {}, ...children) {
        const e = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k.startsWith('on') && typeof v === 'function') e[k] = v;
            else if (k === 'style') e.style.cssText = v;
            else if (k === 'className') e.className = v;
            else e[k] = v;
        }
        children.flat().forEach(c => c && e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(c) : c));
        return e;
    },
    injectCSS() {
        if (!document.getElementById('wm-path-animator-styles')) {
            document.head.appendChild(this.el('style', { id: 'wm-path-animator-styles', textContent: CSS_STYLES }));
        }
    }
};

const MathUtils = {
    distanceToSegment(pt, p1, p2) {
        const A = pt.x - p1.x, B = pt.y - p1.y, C = p2.x - p1.x, D = p2.y - p1.y;
        const lenSq = C * C + D * D, param = lenSq !== 0 ? (A * C + B * D) / lenSq : -1;
        const xx = param < 0 ? p1.x : param > 1 ? p2.x : p1.x + param * C;
        const yy = param < 0 ? p1.y : param > 1 ? p2.y : p1.y + param * D;
        return Math.hypot(pt.x - xx, pt.y - yy);
    },
    getRandomColor() {
        return CONFIG.COLORS[Math.floor(Math.random() * CONFIG.COLORS.length)];
    },
    generateId() {
        return 'path_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    }
};

const ComfyUtils = {
    moveWidgetToTop(node, widget) {
        if (!widget) return;
        const idx = node.widgets.indexOf(widget);
        if (idx > 0) { node.widgets.splice(idx, 1); node.widgets.unshift(widget); }
    },
    getWidgetOrInputValue(node, name, defaultValue) {
        let curr = node, currName = name, visited = new Set(), hasLink = false;
        for (let i = 0; i < 20; i++) { 
            if (!curr || visited.has(curr.id)) break;
            visited.add(curr.id);
            
            let foundLink = false;
            if (curr.inputs) {
                const input = curr.inputs.find(inp => inp.name === currName);
                if (input && input.link != null) {
                    hasLink = true;
                    const link = app.graph.links[input.link];
                    if (link && (curr = app.graph.getNodeById(link.origin_id))) {
                        currName = (curr.outputs && curr.outputs[link.origin_slot]) ? curr.outputs[link.origin_slot].name : "value";
                        foundLink = true;
                    }
                }
            }
            if (foundLink) continue;

            const cType = curr.comfyClass || curr.type || "";
            if (cType.includes("GetNode") || cType === "Anything Anywhere Getter") {
                const w = curr.widgets?.[0] || curr.widgets?.find(w => w.name === "constant" || w.name === "Value");
                if (w && w.value) {
                    const setNode = app.graph._nodes.find(n => (n.comfyClass || n.type || "").includes("SetNode") && n.widgets?.[0]?.value === w.value);
                    if (setNode) { curr = setNode; currName = setNode.inputs?.[0]?.name || "value"; continue; }
                }
            }

            const widget = curr.widgets?.find(w => w.name === currName || w.name === "value") || curr.widgets?.[0];
            if (widget && widget.value !== undefined) return widget.value;
            if (hasLink) return defaultValue;
            break;
        }
        const origWidget = node.widgets?.find(w => w.name === name);
        if (origWidget && origWidget.value !== undefined) return origWidget.value;
        return defaultValue;
    },
    getConnectedImageUrl(node, inputName = "image") {
        if (!node.inputs) return null;
        const imgInput = node.inputs.find(i => i.name === inputName);
        if (!imgInput || imgInput.link === null) return null;
        
        let curr = app.graph.getNodeById(app.graph.links[imgInput.link]?.origin_id);
        const visited = new Set();
        
        while (curr && !visited.has(curr.id)) {
            visited.add(curr.id);
            if (curr.imgs?.length > 0) return curr.imgs[0].src;
            if (curr.outputs) {
                for (const out of curr.outputs) if (out.type === "IMAGE" && out.links) {
                    for (const lid of out.links) {
                        const child = app.graph.getNodeById(app.graph.links[lid]?.target_id);
                        if (child?.imgs?.length > 0) return child.imgs[0].src;
                    }
                }
            }
            const iW = curr.widgets?.find(w => w.name === "image");
            if (iW?.value) {
                const val = typeof iW.value === "object" ? iW.value : { filename: iW.value, type: "input", subfolder: "" };
                if (val.filename) return api.apiURL(`/view?${new URLSearchParams(val).toString()}`);
            }
            curr = curr.inputs ? app.graph.getNodeById(app.graph.links[curr.inputs.find(i => i.type === "IMAGE" && i.link)?.link]?.origin_id) : null;
        }
        return null;
    },
    resolveImageSizeFromLink(node, name) {
        let curr = node, currName = name, visited = new Set();
        for (let i = 0; i < 20; i++) {
            if (!curr || visited.has(curr.id)) break;
            visited.add(curr.id);

            let foundLink = false;
            if (curr.inputs) {
                const input = curr.inputs.find(inp => inp.name === currName);
                if (input && input.link != null) {
                    const link = app.graph.links[input.link];
                    if (link && (curr = app.graph.getNodeById(link.origin_id))) {
                        currName = (curr.outputs && curr.outputs[link.origin_slot]) ? curr.outputs[link.origin_slot].name : "value";
                        foundLink = true;
                    }
                }
            }
            if (!foundLink) break;

            const cType = curr.comfyClass || curr.type || "";
            if (cType.includes("GetImageSize") || cType.includes("ImageSize") || cType.includes("Get Image Size")) {
                return this.getConnectedImageUrl(curr, "image");
            }
        }
        return null;
    }
};

// ==========================================
// 3. FACTORY PATTERN
// ==========================================
const PathFactory = {
    _createBase(name, points, color, isSinglePoint) {
        return {
            id: MathUtils.generateId(),
            name,
            points,
            color,
            isSinglePoint,
            startTime: 0.0,
            endTime: 1.0,
            qty: 0,
            spread: 1.50,
            bezier_pts: [...CONFIG.DEFAULT_BEZIER],
            visibilityMode: 'pop'
        };
    },
    createMotionPath(points, color, count) {
        return this._createBase(`Path ${count}`, points, color, false);
    },
    createStaticPath(points, color, count) {
        return this._createBase(`Static ${count}`, points, color, true);
    }
};

// ==========================================
// 4. MAIN EDITOR MODAL UI
// ==========================================

class PathEditorModal {
    constructor(node, pathsDataWidget, frameWidth, frameHeight) {
        this.node = node;
        this.pathsDataWidget = pathsDataWidget;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        
        this.paths =[];
        this.currentPath = null;
        this.selectedPathIndex = -1;
        this.isDrawing = false;
        this.tool = 'pencil';
        this.currentColor = MathUtils.getRandomColor();
        this.backgroundImage = null;
        
        this.pathThickness = CONFIG.UI.PATH_THICKNESS;
        this.backgroundOpacity = CONFIG.UI.BG_OPACITY;
        
        this.shiftPressed = false;
        this.animationOffset = 0;
        this.animationFrame = null;

        this.loadPaths();
        DOMUtils.injectCSS();
        this.createModal();
        this.loadCachedBackgroundImage();
        this.setupKeyboardHandlers();
        this.startAnimation();
    }

    createModal() {
        const el = DOMUtils.el;
        this.overlay = el('div', { className: 'wm-overlay' },
            this.container = el('div', { className: 'wm-container', tabIndex: 0 },
                this.createHeader(),
                this.createMainContent(),
                this.createFooter()
            )
        );
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(); };
    }

    createHeader() {
        const el = DOMUtils.el;
        return el('div', { className: 'wm-header' },
            el('div', { className: 'wm-header-top' },
                el('div', { style: 'display:flex; flex-direction:column; gap:4px;' },
                    el('h2', { innerHTML: `${Icons.edit()} <span style="margin-left:8px;">Path Animator Editor</span>`, style: 'margin:0; color:#fff; font-size:20px; font-weight:600; display:flex; align-items:center;' }),
                    el('div', { textContent: 'Press ESC to save & close | Hold SHIFT for straight lines | CTRL+V to paste image', style: 'color:#888; font-size:12px;' })
                ),
                el('button', { className: 'wm-close-btn', innerHTML: Icons.close(), onclick: () => this.close() })
            ),
            el('div', { className: 'wm-controls-row' },
                this.createSliderControl('Path Width', 1, 10, this.pathThickness, v => this.pathThickness = v),
                this.createSliderControl('Background Opacity', 0, 100, this.backgroundOpacity * 100, v => this.backgroundOpacity = v / 100, '%')
            )
        );
    }

    createSliderControl(label, min, max, val, onChange, suffix = '') {
        const el = DOMUtils.el;
        const valDisp = el('div', { textContent: val + suffix, style: 'color:#4ECDC4; font-size:14px; font-weight:bold; min-width:50px; text-align:right;' });
        const slider = el('input', { type: 'range', min, max, value: val, style: 'flex:1; cursor:pointer; accent-color:#4ECDC4; height:6px;', oninput: (e) => {
            const v = parseInt(e.target.value);
            valDisp.textContent = v + suffix;
            onChange(v); this.render();
        }});
        return el('div', { style: 'flex:1; display:flex; align-items:center; gap:12px;' },
            el('label', { textContent: label, style: 'color:#fff; font-size:13px; font-weight:500; min-width:120px; opacity:0.9;' }),
            el('div', { style: 'flex:1; display:flex; align-items:center; gap:12px;' }, slider, valDisp)
        );
    }

    createMainContent() {
        return DOMUtils.el('div', { className: 'wm-main' },
            this.createToolbar(),
            this.createCanvasArea(),
            this.createSidebar()
        );
    }

    createToolbar() {
        const el = DOMUtils.el;
        const toolbar = el('div', { className: 'wm-toolbar' },
            el('button', { className: 'wm-tool-btn', innerHTML: Icons.image(), title: 'Load Background', onclick: () => this.loadImage() }),
            el('button', { className: 'wm-tool-btn', innerHTML: Icons.xCircle(), title: 'Clear Background', onclick: () => this.clearImage() }),
            el('div', { className: 'wm-separator' })
        );

        const tools =[
            { name: 'pencil', icon: Icons.pencil(), title: 'Draw Path (Motion)' },
            { name: 'point', icon: Icons.pin(), title: 'Add Static Point (Anchor)' },
            { name: 'select', icon: Icons.cursor(), title: 'Select Path' }
        ];

        const toolBtns = tools.map(tool => {
            const btn = el('button', { className: `wm-tool-btn ${this.tool === tool.name ? 'active' : ''}`, innerHTML: tool.icon, title: tool.title });
            btn.onclick = () => {
                this.tool = tool.name;
                this.canvas.style.cursor = tool.name === 'select' ? 'pointer' : 'crosshair';
                toolBtns.forEach(tb => tb.classList.toggle('active', tb === btn));
            };
            return btn;
        });
        toolBtns.forEach(b => toolbar.appendChild(b));

        toolbar.appendChild(el('div', { className: 'wm-separator' }));
        toolbar.appendChild(el('button', { className: 'wm-tool-btn', innerHTML: Icons.lock(), title: 'Lock Perimeter', onclick: () => this.lockPerimeter() }));
        toolbar.appendChild(el('div', { className: 'wm-separator' }));
        
        toolbar.appendChild(el('button', { className: 'wm-tool-btn', style: 'margin-top:auto;', innerHTML: Icons.trash(), title: 'Clear All', onclick: () => {
            if (confirm('Clear all paths?')) { this.paths =[]; this.selectedPathIndex = -1; this.updateSidebar(); this.render(); }
        }}));

        return toolbar;
    }

    createCanvasArea() {
        this.canvas = DOMUtils.el('canvas', { className: 'wm-canvas', width: this.frameWidth, height: this.frameHeight, style: 'cursor:crosshair;' });
        this.ctx = this.canvas.getContext('2d');
        this.setupCanvasEvents();
        return DOMUtils.el('div', { className: 'wm-canvas-area' }, this.canvas);
    }

    createSidebar() {
        this.sidebar = DOMUtils.el('div', { className: 'wm-sidebar' },
            DOMUtils.el('h3', { textContent: 'Paths', style: 'margin:0 0 15px 0; color:#fff; font-size:14px; font-weight:500;' }),
            this.pathList = DOMUtils.el('div', { style: 'display:flex; flex-direction:column; gap:8px;' })
        );
        this.updateSidebar();
        return this.sidebar;
    }

    createFooter() {
        this.statsContainer = DOMUtils.el('div', { style: 'color:#888; font-size:12px;' });
        this.updateStats();
        return DOMUtils.el('div', { className: 'wm-footer' },
            this.statsContainer,
            DOMUtils.el('div', { style: 'display:flex; gap:10px;' },
                DOMUtils.el('button', { className: 'wm-btn wm-btn-cancel', textContent: 'Cancel', onclick: () => this.close() }),
                DOMUtils.el('button', { className: 'wm-btn wm-btn-save', textContent: 'Save Paths', onclick: () => { this.savePaths(); this.close(); } })
            )
        );
    }

    // --- Core Logic & Drawing ---

    updateSidebar() {
        if (!this.pathList) return;
        this.pathList.innerHTML = '';
        const el = DOMUtils.el;

        this.paths.forEach((path, index) => {
            const isSingle = path.isSinglePoint || path.points.length === 1;
            const isSel = index === this.selectedPathIndex;
            const tLbl = isSingle ? `${Icons.target()} <span style="margin-left:4px;">Static (1 pt)</span>` : `${Icons.arrowRight()} <span style="margin-left:4px;">Motion (${path.points.length} pts)</span>`;

            const item = el('div', { className: `wm-path-item ${isSel ? 'selected' : ''}` },
                el('div', { style: 'display:flex; justify-content:space-between; align-items:center;' },
                    el('div', { style: 'display:flex; align-items:center; gap:8px; flex:1;' },
                        el('div', { style: `width:16px; height:16px; background:${isSel ? '#00FF41' : path.color}; border-radius:${isSingle ? '2px' : '50%'}; border:2px solid ${isSel ? '#00FF41' : (isSingle ? '#fff' : 'transparent')};` }),
                        el('div', { style: 'display:flex; flex-direction:column; gap:2px;' },
                            el('span', { textContent: path.name, style: `font-weight:500; color:${isSel ? '#00FF41' : '#fff'};` }),
                            el('span', { innerHTML: tLbl, style: `font-size:10px; color:${isSel ? '#00FF41' : (isSingle ? '#F7DC6F' : '#4ECDC4')}; display:flex; align-items:center;` })
                        )
                    ),
                    el('button', { className: 'wm-del-btn', textContent: '✕', onclick: (e) => { e.stopPropagation(); this.paths.splice(index, 1); this.selectedPathIndex = -1; this.updateSidebar(); this.render(); } })
                )
            );

            if (isSel) item.appendChild(this.createTimelineControls(path, index));
            item.onclick = (e) => { 
                if (!e.target.closest('.wm-timeline-controls')) { 
                    // Toggle selection: if already selected, set to -1 (deselect), else set to index
                    this.selectedPathIndex = this.selectedPathIndex === index ? -1 : index; 
                    this.updateSidebar(); 
                    this.render(); 
                } 
            };
            this.pathList.appendChild(item);
        });
    }

    createTimelineControls(path, pathIndex) {
        const el = DOMUtils.el;
        const container = el('div', { className: 'wm-timeline-controls' });

        // Timeline Range Slider
        const sPct = Math.round((path.startTime || 0) * 100), ePct = Math.round((path.endTime !== undefined ? path.endTime : 1) * 100);
        const activeRng = el('div', { className: 'wm-range-active', style: `left:${sPct}%; width:${ePct - sPct}%;` });
        const startHnd = this.createRangeHandle(sPct, true);
        const endHnd = this.createRangeHandle(ePct, false);
        
        const fStart = this.createField('Start %', sPct, { min:0, max:100 });
        const fEnd = this.createField('End %', ePct, { min:0, max:100 });
        const inputRefs = { start: fStart.inp, end: fEnd.inp };

        this.setupRangeHandleDrag(startHnd, endHnd, activeRng, path, true, inputRefs);
        this.setupRangeHandleDrag(endHnd, startHnd, activeRng, path, false, inputRefs);

        const updateFromInputs = () => {
            let s = Math.max(0, Math.min(100, parseInt(inputRefs.start.value) || 0));
            let e = Math.max(0, Math.min(100, parseInt(inputRefs.end.value) || 100));
            if (s > e - 1) s = Math.max(0, e - 1);
            if (e < s + 1) e = Math.min(100, s + 1);
            
            inputRefs.start.value = s; inputRefs.end.value = e;
            startHnd.style.left = `${s}%`; endHnd.style.left = `${e}%`;
            activeRng.style.left = `${s}%`; activeRng.style.width = `${e - s}%`;
            path.startTime = s / 100; path.endTime = e / 100;
            this.savePaths();
        };[inputRefs.start, inputRefs.end].forEach(inp => {
            inp.addEventListener('change', updateFromInputs);
            inp.addEventListener('keydown', e => e.key === 'Enter' && (updateFromInputs(), inp.blur()));
        });

        const timelineSec = el('div', { style: 'display:flex; flex-direction:column; gap:6px;' },
            el('label', { className: 'wm-label', textContent: 'Timeline Range' }),
            el('div', { className: 'wm-timeline-slider' }, el('div', { className: 'wm-range-track' }, activeRng), startHnd, endHnd),
            el('div', { className: 'wm-grid-2' }, fStart.wrap, fEnd.wrap)
        );

        container.appendChild(timelineSec);
        const isSingle = path.isSinglePoint || path.points.length === 1;

        // Bezier Curve
        if (!isSingle) {
            if (!path.bezier_pts || path.bezier_pts.length < 6) path.bezier_pts = [...CONFIG.DEFAULT_BEZIER];
            const bezCvs = el('canvas', { width: CONFIG.UI.BEZIER_CANVAS_W, height: CONFIG.UI.BEZIER_CANVAS_H, style: 'background:#2a2a2a; border:1px solid #444; border-radius:4px; cursor:crosshair; width:100%;' });
            
            const bRefs = {
                sY: this.createField('Start Y', path.bezier_pts[0].toFixed(2), { step:0.05 }),
                eY: this.createField('End Y', path.bezier_pts[5].toFixed(2), { step:0.05 }),
                h1X: this.createField('Start H.X', path.bezier_pts[1].toFixed(2), { step:0.05 }),
                h2X: this.createField('End H.X', path.bezier_pts[3].toFixed(2), { step:0.05 }),
                h1Y: this.createField('Start H.Y', path.bezier_pts[2].toFixed(2), { step:0.05 }),
                h2Y: this.createField('End H.Y', path.bezier_pts[4].toFixed(2), { step:0.05 })
            };

            this.setupBezierEditor(bezCvs, path, { startY:bRefs.sY.inp, endY:bRefs.eY.inp, h1X:bRefs.h1X.inp, h2X:bRefs.h2X.inp, h1Y:bRefs.h1Y.inp, h2Y:bRefs.h2Y.inp });

            container.appendChild(el('div', { style: 'display:flex; flex-direction:column; gap:6px;' },
                el('div', { style: 'display:flex; justify-content:space-between; align-items:center;' },
                    el('label', { className: 'wm-label', textContent: 'Custom Easing Curve' }),
                    el('button', { textContent: 'Reset', style: 'background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); border-radius:3px; color:#fff; font-size:9px; padding:2px 6px; cursor:pointer;', onclick: (e) => { e.stopPropagation(); path.bezier_pts = [...CONFIG.DEFAULT_BEZIER]; this.savePaths(); this.updateSidebar(); }})
                ), bezCvs,
                el('div', { className: 'wm-grid-2' }, bRefs.sY.wrap, bRefs.eY.wrap, bRefs.h1X.wrap, bRefs.h2X.wrap, bRefs.h1Y.wrap, bRefs.h2Y.wrap)
            ));
        }

        // Spread Params
        const fQty = this.createField('Qty', path.qty || 0, { step:2, min:0, max:100 });
        const fSpr = this.createField('Spread', (path.spread !== undefined ? path.spread : 1.50).toFixed(2), { step:0.10 });
        
        const updateParams = () => {
            path.qty = Math.max(0, Math.min(100, Math.round((parseInt(fQty.inp.value) || 0) / 2) * 2));
            path.spread = parseFloat(fSpr.inp.value) || 1.50;
            fQty.inp.value = path.qty;
            this.savePaths(); this.render();
        };

        fQty.inp.addEventListener('change', updateParams);
        fSpr.inp.addEventListener('change', updateParams);
        fSpr.inp.addEventListener('blur', () => { updateParams(); fSpr.inp.value = path.spread.toFixed(2); });

        container.appendChild(el('div', { style: 'display:flex; flex-direction:column; gap:6px;' },
            el('label', { className: 'wm-label', textContent: 'Spread' }),
            el('div', { className: 'wm-grid-2' }, fQty.wrap, fSpr.wrap)
        ));

        // Visibility Mode
        const visSel = el('select', { style: 'background:rgba(0,0,0,0.3); border:1px solid rgba(255,255,255,0.2); border-radius:4px; color:#fff; padding:6px; font-size:11px; cursor:pointer;', onchange: e => { e.stopPropagation(); path.visibilityMode = e.target.value; this.savePaths(); } },
            el('option', { value: 'pop', textContent: 'Pop (Appear/Disappear)', selected: (path.visibilityMode||'pop') === 'pop' }),
            el('option', { value: 'static', textContent: 'Static (Always Visible)', selected: path.visibilityMode === 'static' })
        );
        container.appendChild(el('div', { style: 'display:flex; flex-direction:column; gap:6px;' }, el('label', { className: 'wm-label', textContent: 'Visibility Mode' }), visSel));

        return container;
    }

    createRangeHandle(pos, isStart) {
        return DOMUtils.el('div', { className: 'wm-range-handle', style: `left:${pos}%; cursor:${isStart ? 'e-resize' : 'w-resize'};` });
    }

    createField(label, value, props) {
        const inp = DOMUtils.el('input', { type: 'number', className: 'wm-input', value, ...props });
        const wrap = DOMUtils.el('div', { className: 'wm-field' }, DOMUtils.el('span', { textContent: label }), inp);
        return { wrap, inp };
    }

    setupRangeHandleDrag(handle, other, activeRng, path, isStart, inputRefs) {
        let isDrag = false, cont = null;
        handle.onmousedown = (e) => { e.stopPropagation(); isDrag = true; cont = handle.parentElement; document.body.style.cursor = isStart ? 'e-resize' : 'w-resize'; };
        document.addEventListener('mousemove', (e) => {
            if (!isDrag || !cont) return;
            const r = cont.getBoundingClientRect();
            const pct = Math.round(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
            const oPct = parseFloat(other.style.left);
            const cPct = isStart ? Math.min(pct, oPct - 1) : Math.max(pct, oPct + 1);

            handle.style.left = `${cPct}%`;
            const sPct = isStart ? cPct : oPct;
            const ePct = isStart ? oPct : cPct;
            activeRng.style.left = `${sPct}%`; activeRng.style.width = `${ePct - sPct}%`;
            
            if (isStart) path.startTime = cPct / 100; else path.endTime = cPct / 100;
            inputRefs.start.value = Math.round(sPct); inputRefs.end.value = Math.round(ePct);
        });
        document.addEventListener('mouseup', () => { if (isDrag) { isDrag = false; document.body.style.cursor = ''; this.savePaths(); } });
    }

    setupBezierEditor(canvas, path, inputs) {
        const ctx = canvas.getContext('2d'), pad = CONFIG.UI.BEZIER_PAD, w = canvas.width - pad*2, h = canvas.height - pad*2;
        let dragPt = null;

        const updateDOM = () => {['startY','h1X','h1Y','h2X','h2Y','endY'].forEach((k,i) => inputs[k].value = path.bezier_pts[i].toFixed(2)); };
        const updateModel = () => {
            const p = (v, fb) => isNaN(parseFloat(v)) ? fb : parseFloat(v);
            const b = path.bezier_pts;
            b[0] = p(inputs.startY.value, b[0]); b[1] = Math.max(0, Math.min(1, p(inputs.h1X.value, b[1])));
            b[2] = p(inputs.h1Y.value, b[2]);     b[3] = Math.max(0, Math.min(1, p(inputs.h2X.value, b[3])));
            b[4] = p(inputs.h2Y.value, b[4]);     b[5] = p(inputs.endY.value, b[5]);
            draw(); this.savePaths();
        };

        Object.values(inputs).forEach(inp => {
            inp.addEventListener('input', updateModel);
            inp.addEventListener('blur', () => { updateModel(); updateDOM(); });
            inp.addEventListener('keydown', e => e.key === 'Enter' && inp.blur());
        });

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const[b0, b1, b2, b3, b4, b5] = path.bezier_pts;
            const p0y = canvas.height - pad - b0*h, p1x = pad + b1*w, p1y = canvas.height - pad - b2*h;
            const p2x = pad + b3*w, p2y = canvas.height - pad - b4*h, p3y = canvas.height - pad - b5*h;
            const sX = pad, eX = canvas.width - pad;

            ctx.fillStyle = '#1e1e1e'; ctx.fillRect(pad, pad, w, h);
            ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.strokeRect(pad, pad, w, h);
            ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(0, canvas.height-pad); ctx.lineTo(canvas.width, canvas.height-pad);
            ctx.moveTo(0, pad); ctx.lineTo(canvas.width, pad); ctx.stroke();

            ctx.beginPath(); ctx.moveTo(sX, p0y); ctx.lineTo(p1x, p1y); ctx.moveTo(eX, p3y); ctx.lineTo(p2x, p2y);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.stroke();

            ctx.beginPath(); ctx.moveTo(sX, p0y); ctx.bezierCurveTo(p1x, p1y, p2x, p2y, eX, p3y);
            ctx.strokeStyle = '#4ECDC4'; ctx.lineWidth = 2; ctx.stroke();

            const dH = (x, y, isHov, isEnd=false) => {
                ctx.beginPath(); ctx.arc(x, y, isEnd ? 5 : 4, 0, Math.PI*2);
                ctx.fillStyle = isHov ? '#fff' : (isEnd ? '#F7DC6F' : '#4ECDC4'); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.stroke();
            };
            dH(sX, p0y, dragPt===0, true); dH(p1x, p1y, dragPt===1); dH(p2x, p2y, dragPt===2); dH(eX, p3y, dragPt===3, true);
        };

        const getPos = e => {
            const r = canvas.getBoundingClientRect(), sX = canvas.width/r.width, sY = canvas.height/r.height;
            return { x: Math.max(0, Math.min(1, ((e.clientX - r.left)*sX - pad)/w)), y: (canvas.height - (e.clientY - r.top)*sY - pad)/h, px: (e.clientX - r.left)*sX, py: (e.clientY - r.top)*sY };
        };

        const onMM = e => {
            if (dragPt === null) return;
            const p = getPos(e), b = path.bezier_pts;
            if (dragPt === 0) b[0] = p.y;
            else if (dragPt === 1) { b[1] = p.x; b[2] = p.y; }
            else if (dragPt === 2) { b[3] = p.x; b[4] = p.y; }
            else if (dragPt === 3) b[5] = p.y;
            draw();
        };

        const onMU = () => { if (dragPt !== null) { dragPt = null; updateDOM(); this.savePaths(); document.removeEventListener('mousemove', onMM); document.removeEventListener('mouseup', onMU); draw(); } };

        canvas.onmousedown = e => {
            const p = getPos(e), b = path.bezier_pts;
            const p0y = canvas.height - pad - b[0]*h, p1x = pad + b[1]*w, p1y = canvas.height - pad - b[2]*h;
            const p2x = pad + b[3]*w, p2y = canvas.height - pad - b[4]*h, p3y = canvas.height - pad - b[5]*h;
            
            if (Math.hypot(p.px - p1x, p.py - p1y) < 15) dragPt = 1;
            else if (Math.hypot(p.px - p2x, p.py - p2y) < 15) dragPt = 2;
            else if (Math.hypot(p.px - pad, p.py - p0y) < 15) dragPt = 0;
            else if (Math.hypot(p.px - (canvas.width-pad), p.py - p3y) < 15) dragPt = 3;

            if (dragPt !== null) { document.addEventListener('mousemove', onMM); document.addEventListener('mouseup', onMU); draw(); }
        };
        updateDOM(); draw();
    }

    updateStats() {
        if (!this.statsContainer) return;
        const stat = this.paths.filter(p => p.isSinglePoint || p.points.length === 1).length;
        const imgW = this.backgroundImage?.width || 0, imgH = this.backgroundImage?.height || 0;
        this.statsContainer.textContent = `Canvas: ${this.canvas?.width || this.frameWidth} x ${this.canvas?.height || this.frameHeight} | Image: ${imgW} x ${imgH} | Total: ${this.paths.length} paths (${stat} static, ${this.paths.length - stat} motion)`;
    }

    setupKeyboardHandlers() {
        this.keydownHandler = (e) => {
            if (e.key === 'Shift') this.shiftPressed = true;
            if (e.key === 'Escape') { this.savePaths(); this.close(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); e.stopPropagation(); this.pasteFromClipboard(); }
        };
        this.keyupHandler = (e) => { if (e.key === 'Shift') this.shiftPressed = false; };
        this.pasteHandler = (e) => { e.preventDefault(); e.stopPropagation(); this.handlePaste(e); };

        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }

    attachPasteListener() {
        if (this.container) { this.container.addEventListener('paste', this.pasteHandler); document.addEventListener('paste', this.pasteHandler); }
    }

    setupCanvasEvents() {
        this.canvas.onmousedown = e => this.onMouseDown(e);
        this.canvas.onmousemove = e => this.onMouseMove(e);
        this.canvas.onmouseup = e => this.onMouseUp(e);
        this.canvas.onmouseleave = e => this.onMouseUp(e);
    }

    getCanvasCoords(e) {
        const r = this.canvas.getBoundingClientRect();
        return { x: ((e.clientX - r.left) * (this.canvas.width / r.width)) / this.getScaleX(), y: ((e.clientY - r.top) * (this.canvas.height / r.height)) / this.getScaleY() };
    }

    onMouseDown(e) {
        const pos = this.getCanvasCoords(e);
        
        if (this.tool === 'pencil') {
            this.isDrawing = true;
            this.currentPath = PathFactory.createMotionPath([pos], this.currentColor, this.paths.length + 1);
        } else if (this.tool === 'point') {
            const staticCount = this.paths.filter(p => p.isSinglePoint).length + 1;
            this.paths.push(PathFactory.createStaticPath([pos], this.currentColor, staticCount));
            this.selectedPathIndex = this.paths.length - 1;
            this.currentColor = MathUtils.getRandomColor();
            this.updateSidebar(); this.render();
        } else if (this.tool === 'select') {
            this.selectedPathIndex = this.findPathAtPoint(pos);
            this.updateSidebar(); this.render();
        }
    }

    onMouseMove(e) {
        if (!this.isDrawing || this.tool !== 'pencil') return;

        const pos = this.getCanvasCoords(e), sx = this.getScaleX(), sy = this.getScaleY();
        const pts = this.currentPath.points;

        if (this.shiftPressed && pts.length > 0) {
            const lp = pts[pts.length - 1];
            const vx = pos.x * sx, vy = pos.y * sy, lvx = lp.x * sx, lvy = lp.y * sy;
            const vdx = Math.abs(vx - lvx), vdy = Math.abs(vy - lvy);
            
            let cVx, cVy;
            if (vdx > vdy * 2) { cVx = vx; cVy = lvy; }
            else if (vdy > vdx * 2) { cVx = lvx; cVy = vy; }
            else { const d = Math.min(vdx, vdy); cVx = lvx + (vx > lvx ? d : -d); cVy = lvy + (vy > lvy ? d : -d); }

            const cPos = { x: cVx / sx, y: cVy / sy };
            if (!this.shiftPreviewPoint) { this.shiftPreviewPoint = true; pts.push(cPos); } 
            else pts[pts.length - 1] = cPos;
            
            this.render();
            return;
        } 

        this.shiftPreviewPoint = false;
        const lp = pts[pts.length - 1];
        if (Math.hypot((pos.x - lp.x) * sx, (pos.y - lp.y) * sy) > 3 * this.getRenderScale()) {
            pts.push(pos);
            this.render();
        }
    }

    onMouseUp(e) {
        if (!this.isDrawing || !this.currentPath) return;

        this.shiftPreviewPoint = false;
        if (this.currentPath.points.length > 1) {
            this.paths.push(this.currentPath);
        } else if (this.currentPath.points.length === 1) {
            this.currentPath.isSinglePoint = true;
            this.currentPath.name = 'Static ' + (this.paths.filter(p => p.isSinglePoint).length + 1);
            this.paths.push(this.currentPath);
        }

        this.selectedPathIndex = this.paths.length - 1;
        this.currentColor = MathUtils.getRandomColor();
        this.updateSidebar();
        
        this.currentPath = null;
        this.isDrawing = false;
        this.render();
    }

    findPathAtPoint(pt, baseThresh = CONFIG.UI.HIT_THRESH_BASE) {
        const thresh = baseThresh * this.getRenderScale(), sx = this.getScaleX(), sy = this.getScaleY();
        const vPt = { x: pt.x * sx, y: pt.y * sy };

        // 1. Check statics first
        for (let i = this.paths.length - 1; i >= 0; i--) {
            const p = this.paths[i];
            if ((p.isSinglePoint || p.points.length === 1) && Math.hypot(vPt.x - p.points[0].x * sx, vPt.y - p.points[0].y * sy) < thresh) {
                return i;
            }
        }
        
        // 2. Check motion paths segments
        for (let i = this.paths.length - 1; i >= 0; i--) {
            const p = this.paths[i];
            if (p.isSinglePoint || p.points.length <= 1) continue;
            
            for (let j = 0; j < p.points.length - 1; j++) {
                if (MathUtils.distanceToSegment(vPt, { x: p.points[j].x * sx, y: p.points[j].y * sy }, { x: p.points[j+1].x * sx, y: p.points[j+1].y * sy }) < thresh) {
                    return i;
                }
            }
        }
        return -1;
    }

    loadImage() {
        const el = DOMUtils.el;
        const inp = el('input', { type: 'file', accept: 'image/*', onchange: e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const img = new Image();
                img.onload = () => { this.backgroundImage = img; this.pathsDataWidget._cachedBackgroundImage = ev.target.result; this.render(); };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }});
        inp.click();
    }

    clearImage() {
        if (confirm('Clear background image?')) { this.backgroundImage = null; this.pathsDataWidget._cachedBackgroundImage = null; this.render(); }
    }

    lockPerimeter() {
        const count = parseInt(prompt('How many shapes around the perimeter?', '12'));
        if (!count || isNaN(count) || count < 1) return;

        const w = this.baseCanvasWidth, h = this.baseCanvasHeight, spacing = (2 * (w + h)) / count;
        for (let i = 0; i < count; i++) {
            const d = i * spacing;
            const x = d < w ? d : d < w+h ? w : d < 2*w+h ? w-(d-w-h) : 0;
            const y = d < w ? 0 : d < w+h ? d-w : d < 2*w+h ? h : h-(d-2*w-h);
            this.paths.push(PathFactory.createStaticPath([{ x: Math.round(x), y: Math.round(y) }], MathUtils.getRandomColor(), i + 1));
        }
        this.updateSidebar(); this.render();
    }

    getRenderScale() { return Math.min(this.canvas.width, this.canvas.height) / 512; }

    render() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'rgb(30, 30, 30)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.backgroundImage?.complete) {
            this.ctx.save();
            this.ctx.globalAlpha = this.backgroundOpacity;
            this.ctx.drawImage(this.backgroundImage, 0, 0); 
            this.ctx.restore();
        }

        this.updateStats();
        this.paths.forEach((path, i) => this.drawPath(path, i === this.selectedPathIndex));
        if (this.currentPath) this.drawPath(this.currentPath, true);
    }

    drawPath(path, isSelected = false) {
        const isSingle = path.isSinglePoint || path.points.length === 1;
        const scale = this.getRenderScale(), sx = this.getScaleX(), sy = this.getScaleY();
        const totalT = 1 + (path.qty || 0), spreadB = (path.spread !== undefined ? path.spread : 1.50) * 0.01 * (this.baseCanvasWidth + this.baseCanvasHeight) / 2;

        if (isSingle) {
            for (let t = 0; t < totalT; t++) {
                const off = (t - (totalT - 1) / 2) * spreadB, isCtr = t === (totalT - 1) / 2;
                const px = (path.points[0].x + off) * sx, py = path.points[0].y * sy;
                const size = ((isSelected && isCtr) ? 14 : 8) * scale;
                const col = (isSelected && isCtr) ? '#00FF41' : (isSelected ? 'rgba(0, 255, 65, 0.5)' : path.color);

                this.ctx.fillStyle = col; this.ctx.fillRect(px - size/2, py - size/2, size, size);
                this.ctx.strokeStyle = col; this.ctx.lineWidth = 2 * scale; this.ctx.strokeRect(px - size/2, py - size/2, size, size);

                if (isSelected && isCtr) {
                    this.ctx.fillStyle = '#00FF41'; this.ctx.font = `bold ${12 * scale}px sans-serif`;
                    this.ctx.fillText(`Static${path.qty > 0 ? ' + '+path.qty : ''}`, px + 10*scale, py - 10*scale);
                }
            }
            return;
        } 

        // Handle Motion Paths
        const pts = path.points, tans =[];
        for (let i = 0; i < pts.length; i++) {
            const tx = pts.length > 1 ? (i < pts.length-1 ? pts[i+1].x - pts[i].x : pts[i].x - pts[i-1].x) : 0;
            const ty = pts.length > 1 ? (i < pts.length-1 ? pts[i+1].y - pts[i].y : pts[i].y - pts[i-1].y) : 0;
            const len = Math.hypot(tx, ty);
            tans.push(len > 0 ? { px: -ty/len, py: tx/len } : { px: 1, py: 0 });
        }

        for (let t = 0; t < totalT; t++) {
            const off = (t - (totalT - 1) / 2) * spreadB, isCtr = t === (totalT - 1) / 2;
            
            this.ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const px = (pts[i].x + tans[i].px * off) * sx, py = (pts[i].y + tans[i].py * off) * sy;
                i === 0 ? this.ctx.moveTo(px, py) : this.ctx.lineTo(px, py);
            }

            this.ctx.strokeStyle = (isSelected && isCtr) ? '#00FF41' : (isSelected ? 'rgba(0, 255, 65, 0.5)' : path.color);
            this.ctx.lineWidth = (isSelected && isCtr ? this.pathThickness + 0.1 : this.pathThickness) * scale;
            if (!isCtr) this.ctx.lineWidth = Math.max(1, this.pathThickness * 0.5) * scale;
            this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round'; this.ctx.stroke();

            this.ctx.save();
            this.ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const px = (pts[i].x + tans[i].px * off) * sx, py = (pts[i].y + tans[i].py * off) * sy;
                i === 0 ? this.ctx.moveTo(px, py) : this.ctx.lineTo(px, py);
            }
            this.ctx.setLineDash([10 * scale, 10 * scale]);
            this.ctx.lineDashOffset = -this.animationOffset * scale;
            this.ctx.strokeStyle = (isSelected && isCtr) ? 'rgba(0, 255, 65, 0.8)' : 'rgba(255, 255, 255, 0.4)';
            this.ctx.lineWidth = Math.max(1, this.pathThickness * 0.5) * scale;
            this.ctx.stroke(); this.ctx.restore();
        }

        if (isSelected) {
            pts.forEach((pt, idx) => {
                const px = pt.x * sx, py = pt.y * sy;
                this.ctx.beginPath(); this.ctx.arc(px, py, Math.max(6, this.pathThickness + 2) * scale, 0, Math.PI * 2);
                this.ctx.fillStyle = '#00FF41'; this.ctx.fill();
                this.ctx.beginPath(); this.ctx.arc(px, py, Math.max(3, this.pathThickness * 0.6) * scale, 0, Math.PI * 2);
                this.ctx.fillStyle = '#000'; this.ctx.fill();
                if (pts.length < 20) { this.ctx.fillStyle = '#00FF41'; this.ctx.font = `bold ${10 * scale}px sans-serif`; this.ctx.fillText(idx, px + 8*scale, py - 8*scale); }
            });

            const mp = pts[Math.floor(pts.length / 2)];
            this.ctx.fillStyle = '#00FF41'; this.ctx.font = `bold ${12 * scale}px sans-serif`;
            this.ctx.fillText(`Motion (${pts.length} pts)${path.qty > 0 ? ' + '+path.qty+' Spread' : ''}`, mp.x * sx + 10*scale, mp.y * sy - 10*scale);
        }
    }

    async pasteFromClipboard() {
        try {
            if (!navigator.clipboard?.read) return;
            const items = await navigator.clipboard.read();
            for (const item of items) for (const type of item.types) {
                if (type.startsWith('image/')) { this.loadImageFromBlob(await item.getType(type)); return; }
            }
        } catch (err) { console.error('WanMove_PathAnimator: Error reading from clipboard:', err); }
    }

    handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) { this.loadImageFromBlob(blob); break; }
            }
        }
    }

    loadImageFromBlob(blob) {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => { this.backgroundImage = img; this.pathsDataWidget._cachedBackgroundImage = ev.target.result; this.render(); };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(blob);
    }

    getConnectedImageUrl() {
        if (!this.node.inputs) return null;
        return null;
    }

    loadCachedBackgroundImage() {
        const src = ComfyUtils.getConnectedImageUrl(this.node) || this.pathsDataWidget._cachedBackgroundImage;
        if (src) {
            const img = new Image();
            img.onload = () => { this.backgroundImage = img; if (this.canvas) this.render(); };
            img.src = src;
        }
    }

    loadPaths() {
        try {
            const data = JSON.parse(this.pathsDataWidget.value);
            this.paths = data.paths ||[];
            this.baseCanvasWidth = data.canvas_size?.width > 0 ? data.canvas_size.width : this.frameWidth;
            this.baseCanvasHeight = data.canvas_size?.height > 0 ? data.canvas_size.height : this.frameHeight;
        } catch (e) {
            this.paths =[]; this.baseCanvasWidth = this.frameWidth; this.baseCanvasHeight = this.frameHeight;
        }
    }

    savePaths() {
        this.pathsDataWidget.value = JSON.stringify({ paths: this.paths, canvas_size: { width: this.baseCanvasWidth, height: this.baseCanvasHeight }});
        if (this.node._updatePathCount) this.node._updatePathCount();
    }

    startAnimation() {
        const animate = () => {
            this.animationOffset = (this.animationOffset + 0.5) % 20;
            this.render(); this.animationFrame = requestAnimationFrame(animate);
        };
        this.animationFrame = requestAnimationFrame(animate);
    }

    stopAnimation() {
        if (this.animationFrame) { cancelAnimationFrame(this.animationFrame); this.animationFrame = null; }
    }

    show() { document.body.appendChild(this.overlay); this.attachPasteListener(); setTimeout(() => this.container.focus(), 100); }
    
    close() {
        this.stopAnimation();
        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('keyup', this.keyupHandler);
        document.removeEventListener('paste', this.pasteHandler);
        if (this.container) this.container.removeEventListener('paste', this.pasteHandler);
        
        this.overlay.style.animation = 'fadeIn 0.15s ease-in reverse';
        this.container.style.animation = 'slideIn 0.15s ease-in reverse';
        setTimeout(() => { if (this.overlay.parentNode) document.body.removeChild(this.overlay); }, 150);
    }

    getScaleX() { return this.canvas.width / this.baseCanvasWidth; }
    getScaleY() { return this.canvas.height / this.baseCanvasHeight; }
}

// ==========================================
// 5. EXTENSION REGISTRATION
// ==========================================

async function openPathEditor(node, pathsDataWidget) {
    let w = CONFIG.DEFAULT_SIZE, h = CONFIG.DEFAULT_SIZE;
    try {
        const data = JSON.parse(pathsDataWidget.value);
        if (data.canvas_size?.width > 0) w = data.canvas_size.width;
        if (data.canvas_size?.height > 0) h = data.canvas_size.height;
    } catch (e) {}

    let fw = parseInt(ComfyUtils.getWidgetOrInputValue(node, "frame_width", null));
    let fh = parseInt(ComfyUtils.getWidgetOrInputValue(node, "frame_height", null));

    const checkImageSize = async (val, name) => {
        if (isNaN(val)) {
            const src = ComfyUtils.resolveImageSizeFromLink(node, name) || ComfyUtils.getConnectedImageUrl(node);
            if (src) {
                return await new Promise(resolve => {
                    const img = new Image();
                    img.onload = () => resolve(name === "frame_width" ? img.width : img.height);
                    img.onerror = () => resolve(NaN);
                    img.src = src;
                });
            }
        }
        return val;
    };

    fw = await checkImageSize(fw, "frame_width");
    fh = await checkImageSize(fh, "frame_height");

    if (isNaN(fw) || fw <= 0) fw = parseInt(node.widgets?.find(w => w.name === "frame_width")?.value) || w;
    if (isNaN(fh) || fh <= 0) fh = parseInt(node.widgets?.find(w => w.name === "frame_height")?.value) || h;
    
    const modal = new PathEditorModal(node, pathsDataWidget, isNaN(fw) || fw <= 0 ? w : fw, isNaN(fh) || fh <= 0 ? h : fh);
    modal.show();
}

app.registerExtension({
    name: "WanMove.PathAnimator",
    async nodeCreated(node) {
        if (node.comfyClass === "WanMove_PathAnimator") {
            const pathsDataWidget = node.widgets.find(w => w.name === "paths_data");
            if (!pathsDataWidget) return console.error("WanMove_PathAnimator: 'paths_data' widget not found!");

            ComfyUtils.moveWidgetToTop(node, pathsDataWidget);
            pathsDataWidget._cachedBackgroundImage = null;

            // 1. Hide the paths_data text widget completely from the UI layout
            pathsDataWidget.type = "hidden";
            pathsDataWidget.hidden = true; // <-- Added to ensure LiteGraph ignores it
            pathsDataWidget.computeSize = () => [0, -4]; 
            if (pathsDataWidget.inputEl) {
                pathsDataWidget.inputEl.style.display = "none";
            }

            node.addWidget("button", "Edit Paths", null, () => openPathEditor(node, pathsDataWidget));

            // 2. Setup the pathCountText property instead of a widget
            node._updatePathCount = () => {
                try {
                    const data = JSON.parse(pathsDataWidget.value);
                    const count = data.paths?.length || 0;
                    const staticCount = data.paths?.filter(p => p.isSinglePoint || p.points.length === 1).length || 0;
                    node.pathCountText = `${count} path${count !== 1 ? 's' : ''} (${count - staticCount} motion, ${staticCount} static)`;
                } catch (e) { 
                    node.pathCountText = "0 paths"; 
                }
                node.setDirtyCanvas(true, false);
            };
            node._updatePathCount();

            // 3. Expand the node slightly to make room for the text at the bottom
            const onComputeSize = node.computeSize;
            node.computeSize = function(out) {
                let size = onComputeSize ? onComputeSize.apply(this, arguments) : [200, 100];
                size[1] += 24; // Add 24px padding at the bottom
                return size;
            };

            // 4. Draw the status text at the bottom of the node background
            const onDrawForeground = node.onDrawForeground;
            node.onDrawForeground = function(ctx) {
                if (onDrawForeground) onDrawForeground.apply(this, arguments);
                
                if (this.pathCountText) {
                    ctx.save();
                    ctx.font = "12px sans-serif";
                    ctx.fillStyle = "var(--descrip-text, #a9a9a9)";
                    ctx.textAlign = "center";
                    ctx.fillText(this.pathCountText, this.size[0] / 2, this.size[1] - 8);
                    ctx.restore();
                }
            };

            // 5. Shrink node to minimum size shortly after creation <-- ADDED THIS BLOCK
            setTimeout(() => {
                node.size = node.computeSize([0, 0]);
                app.graph.setDirtyCanvas(true, true);
            }, 10);
        }
    }
});