/**
 * File: WanMove_PathAnimator.js
 * Project: ComfyUI-WanMove-Path-Animator
 *
 * Interactive path animator with drawing editor
 */

import { app } from "../../../../../scripts/app.js";
import { api } from "../../../../../scripts/api.js";

// SVG Icon Helper Functions
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

function moveWidgetToTop(node, widget) {
    if (!widget) return;
    const widgetIndex = node.widgets.indexOf(widget);
    if (widgetIndex > 0) {
        node.widgets.splice(widgetIndex, 1);
        node.widgets.unshift(widget);
    }
}

app.registerExtension({
    name: "WanMove.PathAnimator",
    async nodeCreated(node) {
        if (node.comfyClass === "WanMove_PathAnimator") {
            const pathsDataWidget = node.widgets.find(w => w.name === "paths_data");
            if (!pathsDataWidget) {
                console.error("WanMove_PathAnimator: 'paths_data' widget not found!");
                return;
            }

            moveWidgetToTop(node, pathsDataWidget);
            pathsDataWidget._cachedBackgroundImage = null;

            const editButton = node.addWidget("button", "Edit Paths", null, () => {
                openPathEditor(node, pathsDataWidget);
            });

            const pathCountWidget = node.addWidget("text", "Path Count", "0 paths", null);
            pathCountWidget.disabled = false;

            function updatePathCount() {
                try {
                    const data = JSON.parse(pathsDataWidget.value);
                    const count = data.paths ? data.paths.length : 0;
                    const staticCount = data.paths ? data.paths.filter(p => p.isSinglePoint || p.points.length === 1).length : 0;
                    const motionCount = count - staticCount;
                    pathCountWidget.value = `${count} path${count !== 1 ? 's' : ''} (${staticCount} static, ${motionCount} motion)`;
                } catch (e) {
                    pathCountWidget.value = "0 paths";
                }
            }

            updatePathCount();
            node._updatePathCount = updatePathCount;
        }
    }
});

function getWidgetOrInputValue(node, name, defaultValue) {
    let currentNode = node;
    let currentSearchName = name;
    let visited = new Set();
    
    for (let i = 0; i < 20; i++) { 
        if (!currentNode) break;
        
        // Prevent infinite loops in case of complex/cyclic graph routing
        if (visited.has(currentNode.id)) break;
        visited.add(currentNode.id);
        
        let foundLink = false;

        // 1. Prioritize Inputs (Standard physical wires)
        if (currentNode.inputs) {
            const input = currentNode.inputs.find(inp => inp.name === currentSearchName);
            if (input && input.link !== null && input.link !== undefined) {
                const link = app.graph.links[input.link];
                if (link) {
                    currentNode = app.graph.getNodeById(link.origin_id);
                    if (currentNode && currentNode.outputs && currentNode.outputs[link.origin_slot]) {
                        currentSearchName = currentNode.outputs[link.origin_slot].name;
                    } else {
                        currentSearchName = "value";
                    }
                    foundLink = true;
                }
            }
        }
        
        // We successfully followed a wire upstream, run the loop again on the new node
        if (foundLink) continue;

        // 2. Handle "GetNode" to "SetNode" virtual wires
        const cClass = currentNode.comfyClass || "";
        const cType = currentNode.type || "";
        
        if (cClass === "GetNode" || cType === "GetNode" || cClass === "Anything Anywhere Getter") {
            // Find the variable name it is requesting (usually 'constant', 'Value', or just the 1st widget)
            const getWidget = currentNode.widgets?.find(w => w.name === "constant" || w.name === "Value") || (currentNode.widgets ? currentNode.widgets[0] : null);
            
            if (getWidget && getWidget.value) {
                const varName = getWidget.value;
                
                // Scan the entire graph to find the SetNode broadcasting this variable
                const setNode = app.graph._nodes.find(n => {
                    // Safe access to prevent 'includes of undefined' errors
                    const nClass = n.comfyClass || "";
                    const nType = n.type || "";
                    
                    const isSetNode = nClass.includes("SetNode") || nType.includes("SetNode") || nClass.includes("Anything Anywhere Setter");
                    if (!isSetNode) return false;
                    
                    const setWidget = n.widgets?.find(w => w.name === "constant" || w.name === "Value") || (n.widgets ? n.widgets[0] : null);
                    return setWidget && setWidget.value === varName;
                });
                
                if (setNode) {
                    // Virtual wire successful! Jump to the Set node and continue tracing its input
                    currentNode = setNode;
                    currentSearchName = (setNode.inputs && setNode.inputs.length > 0) ? setNode.inputs[0].name : "value";
                    continue; 
                }
            }
        }

        // 3. If no physical or virtual wire is connected, fall back to the Widget value
        if (currentNode.widgets) {
            let widget = currentNode.widgets.find(w => w.name === currentSearchName || w.name === "value");
            
            // If we traced up to an INTConstant primitive, it usually stores its data in the first widget
            if (!widget && currentNode.widgets.length > 0) {
                widget = currentNode.widgets[0]; 
            }
            
            if (widget && widget.value !== undefined) {
                return widget.value;
            }
        }
        
        break; // Dead end reached
    }
    
    return defaultValue;
}

