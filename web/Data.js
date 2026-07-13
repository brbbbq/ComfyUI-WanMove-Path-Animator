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

const traceLinkBackwards = (curr, currName, input) => {
    if (!input || input.link == null) return null;
    const graph = curr.graph || app.graph;
    if (!graph || !graph.links) return null;
    
    const link = graph.links[input.link];
    if (!link) return null;
    
    let parentNode = graph.getNodeById(link.origin_id);
    let nextName = currName;
    
    // ComfyUI Subgraph/GroupNode Proxy Fallback (Virtual IDs like -10)
    if (!parentNode && link.origin_id < 0) {
        // Case A: LiteGraph separate inner graph
        if (graph !== app.graph && app.graph) {
            parentNode = graph._subgraph_node || graph.parent_node;
            if (!parentNode) {
                for (const n of app.graph._nodes) {
                    if (n.subgraph === graph) { parentNode = n; break; }
                }
            }
        }
        // Case B: ComfyUI native GroupNode (same graph)
        if (!parentNode) {
            const searchGraph = app.graph || graph;
            for (const n of searchGraph._nodes) {
                if (typeof n.getInnerNodes === 'function' || n.innerNodes) {
                    try {
                        const inners = typeof n.getInnerNodes === 'function' ? n.getInnerNodes() : n.innerNodes;
                        let found = false;
                        if (Array.isArray(inners)) found = inners.some(i => i && i.id === curr.id);
                        else if (inners) {
                            for (const i of inners) if (i && i.id === curr.id) found = true;
                        }
                        if (found) { parentNode = n; break; }
                    } catch(e) {}
                }
            }
        }
        // If boundary crossed via virtual link (-10), origin_slot maps to PARENT's input!
        if (parentNode && parentNode.inputs) {
            const targetInput = parentNode.inputs[link.origin_slot];
            if (targetInput) {
                return { node: parentNode, slotName: targetInput.name };
            }
        }
    }
    
    if (parentNode) {
        nextName = (parentNode.outputs && parentNode.outputs[link.origin_slot]) ? parentNode.outputs[link.origin_slot].name : currName;
        return { node: parentNode, slotName: nextName };
    }
    
    return null;
};

