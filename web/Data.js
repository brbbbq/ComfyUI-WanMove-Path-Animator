/**
 * File: Data.js
 * Project: ComfyUI-WanMove-Path-Animator
 * Data layer, configuration, math, and ComfyUI integration utils.
 */

import { app } from "../../../../../scripts/app.js";
import { api } from "../../../../../scripts/api.js";

app.registerExtension({
    name: "WanMove.PathAnimator.HiddenPreview",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "WanMove_PathAnimator") {
            const onExecuted = nodeType.prototype.onExecuted;
            nodeType.prototype.onExecuted = function(message) {
                if (onExecuted) onExecuted.apply(this, arguments);
                if (message?.wanmove_preview?.length > 0) {
                    const val = message.wanmove_preview[0];
                    this.wanmove_bg_url = api.apiURL(`/view?${new URLSearchParams(val).toString()}`);
                }
            };
        }
    }
});

export const CONFIG = {
    DEFAULT_SIZE: 512,
    DEFAULT_BEZIER: [0.0, 0.0, 0.0, 1.0, 1.0, 1.0],
    COLORS: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'],
    UI: {
        PATH_THICKNESS: 3,
        BG_OPACITY: 1.0,
        BEZIER_PAD: 15,
        HIT_THRESH_BASE: 10,
        BEZIER_CANVAS_W: 210,
        BEZIER_CANVAS_H: 140
    }
};

export const MathUtils = {
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

export const PathFactory = {
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

export const ComfyUtils = {
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
        
        if (node.wanmove_bg_url) return node.wanmove_bg_url;

        if (node.imgs?.length > 0) {
            const img = node.imgs[0];
            if (typeof img === "string") return img;
            if (img && typeof img === "object" && img.src) return img.src;
        }
        
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