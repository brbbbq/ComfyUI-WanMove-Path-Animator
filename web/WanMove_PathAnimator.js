/**
 * File: WanMove_PathAnimator.js
 * Project: ComfyUI-WanMove-Path-Animator
 * Main Extension Registration for ComfyUI
 */

import { app } from "../../../../../scripts/app.js";
import { ComfyUtils, CONFIG } from "./Data.js";
import { PathEditorModal } from "./DOM.js";

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

            // Hide the paths_data text widget completely from the UI layout
            pathsDataWidget.type = "hidden";
            pathsDataWidget.hidden = true;
            pathsDataWidget.computeSize = () => [0, -4]; 
            if (pathsDataWidget.inputEl) {
                pathsDataWidget.inputEl.style.display = "none";
            }

            node.addWidget("button", "Edit Paths", null, () => openPathEditor(node, pathsDataWidget));

            // Setup the pathCountText property instead of a widget
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

            // Expand the node slightly to make room for the text at the bottom
            const onComputeSize = node.computeSize;
            node.computeSize = function(out) {
                let size = onComputeSize ? onComputeSize.apply(this, arguments) : [200, 100];
                size[1] += 24; // Add 24px padding at the bottom
                return size;
            };

            // Draw the status text at the bottom of the node background
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

            // Shrink node to minimum size shortly after creation
            setTimeout(() => {
                node.size = node.computeSize([0, 0]);
                app.graph.setDirtyCanvas(true, true);
            }, 10);
        }
    }
});