/**
 * File: DOM.js
 * Project: ComfyUI-WanMove-Path-Animator
 * Generates DOM structure and handles UI state. Orchestrates the Canvas and Data.
 */

import { Icons, injectCSS } from "./CSS.js";
import { CONFIG, MathUtils, PathFactory, ComfyUtils } from "./Data.js";
import { PathCanvas } from "./Canvas.js";

export const DOMUtils = {
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
    }
};

export class PathEditorModal {
    constructor(node, pathsDataWidget, frameWidth, frameHeight) {
        this.node = node;
        this.pathsDataWidget = pathsDataWidget;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        
        // --- Shared State ---
        this.paths = [];
        this.currentPath = null;
        this.selectedPathIndex = -1;
        this.isDrawing = false;
        this.tool = 'pencil';
        this.currentColor = MathUtils.getRandomColor();
        this.backgroundImage = null;
        
        this.pathThickness = CONFIG.UI.PATH_THICKNESS;
        this.backgroundOpacity = CONFIG.UI.BG_OPACITY;
        
        this.shiftPressed = false;
        this.shiftPreviewPoint = false;
        this.animationOffset = 0;
        this.animationFrame = null;

        this.loadPaths();
        injectCSS();
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
            onChange(v); this.pathCanvas.render();
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
                this.pathCanvas.canvas.style.cursor = tool.name === 'select' ? 'pointer' : 'crosshair';
                toolBtns.forEach(tb => tb.classList.toggle('active', tb === btn));
            };
            return btn;
        });
        toolBtns.forEach(b => toolbar.appendChild(b));

        toolbar.appendChild(el('div', { className: 'wm-separator' }));
        toolbar.appendChild(el('button', { className: 'wm-tool-btn', innerHTML: Icons.lock(), title: 'Lock Perimeter', onclick: () => this.lockPerimeter() }));
        toolbar.appendChild(el('div', { className: 'wm-separator' }));
        
        toolbar.appendChild(el('button', { className: 'wm-tool-btn', style: 'margin-top:auto;', innerHTML: Icons.trash(), title: 'Clear All', onclick: () => {
            if (confirm('Clear all paths?')) { this.paths = []; this.selectedPathIndex = -1; this.updateSidebar(); this.pathCanvas.render(); }
        }}));

        return toolbar;
    }

    createCanvasArea() {
        this.pathCanvas = new PathCanvas(this);
        this.pathCanvas.canvas.width = this.frameWidth;
        this.pathCanvas.canvas.height = this.frameHeight;
        return DOMUtils.el('div', { className: 'wm-canvas-area' }, this.pathCanvas.canvas);
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
                    el('button', { className: 'wm-del-btn', textContent: '✕', onclick: (e) => { e.stopPropagation(); this.paths.splice(index, 1); this.selectedPathIndex = -1; this.updateSidebar(); this.pathCanvas.render(); } })
                )
            );

            if (isSel) item.appendChild(this.createTimelineControls(path, index));
            item.onclick = (e) => { 
                if (!e.target.closest('.wm-timeline-controls')) { 
                    this.selectedPathIndex = this.selectedPathIndex === index ? -1 : index; 
                    this.updateSidebar(); 
                    this.pathCanvas.render(); 
                } 
            };
            this.pathList.appendChild(item);
        });
    }

    createTimelineControls(path, pathIndex) {
        const el = DOMUtils.el;
        const container = el('div', { className: 'wm-timeline-controls' });

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
        };
        [inputRefs.start, inputRefs.end].forEach(inp => {
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

        const fQty = this.createField('Qty', path.qty || 0, { step:2, min:0, max:100 });
        const fSpr = this.createField('Spread', (path.spread !== undefined ? path.spread : 1.50).toFixed(2), { step:0.10 });
        
        const updateParams = () => {
            path.qty = Math.max(0, Math.min(100, Math.round((parseInt(fQty.inp.value) || 0) / 2) * 2));
            path.spread = parseFloat(fSpr.inp.value) || 1.50;
            fQty.inp.value = path.qty;
            this.savePaths(); this.pathCanvas.render();
        };

        fQty.inp.addEventListener('change', updateParams);
        fSpr.inp.addEventListener('change', updateParams);
        fSpr.inp.addEventListener('blur', () => { updateParams(); fSpr.inp.value = path.spread.toFixed(2); });

        container.appendChild(el('div', { style: 'display:flex; flex-direction:column; gap:6px;' },
            el('label', { className: 'wm-label', textContent: 'Spread' }),
            el('div', { className: 'wm-grid-2' }, fQty.wrap, fSpr.wrap)
        ));

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

        const updateDOM = () => { ['startY','h1X','h1Y','h2X','h2Y','endY'].forEach((k,i) => inputs[k].value = path.bezier_pts[i].toFixed(2)); };
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
            const [b0, b1, b2, b3, b4, b5] = path.bezier_pts;
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
        this.statsContainer.textContent = `Canvas: ${this.pathCanvas?.canvas.width || this.frameWidth} x ${this.pathCanvas?.canvas.height || this.frameHeight} | Image: ${imgW} x ${imgH} | Total: ${this.paths.length} paths (${stat} static, ${this.paths.length - stat} motion)`;
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

    loadImage() {
        const el = DOMUtils.el;
        const inp = el('input', { type: 'file', accept: 'image/*', onchange: e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const img = new Image();
                img.onload = () => { this.backgroundImage = img; this.pathsDataWidget._cachedBackgroundImage = ev.target.result; this.pathCanvas.render(); };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        }});
        inp.click();
    }

    clearImage() {
        if (confirm('Clear background image?')) { this.backgroundImage = null; this.pathsDataWidget._cachedBackgroundImage = null; this.pathCanvas.render(); }
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
        this.updateSidebar(); this.pathCanvas.render();
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
            img.onload = () => { this.backgroundImage = img; this.pathsDataWidget._cachedBackgroundImage = ev.target.result; this.pathCanvas.render(); };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(blob);
    }

    loadCachedBackgroundImage() {
        const src = ComfyUtils.getConnectedImageUrl(this.node) || this.pathsDataWidget._cachedBackgroundImage;
        if (src) {
            const img = new Image();
            img.onload = () => { this.backgroundImage = img; if (this.pathCanvas?.canvas) this.pathCanvas.render(); };
            img.src = src;
        }
    }

    loadPaths() {
        try {
            const data = JSON.parse(this.pathsDataWidget.value);
            this.paths = data.paths || [];
            this.baseCanvasWidth = data.canvas_size?.width > 0 ? data.canvas_size.width : this.frameWidth;
            this.baseCanvasHeight = data.canvas_size?.height > 0 ? data.canvas_size.height : this.frameHeight;
        } catch (e) {
            this.paths = []; this.baseCanvasWidth = this.frameWidth; this.baseCanvasHeight = this.frameHeight;
        }
    }

    savePaths() {
        this.pathsDataWidget.value = JSON.stringify({ paths: this.paths, canvas_size: { width: this.baseCanvasWidth, height: this.baseCanvasHeight }});
        if (this.node._updatePathCount) this.node._updatePathCount();
    }

    startAnimation() {
        const animate = () => {
            this.animationOffset = (this.animationOffset + 0.5) % 20;
            if (this.pathCanvas) this.pathCanvas.render();
            this.animationFrame = requestAnimationFrame(animate);
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
}