function openPathEditor(node, pathsDataWidget) {
    // Try to recover last known canvas size if available
    let fallbackW = 512;
    let fallbackH = 512;
    try {
        const data = JSON.parse(pathsDataWidget.value);
        if (data.canvas_size) {
            if (data.canvas_size.width > 0) fallbackW = data.canvas_size.width;
            if (data.canvas_size.height > 0) fallbackH = data.canvas_size.height;
        }
    } catch (e) {}

    let frameWidth = parseInt(getWidgetOrInputValue(node, "frame_width", fallbackW));
    let frameHeight = parseInt(getWidgetOrInputValue(node, "frame_height", fallbackH));

    // Fallback if connected to Set/Get nodes (which return string variable names resulting in NaN)
    if (isNaN(frameWidth) || frameWidth <= 0) frameWidth = fallbackW;
    if (isNaN(frameHeight) || frameHeight <= 0) frameHeight = fallbackH;

    const modal = new PathEditorModal(node, pathsDataWidget, frameWidth, frameHeight);
    modal.show();
}

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
        this.currentColor = this.getRandomColor();
        this.backgroundImage = null;
        this.canvasScale = 1.0;
        this.canvasOffsetX = 0;
        this.canvasOffsetY = 0;
        this.pathThickness = 3;
        this.shiftPressed = false;
        this.backgroundOpacity = 1.0;
        this.animationOffset = 0;
        this.animationFrame = null;

        this.loadPaths();
        this.createModal();
        this.loadCachedBackgroundImage();
        this.setupKeyboardHandlers();
        this.startAnimation();
    }

    startAnimation() {
        const animate = () => {
            this.animationOffset += 0.5;
            if (this.animationOffset > 20) {
                this.animationOffset = 0;
            }
            this.render();
            this.animationFrame = requestAnimationFrame(animate);
        };
        this.animationFrame = requestAnimationFrame(animate);
    }

    stopAnimation() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    setupKeyboardHandlers() {
        this.keydownHandler = (e) => {
            if (e.key === 'Shift') {
                this.shiftPressed = true;
            }
            if (e.key === 'Escape') {
                this.savePaths();
                this.close();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                e.stopPropagation();
                this.pasteFromClipboard();
            }
        };

        this.keyupHandler = (e) => {
            if (e.key === 'Shift') {
                this.shiftPressed = false;
            }
        };

        this.pasteHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handlePaste(e);
        };

        document.addEventListener('keydown', this.keydownHandler);
        document.addEventListener('keyup', this.keyupHandler);
    }

    attachPasteListener() {
        if (this.container) {
            this.container.addEventListener('paste', this.pasteHandler);
            document.addEventListener('paste', this.pasteHandler);
        }
    }

    getConnectedImageUrl() {
        if (!this.node.inputs) return null;
        const imgInput = this.node.inputs.find(i => i.name === "image");
        if (!imgInput || imgInput.link === null) return null;
        
        const link = app.graph.links[imgInput.link];
        if (!link) return null;
        
        let currentNode = app.graph.getNodeById(link.origin_id);
        const visited = new Set();
        
        // Traverse the graph to find a node that has a preview or image widget
        while (currentNode && !visited.has(currentNode.id)) {
            visited.add(currentNode.id);
            
            // 1. Check if the current node itself generated a preview image (e.g., LoadImage or nodes with previews)
            if (currentNode.imgs && currentNode.imgs.length > 0) {
                return currentNode.imgs[0].src;
            }
            
            // 2. Look forward: Check if this node outputs to a PreviewImage or SaveImage node
            if (currentNode.outputs) {
                for (const output of currentNode.outputs) {
                    if (output.type === "IMAGE" && output.links) {
                        for (const linkId of output.links) {
                            const childLink = app.graph.links[linkId];
                            if (childLink) {
                                const childNode = app.graph.getNodeById(childLink.target_id);
                                if (childNode && childNode.imgs && childNode.imgs.length > 0) {
                                    return childNode.imgs[0].src;
                                }
                            }
                        }
                    }
                }
            }
            
            // 3. Check if the node has a static image widget (like LoadImage)
            const imgWidget = currentNode.widgets?.find(w => w.name === "image");
            if (imgWidget && imgWidget.value) {
                let filename = imgWidget.value;
                let subfolder = "";
                let type = "input";
                
                if (typeof imgWidget.value === "object") {
                    filename = imgWidget.value.filename || filename;
                    subfolder = imgWidget.value.subfolder || subfolder;
                    type = imgWidget.value.type || type;
                }
                
                if (filename && typeof filename === "string") {
                    const searchParams = new URLSearchParams();
                    searchParams.append("filename", filename);
                    if (subfolder) searchParams.append("subfolder", subfolder);
                    if (type) searchParams.append("type", type);
                    return api.apiURL(`/view?${searchParams.toString()}`);
                }
            }
            
            // 4. Move upstream: backtrack to find the first incoming IMAGE link
            let upstreamNode = null;
            if (currentNode.inputs) {
                for (const input of currentNode.inputs) {
                    if (input.type === "IMAGE" && input.link) {
                        const parentLink = app.graph.links[input.link];
                        if (parentLink) {
                            upstreamNode = app.graph.getNodeById(parentLink.origin_id);
                            break; // Follow the first image branch backwards
                        }
                    }
                }
            }
            
            currentNode = upstreamNode;
        }
        
        return null;
    }

    loadCachedBackgroundImage() {
        let srcToLoad = null;
        const connectedUrl = this.getConnectedImageUrl();
        
        if (connectedUrl) {
            srcToLoad = connectedUrl;
        } else if (this.pathsDataWidget._cachedBackgroundImage) {
            srcToLoad = this.pathsDataWidget._cachedBackgroundImage;
        }

        if (srcToLoad) {
            const img = new Image();
            img.onload = () => {
                this.backgroundImage = img;
                if (this.canvas) {
                    this.render();
                }
            };
            img.src = srcToLoad;
        }
    }

    async pasteFromClipboard() {
        try {
            if (!navigator.clipboard || !navigator.clipboard.read) return;
            const clipboardItems = await navigator.clipboard.read();

            for (const clipboardItem of clipboardItems) {
                for (const type of clipboardItem.types) {
                    if (type.startsWith('image/')) {
                        const blob = await clipboardItem.getType(type);
                        this.loadImageFromBlob(blob);
                        return;
                    }
                }
            }
        } catch (err) {
            console.error('WanMove_PathAnimator: Error reading from clipboard:', err);
        }
    }

    loadImageFromBlob(blob) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                this.backgroundImage = img;
                this.pathsDataWidget._cachedBackgroundImage = event.target.result;
                this.render();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(blob);
    }

    handlePaste(e) {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
                const blob = item.getAsFile();
                if (!blob) continue;
                this.loadImageFromBlob(blob);
                break;
            }
        }
    }

    loadPaths() {
        try {
            const data = JSON.parse(this.pathsDataWidget.value);
            this.paths = data.paths ||[];
        } catch (e) {
            this.paths =[];
        }
    }

    savePaths() {
        const data = {
            paths: this.paths,
            canvas_size: {
                width: this.canvas.width,
                height: this.canvas.height
            }
        };
        this.pathsDataWidget.value = JSON.stringify(data);

        if (this.node._updatePathCount) {
            this.node._updatePathCount();
        }
    }

    getRandomColor() {
        const colors =['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    createModal() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'wanmove-path-editor-overlay';
        this.overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(4px);
            z-index: 10000; display: flex; align-items: center; justify-content: center;
            animation: fadeIn 0.2s ease-out;
        `;

        this.container = document.createElement('div');
        this.container.className = 'wanmove-path-editor-container';
        this.container.tabIndex = 0;
        this.container.style.cssText = `
            background: linear-gradient(145deg, #2d2d2d, #252525);
            border-radius: 12px; border: 1px solid #3a3a3a;
            width: 95%; height: 95%; max-width: 2000px; max-height: 1400px;
            display: flex; flex-direction: column;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.05);
            animation: slideIn 0.3s ease-out; outline: none;
        `;

        this.createHeader();
        this.createMainContent();
        this.createFooter();

        this.overlay.appendChild(this.container);

        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });
    }

    createHeader() {
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 20px 24px 16px 24px; border-bottom: 1px solid #404040;
            background: linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%);
            display: flex; flex-direction: column; gap: 16px; border-radius: 12px 12px 0 0;
        `;

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

        const titleContainer = document.createElement('div');
        titleContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';

        const title = document.createElement('h2');
        title.innerHTML = `${Icons.edit()} <span style="margin-left: 8px;">Path Animator Editor</span>`;
        title.style.cssText = 'margin: 0; color: #fff; font-size: 20px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center;';

        const subtitle = document.createElement('div');
        subtitle.textContent = 'Press ESC to save & close | Hold SHIFT for straight lines | CTRL+V to paste image';
        subtitle.style.cssText = 'color: #888; font-size: 12px; font-weight: 400;';

        titleContainer.appendChild(title);
        titleContainer.appendChild(subtitle);

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = Icons.close();
        closeBtn.style.cssText = `
            background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 6px; color: #fff; cursor: pointer; padding: 0; width: 36px; height: 36px;
            display: flex; align-items: center; justify-content: center; transition: all 0.2s ease;
        `;
        closeBtn.onmouseover = () => { closeBtn.style.background = 'rgba(255, 77, 77, 0.8)'; closeBtn.style.transform = 'scale(1.05)'; };
        closeBtn.onmouseout = () => { closeBtn.style.background = 'rgba(255, 255, 255, 0.05)'; closeBtn.style.transform = 'scale(1)'; };
        closeBtn.onclick = () => this.close();

        topRow.appendChild(titleContainer);
        topRow.appendChild(closeBtn);

        const controlsRow = document.createElement('div');
        controlsRow.style.cssText = 'display: flex; gap: 32px; align-items: center; padding: 12px 16px; background: rgba(0, 0, 0, 0.2); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05);';

        const widthControl = this.createSliderControl('Path Width', 1, 10, this.pathThickness, (value) => { this.pathThickness = value; });
        const opacityControl = this.createSliderControl('Background Opacity', 50, 100, this.backgroundOpacity * 100, (value) => { this.backgroundOpacity = value / 100; }, '%');

        controlsRow.appendChild(widthControl);
        controlsRow.appendChild(opacityControl);

        header.appendChild(topRow);
        header.appendChild(controlsRow);
        this.container.appendChild(header);
    }

    createSliderControl(label, min, max, defaultValue, onChange, suffix = '') {
        const container = document.createElement('div');
        container.style.cssText = 'flex: 1; display: flex; align-items: center; gap: 12px;';

        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        labelEl.style.cssText = 'color: #fff; font-size: 13px; font-weight: 500; min-width: 120px; opacity: 0.9;';

        const sliderContainer = document.createElement('div');
        sliderContainer.style.cssText = 'flex: 1; display: flex; align-items: center; gap: 12px;';

        const slider = document.createElement('input');
        slider.type = 'range'; slider.min = min; slider.max = max; slider.value = defaultValue;
        slider.style.cssText = 'flex: 1; cursor: pointer; accent-color: #4ECDC4; height: 6px;';

        const valueDisplay = document.createElement('div');
        valueDisplay.textContent = defaultValue + suffix;
        valueDisplay.style.cssText = 'color: #4ECDC4; font-size: 14px; font-weight: bold; min-width: 50px; text-align: right;';

        slider.oninput = (e) => {
            const value = parseInt(e.target.value);
            valueDisplay.textContent = value + suffix;
            onChange(value);
            this.render();
        };

        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(valueDisplay);
        container.appendChild(labelEl);
        container.appendChild(sliderContainer);

        return container;
    }

    createMainContent() {
        const content = document.createElement('div');
        content.style.cssText = 'flex: 1; display: flex; overflow: hidden;';

        this.createToolbar(content);
        this.createCanvasArea(content);
        this.createSidebar(content);

        this.container.appendChild(content);
    }

    createToolbarButton(iconSvg, title, isActive = false) {
        const btn = document.createElement('button');
        btn.innerHTML = iconSvg; btn.title = title;
        btn.style.cssText = `
            width: 50px; height: 50px; border: 2px solid ${isActive ? '#4ECDC4' : 'rgba(255, 255, 255, 0.15)'};
            background: ${isActive ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
            color: #fff; cursor: pointer; border-radius: 8px; transition: all 0.2s ease;
            box-shadow: ${isActive ? '0 0 12px rgba(78, 205, 196, 0.3)' : 'none'};
            display: flex; align-items: center; justify-content: center; padding: 0;
        `;
        btn.onmouseover = () => { if (!isActive) { btn.style.background = 'rgba(255, 255, 255, 0.1)'; btn.style.transform = 'scale(1.05)'; } };
        btn.onmouseout = () => { if (!isActive) { btn.style.background = 'rgba(255, 255, 255, 0.05)'; btn.style.transform = 'scale(1)'; } };
        return btn;
    }

    createToolbar(parent) {
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'width: 70px; background: linear-gradient(180deg, #1e1e1e 0%, #181818 100%); border-right: 1px solid #3a3a3a; padding: 12px 10px; display: flex; flex-direction: column; gap: 8px; box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);';

        const uploadBtn = this.createToolbarButton(Icons.image(), 'Load Background Image');
        uploadBtn.onclick = () => this.loadImage();
        toolbar.appendChild(uploadBtn);

        const clearImgBtn = this.createToolbarButton(Icons.xCircle(), 'Clear Background Image');
        clearImgBtn.onclick = () => this.clearImage();
        toolbar.appendChild(clearImgBtn);

        const separator = document.createElement('div');
        separator.style.cssText = 'height: 1px; background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent); margin: 8px 0;';
        toolbar.appendChild(separator);

        const tools =[
            { name: 'pencil', icon: Icons.pencil(), title: 'Draw Path (Motion)' },
            { name: 'point', icon: Icons.pin(), title: 'Add Static Point (Anchor)' },
            { name: 'select', icon: Icons.cursor(), title: 'Select Path' },
        ];

        const toolButtons =[];
        tools.forEach(tool => {
            const btn = this.createToolbarButton(tool.icon, tool.title, this.tool === tool.name);
            btn.dataset.tool = tool.name;
            btn.onclick = () => {
                this.tool = tool.name;
                this.canvas.style.cursor = tool.name === 'select' ? 'pointer' : 'crosshair';
                toolButtons.forEach(tb => {
                    const isActive = tb.dataset.tool === tool.name;
                    tb.style.border = `2px solid ${isActive ? '#4ECDC4' : 'rgba(255, 255, 255, 0.15)'}`;
                    tb.style.background = isActive ? 'rgba(78, 205, 196, 0.2)' : 'rgba(255, 255, 255, 0.05)';
                    tb.style.boxShadow = isActive ? '0 0 12px rgba(78, 205, 196, 0.3)' : 'none';
                });
            };
            toolButtons.push(btn);
            toolbar.appendChild(btn);
        });

        const separator2 = document.createElement('div');
        separator2.style.cssText = separator.style.cssText;
        toolbar.appendChild(separator2);

        const lockPerimeterBtn = this.createToolbarButton(Icons.lock(), 'Lock Perimeter - Add static shapes around border');
        lockPerimeterBtn.onclick = () => this.lockPerimeter();
        toolbar.appendChild(lockPerimeterBtn);

        const separator3 = document.createElement('div');
        separator3.style.cssText = separator.style.cssText;
        toolbar.appendChild(separator3);

        const clearBtn = this.createToolbarButton(Icons.trash(), 'Clear All Paths');
        clearBtn.style.marginTop = 'auto';
        clearBtn.onclick = () => {
            if (confirm('Clear all paths?')) {
                this.paths =[];
                this.selectedPathIndex = -1;
                this.updateSidebar();
                this.render();
            }
        };
        toolbar.appendChild(clearBtn);

        parent.appendChild(toolbar);
    }

    loadImage() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                        this.backgroundImage = img;
                        this.pathsDataWidget._cachedBackgroundImage = event.target.result;
                        this.render();
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
    }

    clearImage() {
        if (confirm('Clear background image?')) {
            this.backgroundImage = null;
            this.pathsDataWidget._cachedBackgroundImage = null;
            this.render();
        }
    }

    lockPerimeter() {
        const numPoints = prompt('How many shapes around the perimeter?', '12');
        if (!numPoints || isNaN(numPoints) || numPoints < 1) return;

        const count = parseInt(numPoints);
        const w = this.canvas.width;
        const h = this.canvas.height;
        const perimeter = 2 * (w + h);
        const spacing = perimeter / count;

        for (let i = 0; i < count; i++) {
            const d = i * spacing;
            let x, y;

            if (d < w) { x = d; y = 0; }
            else if (d < w + h) { x = w; y = d - w; }
            else if (d < 2 * w + h) { x = w - (d - w - h); y = h; }
            else { x = 0; y = h - (d - 2 * w - h); }

            const path = {
                id: 'path_' + Date.now() + '_' + i,
                name: 'Perimeter ' + (i + 1),
                points:[{ x: Math.round(x), y: Math.round(y) }],
                color: this.getRandomColor(),
                isSinglePoint: true,
                startTime: 0.0,
                endTime: 1.0,
                bezier_pts:[0.0, 0.0, 0.0, 1.0, 1.0, 1.0], // Default Linear (6 parameters now)
                visibilityMode: 'pop'
            };
            this.paths.push(path);
        }

        this.updateSidebar();
        this.render();
    }

    createCanvasArea(parent) {
        const canvasContainer = document.createElement('div');
        canvasContainer.style.cssText = 'flex: 1; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at center, #1e1e1e 0%, #0a0a0a 100%); position: relative; overflow: hidden; padding: 20px;';

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.frameWidth;
        this.canvas.height = this.frameHeight;
        this.canvas.style.cssText = 'border: 1px solid #4a4a4a; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6); cursor: crosshair; max-width: 100%; max-height: 100%; border-radius: 4px;';

        this.ctx = this.canvas.getContext('2d');
        this.setupCanvasEvents();

        canvasContainer.appendChild(this.canvas);
        parent.appendChild(canvasContainer);

        this.render();
    }

    setupCanvasEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
    }

    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    }

    onMouseDown(e) {
        const pos = this.getCanvasCoords(e);

        if (this.tool === 'pencil') {
            this.isDrawing = true;
            this.currentPath = {
                id: 'path_' + Date.now(),
                name: 'Path ' + (this.paths.length + 1),
                points: [pos],
                color: this.currentColor,
                closed: false,
                isSinglePoint: false,
                startTime: 0.0,
                endTime: 1.0,
                bezier_pts:[0.0, 0.0, 0.0, 1.0, 1.0, 1.0], // Default linear
                visibilityMode: 'pop'
            };
        } else if (this.tool === 'point') {
            const path = {
                id: 'path_' + Date.now(),
                name: 'Static ' + (this.paths.filter(p => p.isSinglePoint).length + 1),
                points: [pos],
                color: this.currentColor,
                isSinglePoint: true,
                startTime: 0.0,
                endTime: 1.0,
                bezier_pts:[0.0, 0.0, 0.0, 1.0, 1.0, 1.0], // Default linear
                visibilityMode: 'pop'
            };
            this.paths.push(path);
            this.selectedPathIndex = this.paths.length - 1;
            this.currentColor = this.getRandomColor();
            this.updateSidebar();
            this.render();
        } else if (this.tool === 'select') {
            this.selectedPathIndex = this.findPathAtPoint(pos);
            this.updateSidebar();
            this.render();
        }
    }

    onMouseMove(e) {
        if (this.isDrawing && this.tool === 'pencil') {
            const pos = this.getCanvasCoords(e);

            if (this.shiftPressed && this.currentPath.points.length > 0) {
                const lastPoint = this.currentPath.points[this.currentPath.points.length - 1];
                const dx = Math.abs(pos.x - lastPoint.x);
                const dy = Math.abs(pos.y - lastPoint.y);

                let constrainedPos;
                if (dx > dy * 2) {
                    constrainedPos = { x: pos.x, y: lastPoint.y };
                } else if (dy > dx * 2) {
                    constrainedPos = { x: lastPoint.x, y: pos.y };
                } else {
                    const dist = Math.min(dx, dy);
                    constrainedPos = {
                        x: lastPoint.x + (pos.x > lastPoint.x ? dist : -dist),
                        y: lastPoint.y + (pos.y > lastPoint.y ? dist : -dist)
                    };
                }

                if (!this.shiftPreviewPoint) {
                    this.shiftPreviewPoint = true;
                    this.currentPath.points.push(constrainedPos);
                } else {
                    this.currentPath.points[this.currentPath.points.length - 1] = constrainedPos;
                }
                this.render();
            } else {
                this.shiftPreviewPoint = false;
                const lastPoint = this.currentPath.points[this.currentPath.points.length - 1];
                const dist = Math.sqrt(Math.pow(pos.x - lastPoint.x, 2) + Math.pow(pos.y - lastPoint.y, 2));

                if (dist > 3) { 
                    this.currentPath.points.push(pos);
                    this.render();
                }
            }
        }
    }

    onMouseUp(e) {
        if (this.isDrawing && this.currentPath) {
            this.shiftPreviewPoint = false;

            if (this.currentPath.points.length > 1) {
                this.paths.push(this.currentPath);
                this.selectedPathIndex = this.paths.length - 1;
                this.currentColor = this.getRandomColor();
                this.updateSidebar();
            } else if (this.currentPath.points.length === 1) {
                this.currentPath.isSinglePoint = true;
                this.currentPath.name = 'Static ' + (this.paths.filter(p => p.isSinglePoint).length + 1);
                this.paths.push(this.currentPath);
                this.selectedPathIndex = this.paths.length - 1;
                this.currentColor = this.getRandomColor();
                this.updateSidebar();
            }
            this.currentPath = null;
            this.isDrawing = false;
            this.render();
        }
    }

    findPathAtPoint(point, baseThreshold = 10) {
        const scale = this.getRenderScale();
        const threshold = baseThreshold * scale;

        for (let i = this.paths.length - 1; i >= 0; i--) {
            const path = this.paths[i];
            if (path.isSinglePoint || path.points.length === 1) {
                const p = path.points[0];
                const dist = Math.sqrt(Math.pow(point.x - p.x, 2) + Math.pow(point.y - p.y, 2));
                if (dist < threshold) return i;
            }
        }

        for (let i = this.paths.length - 1; i >= 0; i--) {
            const path = this.paths[i];
            if (!path.isSinglePoint && path.points.length > 1) {
                for (let j = 0; j < path.points.length - 1; j++) {
                    const p1 = path.points[j];
                    const p2 = path.points[j + 1];
                    const dist = this.distanceToSegment(point, p1, p2);
                    if (dist < threshold) return i;
                }
            }
        }
        return -1;
    }

    distanceToSegment(point, p1, p2) {
        const A = point.x - p1.x; const B = point.y - p1.y;
        const C = p2.x - p1.x; const D = p2.y - p1.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) { xx = p1.x; yy = p1.y; }
        else if (param > 1) { xx = p2.x; yy = p2.y; }
        else { xx = p1.x + param * C; yy = p1.y + param * D; }

        const dx = point.x - xx; const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    getRenderScale() {
        const baseResolution = 512;
        const minDimension = Math.min(this.canvas.width, this.canvas.height);
        return minDimension / baseResolution;
    }