export const ComfyUtils = {
    moveWidgetToTop(node, widget) {
        if (!widget) return;
        const idx = node.widgets.indexOf(widget);
        if (idx > 0) { node.widgets.splice(idx, 1); node.widgets.unshift(widget); }
    },
    
    getWidgetOrInputValue(node, name, defaultValue) {
        let curr = node;
        let currName = name;
        const visited = new Set();
        
        try {
            for (let i = 0; i < 20; i++) { 
                if (!curr || visited.has(curr.id)) break;
                visited.add(curr.id);
                
                const cType = (curr.comfyClass || curr.type || "").toLowerCase();
                
                // 1. Follow normal inputs backwards
                if (curr.inputs) {
                    let input = curr.inputs.find(inp => inp.name === currName);
                    // Reroute / Wildcard fallback
                    if (!input && (cType === "reroute" || (curr.inputs.length === 1 && curr.inputs[0].type === "*"))) {
                        input = curr.inputs[0];
                    }
                    
                    const trace = traceLinkBackwards(curr, currName, input);
                    if (trace) {
                        curr = trace.node;
                        currName = trace.slotName;
                        continue;
                    }
                }

                // 2. Trace OUT of explicit Subgraph/Group Input Nodes
                if (cType === "subgraphinput" || cType === "graphinput" || cType === "nodegroupinput" || cType === "graph/inputs" || cType === "graph/input") {
                    let parentGraphNode = curr.graph?._subgraph_node || curr.graph?.parent_node;
                    if (!parentGraphNode && curr.graph !== app.graph && app.graph) {
                        for (const n of app.graph._nodes) if (n.subgraph === curr.graph) { parentGraphNode = n; break; }
                    }
                    if (parentGraphNode) {
                        const fb = [currName, curr.title, curr.properties?.name].find(n => parentGraphNode.inputs?.some(i => i.name === n));
                        if (fb) currName = fb;
                        curr = parentGraphNode;
                        continue;
                    }
                }

                // 3. Trace Anything Everywhere / Set / Get nodes
                if (cType.includes("getnode") || cType.includes("anything anywhere getter")) {
                    const w = curr.widgets?.[0] || curr.widgets?.find(w => w.name === "constant" || w.name === "Value");
                    if (w && w.value) {
                        let setNode = null;
                        if (curr.graph && curr.graph._nodes) setNode = curr.graph._nodes.find(n => (n.comfyClass || n.type || "").toLowerCase().includes("setnode") && n.widgets?.[0]?.value === w.value);
                        if (!setNode && app.graph && app.graph._nodes) setNode = app.graph._nodes.find(n => (n.comfyClass || n.type || "").toLowerCase().includes("setnode") && n.widgets?.[0]?.value === w.value);
                        if (setNode) { 
                            curr = setNode; 
                            currName = setNode.inputs?.[0]?.name || "value"; 
                            continue; 
                        }
                    }
                }

                // 4. Resolve the widget value on Primitives or Math nodes
                const widget = curr.widgets?.find(w => w.name === currName || w.name === "value" || w.name === "constant" || w.name === "integer") || curr.widgets?.[0];
                if (widget && widget.value !== undefined) {
                    return widget.value;
                }
                
                break;
            }
        } catch (err) {
            console.warn("WanMove_PathAnimator: Error tracing node inputs.", err);
        }

        // 5. Ultimate safe fallback
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
        
        let curr = node;
        let currSlotName = inputName;
        
        try {
            const initialTrace = traceLinkBackwards(curr, currSlotName, imgInput);
            if (!initialTrace) return null;
            
            curr = initialTrace.node;
            currSlotName = initialTrace.slotName;
            const visited = new Set();
            
            while (curr && !visited.has(curr.id)) {
                visited.add(curr.id);
                
                if (curr.imgs?.length > 0) return curr.imgs[0].src;
                
                if (curr.outputs) {
                    for (const out of curr.outputs) {
                        if (out.type === "IMAGE" && out.links) {
                            for (const lid of out.links) {
                                const outGraph = curr.graph || app.graph;
                                const outLink = outGraph.links?.[lid];
                                if (outLink) {
                                    const child = outGraph.getNodeById(outLink.target_id);
                                    if (child?.imgs?.length > 0) return child.imgs[0].src;
                                }
                            }
                        }
                    }
                }
                
                const cType = (curr.comfyClass || curr.type || "").toLowerCase();
                
                if (cType === "subgraphinput" || cType === "graphinput" || cType === "nodegroupinput" || cType === "graph/inputs" || cType === "graph/input") {
                    let parentGraphNode = curr.graph?._subgraph_node || curr.graph?.parent_node;
                    if (!parentGraphNode && curr.graph !== app.graph && app.graph) {
                        for (const n of app.graph._nodes) if (n.subgraph === curr.graph) { parentGraphNode = n; break; }
                    }
                    if (parentGraphNode) {
                        const fb = [currSlotName, curr.title, curr.properties?.name].find(n => parentGraphNode.inputs?.some(i => i.name === n));
                        if (fb) currSlotName = fb;
                        curr = parentGraphNode;
                        continue;
                    }
                }

                const iW = curr.widgets?.find(w => w.name === "image");
                if (iW?.value) {
                    const val = typeof iW.value === "object" ? iW.value : { filename: iW.value, type: "input", subfolder: "" };
                    if (val.filename) return api.apiURL(`/view?${new URLSearchParams(val).toString()}`);
                }
                
                let foundNext = false;
                if (curr.inputs) {
                    let nextInput = curr.inputs.find(i => i.name === currSlotName && i.link);
                    if (!nextInput) nextInput = curr.inputs.find(i => i.type === "IMAGE" && i.link);
                    if (!nextInput && (cType === "reroute" || (curr.inputs.length === 1 && curr.inputs[0].type === "*"))) {
                        nextInput = curr.inputs[0];
                    }
                    
                    const trace = traceLinkBackwards(curr, currSlotName, nextInput);
                    if (trace) {
                        curr = trace.node;
                        currSlotName = trace.slotName;
                        foundNext = true;
                    }
                }
                
                if (!foundNext) break;
            }
        } catch (err) {
            console.warn("WanMove_PathAnimator: Error tracing connected image.", err);
        }
        return null;
    },
    
    resolveImageSizeFromLink(node, name) {
        let curr = node;
        let currName = name;
        const visited = new Set();
        
        try {
            for (let i = 0; i < 20; i++) {
                if (!curr || visited.has(curr.id)) break;
                visited.add(curr.id);

                const cType = (curr.comfyClass || curr.type || "").toLowerCase();
                
                let foundLink = false;
                if (curr.inputs) {
                    let input = curr.inputs.find(inp => inp.name === currName);
                    if (!input && (cType === "reroute" || (curr.inputs.length === 1 && curr.inputs[0].type === "*"))) {
                        input = curr.inputs[0];
                    }
                    
                    const trace = traceLinkBackwards(curr, currName, input);
                    if (trace) {
                        curr = trace.node;
                        currName = trace.slotName;
                        foundLink = true;
                        continue;
                    }
                }

                if (cType === "subgraphinput" || cType === "graphinput" || cType === "nodegroupinput" || cType === "graph/inputs" || cType === "graph/input") {
                    let parentGraphNode = curr.graph?._subgraph_node || curr.graph?.parent_node;
                    if (!parentGraphNode && curr.graph !== app.graph && app.graph) {
                        for (const n of app.graph._nodes) if (n.subgraph === curr.graph) { parentGraphNode = n; break; }
                    }
                    if (parentGraphNode) {
                        const fb = [currName, curr.title, curr.properties?.name].find(n => parentGraphNode.inputs?.some(i => i.name === n));
                        if (fb) currName = fb;
                        curr = parentGraphNode;
                        continue;
                    }
                }

                if (cType.includes("getimagesize") || cType.includes("imagesize") || cType.includes("get image size")) {
                    return this.getConnectedImageUrl(curr, "image");
                }
                
                if (!foundLink) break;
            }
        } catch (err) {
            console.warn("WanMove_PathAnimator: Error resolving image size from link.", err);
        }
        return null;
    }
};