render() {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = 'rgb(30, 30, 30)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.backgroundImage && this.backgroundImage.complete) {
            this.ctx.save();
            this.ctx.globalAlpha = this.backgroundOpacity;
            this.ctx.drawImage(this.backgroundImage, 0, 0); 
            this.ctx.restore();
        }

        if (this.updateStats) this.updateStats();

        this.paths.forEach((path, index) => {
            this.drawPath(path, index === this.selectedPathIndex);
        });

        if (this.currentPath) {
            this.drawPath(this.currentPath, true);
        }
    }

    drawPath(path, isSelected = false) {
        const isSinglePoint = path.isSinglePoint || path.points.length === 1;
        const scale = this.getRenderScale();
        const neonGreen = '#00FF41';

        if (isSinglePoint) {
            const point = path.points[0];
            const baseSize = isSelected ? 14 : 8;
            const size = baseSize * scale;

            this.ctx.fillStyle = isSelected ? neonGreen : path.color;
            this.ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);

            this.ctx.strokeStyle = isSelected ? neonGreen : '#fff';
            this.ctx.lineWidth = 2 * scale;
            this.ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size);

            if (isSelected) {
                this.ctx.fillStyle = neonGreen;
                this.ctx.font = `bold ${12 * scale}px sans-serif`;
                this.ctx.fillText('Static', point.x + 10 * scale, point.y - 10 * scale);
            }
        } else if (path.points.length >= 2) {
            this.ctx.beginPath();
            this.ctx.moveTo(path.points[0].x, path.points[0].y);

            for (let i = 1; i < path.points.length; i++) {
                this.ctx.lineTo(path.points[i].x, path.points[i].y);
            }

            this.ctx.strokeStyle = isSelected ? neonGreen : path.color;
            this.ctx.lineWidth = (isSelected ? this.pathThickness + 0.1 : this.pathThickness) * scale;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.stroke();

            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.moveTo(path.points[0].x, path.points[0].y);

            for (let i = 1; i < path.points.length; i++) {
                this.ctx.lineTo(path.points[i].x, path.points[i].y);
            }

            const dashLength = 10 * scale;
            const gapLength = 10 * scale;
            this.ctx.setLineDash([dashLength, gapLength]);
            this.ctx.lineDashOffset = -this.animationOffset * scale;
            this.ctx.strokeStyle = isSelected ? 'rgba(0, 255, 65, 0.8)' : 'rgba(255, 255, 255, 0.6)';
            this.ctx.lineWidth = Math.max(1, this.pathThickness * 0.5) * scale;
            this.ctx.stroke();
            this.ctx.restore();

            if (isSelected) {
                path.points.forEach((point, idx) => {
                    this.ctx.beginPath();
                    this.ctx.arc(point.x, point.y, Math.max(6, this.pathThickness + 2) * scale, 0, Math.PI * 2);
                    this.ctx.fillStyle = neonGreen;
                    this.ctx.fill();

                    this.ctx.beginPath();
                    this.ctx.arc(point.x, point.y, Math.max(3, this.pathThickness * 0.6) * scale, 0, Math.PI * 2);
                    this.ctx.fillStyle = '#000';
                    this.ctx.fill();

                    if (path.points.length < 20) {
                        this.ctx.fillStyle = neonGreen;
                        this.ctx.font = `bold ${10 * scale}px sans-serif`;
                        this.ctx.fillText(idx, point.x + 8 * scale, point.y - 8 * scale);
                    }
                });

                const midPoint = path.points[Math.floor(path.points.length / 2)];
                this.ctx.fillStyle = neonGreen;
                this.ctx.font = `bold ${12 * scale}px sans-serif`;
                this.ctx.fillText(`Motion (${path.points.length} pts)`, midPoint.x + 10 * scale, midPoint.y - 10 * scale);
            }
        }
    }

    createSidebar(parent) {
        this.sidebar = document.createElement('div');
        this.sidebar.style.cssText = 'width: 280px; background: #1e1e1e; border-left: 1px solid #444; padding: 15px; overflow-y: auto;';

        const title = document.createElement('h3');
        title.textContent = 'Paths';
        title.style.cssText = 'margin: 0 0 15px 0; color: #fff; font-size: 14px; font-weight: 500;';
        this.sidebar.appendChild(title);

        this.pathList = document.createElement('div');
        this.pathList.style.cssText = 'display: flex; flex-direction: column; gap: 8px;';
        this.sidebar.appendChild(this.pathList);

        parent.appendChild(this.sidebar);
        this.updateSidebar();
    }

    updateSidebar() {
        if (!this.pathList) return;
        this.pathList.innerHTML = '';

        this.paths.forEach((path, index) => {
            const isSinglePoint = path.isSinglePoint || path.points.length === 1;
            const neonGreen = '#00FF41';
            const isSelected = index === this.selectedPathIndex;

            const item = document.createElement('div');
            item.style.cssText = `
                padding: 10px; background: ${isSelected ? 'rgba(0, 255, 65, 0.15)' : '#2b2b2b'};
                border: 2px solid ${isSelected ? neonGreen : '#444'}; border-radius: 4px;
                cursor: pointer; color: #fff; font-size: 12px; display: flex; flex-direction: column;
                gap: 6px; transition: all 0.2s ease;
            `;

            const topRow = document.createElement('div');
            topRow.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';

            const info = document.createElement('div');
            info.style.cssText = 'display: flex; align-items: center; gap: 8px; flex: 1;';

            const colorBox = document.createElement('div');
            colorBox.style.cssText = `
                width: 16px; height: 16px; background: ${isSelected ? neonGreen : path.color};
                border-radius: ${isSinglePoint ? '2px' : '50%'};
                border: 2px solid ${isSelected ? neonGreen : (isSinglePoint ? '#fff' : 'transparent')};
            `;

            const nameContainer = document.createElement('div');
            nameContainer.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';

            const name = document.createElement('span');
            name.textContent = path.name || `Path ${index + 1}`;
            name.style.cssText = `font-weight: 500; color: ${isSelected ? neonGreen : '#fff'};`;

            const typeLabel = document.createElement('span');
            typeLabel.innerHTML = isSinglePoint
                ? `${Icons.target()} <span style="margin-left: 4px;">Static (1 pt)</span>`
                : `${Icons.arrowRight()} <span style="margin-left: 4px;">Motion (${path.points.length} pts)</span>`;
            typeLabel.style.cssText = `font-size: 10px; color: ${isSelected ? neonGreen : (isSinglePoint ? '#F7DC6F' : '#4ECDC4')}; display: flex; align-items: center;`;

            nameContainer.appendChild(name);
            nameContainer.appendChild(typeLabel);
            info.appendChild(colorBox);
            info.appendChild(nameContainer);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '✕';
            deleteBtn.style.cssText = 'background: rgba(255, 77, 77, 0.2); border: 1px solid rgba(255, 77, 77, 0.4); border-radius: 4px; color: #ff4d4d; cursor: pointer; font-size: 14px; padding: 4px 8px; transition: all 0.2s ease;';
            deleteBtn.onmouseover = () => { deleteBtn.style.background = 'rgba(255, 77, 77, 0.4)'; deleteBtn.style.borderColor = 'rgba(255, 77, 77, 0.8)'; };
            deleteBtn.onmouseout = () => { deleteBtn.style.background = 'rgba(255, 77, 77, 0.2)'; deleteBtn.style.borderColor = 'rgba(255, 77, 77, 0.4)'; };
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.paths.splice(index, 1);
                this.selectedPathIndex = -1;
                this.updateSidebar();
                this.render();
            };

            topRow.appendChild(info);
            topRow.appendChild(deleteBtn);
            item.appendChild(topRow);

            if (isSelected) {
                const timelineControls = this.createTimelineControls(path, index);
                item.appendChild(timelineControls);
            }

            item.onclick = (e) => {
                if (e.target.closest('.timeline-controls')) return;
                this.selectedPathIndex = index;
                this.updateSidebar();
                this.render();
            };

            this.pathList.appendChild(item);
        });
    }

    createTimelineControls(path, pathIndex) {
        const container = document.createElement('div');
        container.className = 'timeline-controls';
        container.style.cssText = 'margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.1); display: flex; flex-direction: column; gap: 12px;';

        const timelineSection = document.createElement('div');
        timelineSection.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

        const timelineLabel = document.createElement('label');
        timelineLabel.textContent = 'Timeline Range';
        timelineLabel.style.cssText = 'color: #fff; font-size: 11px; font-weight: 500; opacity: 0.9;';

        const timelineSliderContainer = document.createElement('div');
        timelineSliderContainer.style.cssText = 'position: relative; height: 40px; background: rgba(0, 0, 0, 0.3); border-radius: 4px; padding: 8px;';

        const rangeTrack = document.createElement('div');
        rangeTrack.style.cssText = 'position: absolute; left: 8px; right: 8px; top: 50%; transform: translateY(-50%); height: 6px; background: rgba(255, 255, 255, 0.1); border-radius: 3px;';

        const activeRange = document.createElement('div');
        const startPercent = (path.startTime || 0) * 100;
        const endPercent = (path.endTime || 1) * 100;
        activeRange.style.cssText = `position: absolute; left: ${startPercent}%; width: ${endPercent - startPercent}%; height: 100%; background: #4ECDC4; border-radius: 3px;`;

        rangeTrack.appendChild(activeRange);

        const startHandle = this.createRangeHandle(startPercent, true);
        const endHandle = this.createRangeHandle(endPercent, false);

        timelineSliderContainer.appendChild(rangeTrack);
        timelineSliderContainer.appendChild(startHandle);
        timelineSliderContainer.appendChild(endHandle);

        // --- Custom Inputs for Timeline Range ---
        const inputsContainer = document.createElement('div');
        inputsContainer.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10px; color: #ccc; margin-top: 2px;';

        const createField = (label, value) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 3px 6px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.05);';
            const lbl = document.createElement('span');
            lbl.textContent = label;
            const inp = document.createElement('input');
            inp.type = 'number'; inp.step = '1'; inp.min = '0'; inp.max = '100';
            inp.value = Math.round(value);
            inp.style.cssText = 'width: 40px; background: #1a1a1a; border: 1px solid #444; color: #4ECDC4; text-align: center; font-size: 10px; border-radius: 2px; padding: 2px;';
            wrap.appendChild(lbl); wrap.appendChild(inp);
            return { wrap, inp };
        };

        const startField = createField('Start %', startPercent);
        const endField = createField('End %', endPercent);

        inputsContainer.appendChild(startField.wrap);
        inputsContainer.appendChild(endField.wrap);

        const inputRefs = { start: startField.inp, end: endField.inp };

        // Attach dragging interactions and bind them to the input fields
        this.setupRangeHandleDrag(startHandle, endHandle, activeRange, path, pathIndex, true, inputRefs);
        this.setupRangeHandleDrag(endHandle, startHandle, activeRange, path, pathIndex, false, inputRefs);

        // Input value constraints & path updates
        const updateFromInputs = () => {
            let sVal = parseInt(inputRefs.start.value);
            let eVal = parseInt(inputRefs.end.value);

            if (isNaN(sVal)) sVal = 0;
            if (isNaN(eVal)) eVal = 100;

            // Constrain between 0 and 100
            sVal = Math.max(0, Math.min(100, sVal));
            eVal = Math.max(0, Math.min(100, eVal));

            // Prevent overlap
            if (sVal > eVal - 1) sVal = Math.max(0, eVal - 1);
            if (eVal < sVal + 1) eVal = Math.min(100, sVal + 1);

            inputRefs.start.value = sVal;
            inputRefs.end.value = eVal;

            // Update UI visuals
            startHandle.style.left = `${sVal}%`;
            endHandle.style.left = `${eVal}%`;
            activeRange.style.left = `${sVal}%`;
            activeRange.style.width = `${eVal - sVal}%`;

            // Update actual Path data
            path.startTime = sVal / 100;
            path.endTime = eVal / 100;
            this.savePaths();
        };

        const handleInputKeyBlur = (inp) => {
            updateFromInputs();
            inp.blur();
        };

        Object.values(inputRefs).forEach(inp => {
            inp.addEventListener('change', updateFromInputs);
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleInputKeyBlur(inp);
            });
        });

        timelineSection.appendChild(timelineLabel);
        timelineSection.appendChild(timelineSliderContainer);
        timelineSection.appendChild(inputsContainer);

        // --- Custom Bezier UI Section ---
        const bezierSection = document.createElement('div');
        bezierSection.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';
        
        // Header with title and Reset button
        const bezierHeader = document.createElement('div');
        bezierHeader.style.cssText = 'display: flex; justify-content: space-between; align-items: center;';
        
        const bezierLabel = document.createElement('label');
        bezierLabel.textContent = 'Custom Easing Curve';
        bezierLabel.style.cssText = 'color: #fff; font-size: 11px; font-weight: 500; opacity: 0.9;';
        
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'Reset';
        resetBtn.style.cssText = 'background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 3px; color: #fff; font-size: 9px; padding: 2px 6px; cursor: pointer; transition: background 0.2s;';
        resetBtn.onmouseover = () => resetBtn.style.background = 'rgba(255, 255, 255, 0.2)';
        resetBtn.onmouseout = () => resetBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        resetBtn.onclick = (e) => {
            e.stopPropagation();
            path.bezier_pts =[0.0, 0.0, 0.0, 1.0, 1.0, 1.0];
            this.savePaths();
            this.updateSidebar();
        };

        bezierHeader.appendChild(bezierLabel);
        bezierHeader.appendChild(resetBtn);

        // Ensure 6-element compatibility
        if (!path.bezier_pts || path.bezier_pts.length < 6) {
            const old = path.bezier_pts ||[0.0, 0.0, 1.0, 1.0];
            path.bezier_pts =[0.0, old[0], old[1], old[2], old[3], 1.0]; 
        }
        
        const bezierCanvas = document.createElement('canvas');
        bezierCanvas.width = 210;
        bezierCanvas.height = 140;
        bezierCanvas.style.cssText = 'background: #2a2a2a; border: 1px solid #444; border-radius: 4px; cursor: crosshair; width: 100%;';
        
        // Create manual input fields Grid
        const fieldsContainer = document.createElement('div');
        fieldsContainer.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 10px; color: #ccc; margin-top: 2px;';
        
        const createBezierField = (label) => {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.3); padding: 3px 6px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.05);';
            const lbl = document.createElement('span');
            lbl.textContent = label;
            const inp = document.createElement('input');
            inp.type = 'number'; inp.step = '0.05';
            inp.style.cssText = 'width: 40px; background: #1a1a1a; border: 1px solid #444; color: #4ECDC4; text-align: center; font-size: 10px; border-radius: 2px; padding: 2px;';
            wrap.appendChild(lbl); wrap.appendChild(inp);
            return { wrap, inp };
        };

        const fStartY = createBezierField('Start Y');
        const fEndY = createBezierField('End Y');
        const fH1X = createBezierField('Start H.X');
        const fH1Y = createBezierField('Start H.Y');
        const fH2X = createBezierField('End H.X');
        const fH2Y = createBezierField('End H.Y');

        // Row 1
        fieldsContainer.appendChild(fStartY.wrap);
        fieldsContainer.appendChild(fEndY.wrap);
        // Row 2
        fieldsContainer.appendChild(fH1X.wrap);
        fieldsContainer.appendChild(fH2X.wrap);
        // Row 3
        fieldsContainer.appendChild(fH1Y.wrap);
        fieldsContainer.appendChild(fH2Y.wrap);

        bezierSection.appendChild(bezierHeader);
        bezierSection.appendChild(bezierCanvas);
        bezierSection.appendChild(fieldsContainer);

        const bezierRefs = {
            startY: fStartY.inp, h1X: fH1X.inp, h1Y: fH1Y.inp, 
            h2X: fH2X.inp, h2Y: fH2Y.inp, endY: fEndY.inp
        };

        this.setupBezierEditor(bezierCanvas, path, bezierRefs);

        const visibilitySection = document.createElement('div');
        visibilitySection.style.cssText = 'display: flex; flex-direction: column; gap: 6px;';

        const visLabel = document.createElement('label');
        visLabel.textContent = 'Visibility Mode';
        visLabel.style.cssText = 'color: #fff; font-size: 11px; font-weight: 500; opacity: 0.9;';

        const visSelect = document.createElement('select');
        visSelect.style.cssText = 'background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 4px; color: #fff; padding: 6px; font-size: 11px; cursor: pointer;';

        const visibilityModes =[
            { value: 'pop', label: 'Pop (Appear/Disappear)' },
            { value: 'static', label: 'Static (Always Visible)' }
        ];

        visibilityModes.forEach(mode => {
            const option = document.createElement('option');
            option.value = mode.value;
            option.textContent = mode.label;
            option.selected = (path.visibilityMode || 'pop') === mode.value;
            visSelect.appendChild(option);
        });

        visSelect.onchange = (e) => {
            e.stopPropagation();
            path.visibilityMode = e.target.value;
            this.savePaths();
        };

        visibilitySection.appendChild(visLabel);
        visibilitySection.appendChild(visSelect);

        container.appendChild(timelineSection);
        container.appendChild(bezierSection);
        container.appendChild(visibilitySection);

        return container;
    }

    createRangeHandle(position, isStart) {
        const handle = document.createElement('div');
        handle.style.cssText = `position: absolute; left: ${position}%; top: 50%; transform: translate(-50%, -50%); width: 16px; height: 16px; background: #4ECDC4; border: 2px solid #fff; border-radius: 50%; cursor: ${isStart ? 'e-resize' : 'w-resize'}; z-index: 10; transition: transform 0.1s ease;`;

        handle.onmouseover = () => { handle.style.transform = 'translate(-50%, -50%) scale(1.2)'; };
        handle.onmouseout = () => { handle.style.transform = 'translate(-50%, -50%) scale(1)'; };
        return handle;
    }

    setupRangeHandleDrag(handle, otherHandle, activeRange, path, pathIndex, isStart, inputRefs) {
        let isDragging = false;
        let container = null;

        const onMouseDown = (e) => {
            e.stopPropagation();
            isDragging = true;
            container = handle.parentElement;
            document.body.style.cursor = isStart ? 'e-resize' : 'w-resize';
        };

        const onMouseMove = (e) => {
            if (!isDragging || !container) return;
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
            const otherPercent = parseFloat(otherHandle.style.left);

            let constrainedPercent;
            if (isStart) constrainedPercent = Math.min(percent, otherPercent - 1);
            else constrainedPercent = Math.max(percent, otherPercent + 1);

            handle.style.left = `${constrainedPercent}%`;

            const startPercent = isStart ? constrainedPercent : parseFloat(otherHandle.style.left);
            const endPercent = isStart ? parseFloat(otherHandle.style.left) : constrainedPercent;
            activeRange.style.left = `${startPercent}%`;
            activeRange.style.width = `${endPercent - startPercent}%`;

            if (isStart) path.startTime = constrainedPercent / 100;
            else path.endTime = constrainedPercent / 100;

            if (inputRefs) {
                inputRefs.start.value = Math.round(startPercent);
                inputRefs.end.value = Math.round(endPercent);
            }
        };

        const onMouseUp = () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.cursor = '';
                this.savePaths();
            }
        };

        handle.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    setupBezierEditor(canvas, path, inputs) {
        const ctx = canvas.getContext('2d');
        const padding = 15;
        const width = canvas.width - padding * 2;
        const height = canvas.height - padding * 2;
        
        let draggingPoint = null;

        const updateInputsDOM = () => {
            inputs.startY.value = path.bezier_pts[0].toFixed(2);
            inputs.h1X.value = path.bezier_pts[1].toFixed(2);
            inputs.h1Y.value = path.bezier_pts[2].toFixed(2);
            inputs.h2X.value = path.bezier_pts[3].toFixed(2);
            inputs.h2Y.value = path.bezier_pts[4].toFixed(2);
            inputs.endY.value = path.bezier_pts[5].toFixed(2);
        };

        const updateFromInputs = () => {
            // Helper to safely parse while typing (avoids breaking if the field is temporarily empty or just a minus sign)
            const parseVal = (val, fallback) => {
                const parsed = parseFloat(val);
                return isNaN(parsed) ? fallback : parsed;
            };
            
            path.bezier_pts[0] = parseVal(inputs.startY.value, path.bezier_pts[0]);
            path.bezier_pts[1] = Math.max(0, Math.min(1, parseVal(inputs.h1X.value, path.bezier_pts[1])));
            path.bezier_pts[2] = parseVal(inputs.h1Y.value, path.bezier_pts[2]);
            path.bezier_pts[3] = Math.max(0, Math.min(1, parseVal(inputs.h2X.value, path.bezier_pts[3])));
            path.bezier_pts[4] = parseVal(inputs.h2Y.value, path.bezier_pts[4]);
            path.bezier_pts[5] = parseVal(inputs.endY.value, path.bezier_pts[5]);
            
            draw();
            this.savePaths();
        };

        const handleInputKeyBlur = () => {
            updateFromInputs();
            updateInputsDOM(); // Format display back (adds the .toFixed(2) styling)
        };

        // Attach listeners to manual input fields
        Object.values(inputs).forEach(inp => {
            inp.addEventListener('input', updateFromInputs); // Real-time curve updates
            inp.addEventListener('blur', handleInputKeyBlur); // Format field text on exit
            inp.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') inp.blur();
            });
        });

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Map coordinates mathematically
            const p0y = canvas.height - padding - path.bezier_pts[0] * height;
            const p1x = padding + path.bezier_pts[1] * width;
            const p1y = canvas.height - padding - path.bezier_pts[2] * height;
            const p2x = padding + path.bezier_pts[3] * width;
            const p2y = canvas.height - padding - path.bezier_pts[4] * height;
            const p3y = canvas.height - padding - path.bezier_pts[5] * height;

            const startX = padding;
            const endX = canvas.width - padding;

            // Draw Background Graph
            ctx.fillStyle = '#1e1e1e';
            ctx.fillRect(padding, padding, width, height);
            ctx.strokeStyle = '#444'; 
            ctx.lineWidth = 1;
            ctx.strokeRect(padding, padding, width, height);
            
            // Draw baseline / peak line representing Progress 0 and 1
            const baseY = canvas.height - padding;
            const peakY = padding;
            ctx.strokeStyle = '#333';
            ctx.beginPath();
            ctx.moveTo(0, baseY); ctx.lineTo(canvas.width, baseY);
            ctx.moveTo(0, peakY); ctx.lineTo(canvas.width, peakY);
            ctx.stroke();
            
            // Draw handle lines
            ctx.beginPath();
            ctx.moveTo(startX, p0y); ctx.lineTo(p1x, p1y);
            ctx.moveTo(endX, p3y); ctx.lineTo(p2x, p2y);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.stroke();

            // Draw actual Bezier Curve
            ctx.beginPath();
            ctx.moveTo(startX, p0y);
            ctx.bezierCurveTo(p1x, p1y, p2x, p2y, endX, p3y);
            ctx.strokeStyle = '#4ECDC4'; 
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw Control Handles
            const drawHandle = (x, y, isHovered, isEndNode=false) => {
                ctx.beginPath(); 
                ctx.arc(x, y, isEndNode ? 5 : 4, 0, Math.PI * 2);
                ctx.fillStyle = isHovered ? '#fff' : (isEndNode ? '#F7DC6F' : '#4ECDC4');
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 1;
                ctx.stroke();
            };
            
            drawHandle(startX, p0y, draggingPoint === 0, true);
            drawHandle(p1x, p1y, draggingPoint === 1);
            drawHandle(p2x, p2y, draggingPoint === 2);
            drawHandle(endX, p3y, draggingPoint === 3, true);
        };

        const getMousePos = (e) => {
            const rect = canvas.getBoundingClientRect();
            // Scale if CSS width is different from internal canvas.width
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            let x = ((e.clientX - rect.left) * scaleX - padding) / width;
            let y = (canvas.height - (e.clientY - rect.top) * scaleY - padding) / height;
            x = Math.max(0, Math.min(1, x)); 
            return { x, y, px: (e.clientX - rect.left) * scaleX, py: (e.clientY - rect.top) * scaleY };
        };

        const onMouseMove = (e) => {
            if (draggingPoint === null) return;
            const pos = getMousePos(e);

            if (draggingPoint === 0) {
                path.bezier_pts[0] = pos.y; // X remains fixed at Start
            } else if (draggingPoint === 1) {
                path.bezier_pts[1] = pos.x;
                path.bezier_pts[2] = pos.y;
            } else if (draggingPoint === 2) {
                path.bezier_pts[3] = pos.x;
                path.bezier_pts[4] = pos.y;
            } else if (draggingPoint === 3) {
                path.bezier_pts[5] = pos.y; // X remains fixed at End
            }
            draw();
        };

        const onMouseUp = () => {
            if(draggingPoint !== null) {
                draggingPoint = null;
                updateInputsDOM(); // Write visual changes back to the text fields
                this.savePaths();
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                draw();
            }
        };

        canvas.addEventListener('mousedown', (e) => {
            const pos = getMousePos(e);
            
            const p0y = canvas.height - padding - path.bezier_pts[0] * height;
            const p1x = padding + path.bezier_pts[1] * width;
            const p1y = canvas.height - padding - path.bezier_pts[2] * height;
            const p2x = padding + path.bezier_pts[3] * width;
            const p2y = canvas.height - padding - path.bezier_pts[4] * height;
            const p3y = canvas.height - padding - path.bezier_pts[5] * height;
            const startX = padding;
            const endX = canvas.width - padding;

            // Hit radius for handles (Priority given to Handles over Start/End nodes if overlapped)
            if (Math.hypot(pos.px - p1x, pos.py - p1y) < 15) {
                draggingPoint = 1;
            } else if (Math.hypot(pos.px - p2x, pos.py - p2y) < 15) {
                draggingPoint = 2;
            } else if (Math.hypot(pos.px - startX, pos.py - p0y) < 15) {
                draggingPoint = 0;
            } else if (Math.hypot(pos.px - endX, pos.py - p3y) < 15) {
                draggingPoint = 3;
            }

            if (draggingPoint !== null) {
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                draw();
            }
        });

        // Init
        updateInputsDOM();
        draw(); 
    }

    updateStats() {
        if (!this.statsContainer) return;
        const staticCount = this.paths.filter(p => p.isSinglePoint || p.points.length === 1).length;
        const motionCount = this.paths.length - staticCount;
        const imgW = this.backgroundImage ? this.backgroundImage.width : 0;
        const imgH = this.backgroundImage ? this.backgroundImage.height : 0;
        const canvasW = this.canvas ? this.canvas.width : this.frameWidth;
        const canvasH = this.canvas ? this.canvas.height : this.frameHeight;
        this.statsContainer.textContent = `Canvas: ${canvasW} x ${canvasH} | Image: ${imgW} x ${imgH} | Total: ${this.paths.length} paths (${staticCount} static, ${motionCount} motion)`;
    }

    createFooter() {
        const footer = document.createElement('div');
        footer.style.cssText = 'padding: 15px 20px; border-top: 1px solid #444; display: flex; justify-content: space-between; align-items: center; gap: 10px;';

        this.statsContainer = document.createElement('div');
        this.statsContainer.style.cssText = 'color: #888; font-size: 12px;';
        this.updateStats();

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 10px;';

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.style.cssText = 'padding: 8px 20px; background: #444; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 14px;';
        cancelBtn.onclick = () => this.close();

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Save Paths';
        saveBtn.style.cssText = 'padding: 8px 20px; background: #4ECDC4; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500;';
        saveBtn.onclick = () => {
            this.savePaths();
            this.close();
        };

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(saveBtn);

        footer.appendChild(this.statsContainer);
        footer.appendChild(buttonContainer);
        this.container.appendChild(footer);
    }
    show() {
        if (!document.getElementById('wanmove-path-animator-styles')) {
            const style = document.createElement('style');
            style.id = 'wanmove-path-animator-styles';
            style.textContent = `
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideIn { from { opacity: 0; transform: scale(0.95) translateY(-20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            `;
            document.head.appendChild(style);
        }
        document.body.appendChild(this.overlay);

        this.attachPasteListener();

        setTimeout(() => {
            this.container.focus();
        }, 100);
    }

    close() {
        this.stopAnimation();

        document.removeEventListener('keydown', this.keydownHandler);
        document.removeEventListener('keyup', this.keyupHandler);

        if (this.container) {
            this.container.removeEventListener('paste', this.pasteHandler);
        }
        document.removeEventListener('paste', this.pasteHandler);

        this.overlay.style.animation = 'fadeIn 0.15s ease-in reverse';
        this.container.style.animation = 'slideIn 0.15s ease-in reverse';
        setTimeout(() => {
            if (this.overlay.parentNode) {
                document.body.removeChild(this.overlay);
            }
        }, 150);
    }
}