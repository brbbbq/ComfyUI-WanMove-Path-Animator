/**
 * File: Canvas.js
 * Project: ComfyUI-WanMove-Path-Animator
 * Renders the canvas and handles local mouse logic to generate paths.
 */

import { MathUtils, PathFactory, CONFIG } from "./Data.js";

export class PathCanvas {
    constructor(editor) {
        this.editor = editor; // Reference to the orchestrator (PathEditorModal)
        
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'wm-canvas';
        this.canvas.style.cursor = 'crosshair';
        this.ctx = this.canvas.getContext('2d');
        
        this.setupCanvasEvents();
    }

    setupCanvasEvents() {
        this.canvas.onmousedown = e => this.onMouseDown(e);
        this.canvas.onmousemove = e => this.onMouseMove(e);
        this.canvas.onmouseup = e => this.onMouseUp(e);
        this.canvas.onmouseleave = e => this.onMouseUp(e);
    }

    getCanvasCoords(e) {
        const r = this.canvas.getBoundingClientRect();
        return { 
            x: ((e.clientX - r.left) * (this.canvas.width / r.width)) / this.getScaleX(), 
            y: ((e.clientY - r.top) * (this.canvas.height / r.height)) / this.getScaleY() 
        };
    }

    onMouseDown(e) {
        const pos = this.getCanvasCoords(e);
        
        if (this.editor.tool === 'pencil') {
            this.editor.isDrawing = true;
            this.editor.currentPath = PathFactory.createMotionPath([pos], this.editor.currentColor, this.editor.paths.length + 1);
        } else if (this.editor.tool === 'point') {
            const staticCount = this.editor.paths.filter(p => p.isSinglePoint).length + 1;
            this.editor.paths.push(PathFactory.createStaticPath([pos], this.editor.currentColor, staticCount));
            this.editor.selectedPathIndex = this.editor.paths.length - 1;
            this.editor.currentColor = MathUtils.getRandomColor();
            this.editor.updateSidebar(); 
            this.render();
        } else if (this.editor.tool === 'select') {
            this.editor.selectedPathIndex = this.findPathAtPoint(pos);
            this.editor.updateSidebar(); 
            this.render();
        }
    }

    onMouseMove(e) {
        if (!this.editor.isDrawing || this.editor.tool !== 'pencil') return;

        const pos = this.getCanvasCoords(e), sx = this.getScaleX(), sy = this.getScaleY();
        const pts = this.editor.currentPath.points;

        if (this.editor.shiftPressed && pts.length > 0) {
            const lp = pts[pts.length - 1];
            const vx = pos.x * sx, vy = pos.y * sy, lvx = lp.x * sx, lvy = lp.y * sy;
            const vdx = Math.abs(vx - lvx), vdy = Math.abs(vy - lvy);
            
            let cVx, cVy;
            if (vdx > vdy * 2) { cVx = vx; cVy = lvy; }
            else if (vdy > vdx * 2) { cVx = lvx; cVy = vy; }
            else { const d = Math.min(vdx, vdy); cVx = lvx + (vx > lvx ? d : -d); cVy = lvy + (vy > lvy ? d : -d); }

            const cPos = { x: cVx / sx, y: cVy / sy };
            if (!this.editor.shiftPreviewPoint) { this.editor.shiftPreviewPoint = true; pts.push(cPos); } 
            else pts[pts.length - 1] = cPos;
            
            this.render();
            return;
        } 

        this.editor.shiftPreviewPoint = false;
        const lp = pts[pts.length - 1];
        if (Math.hypot((pos.x - lp.x) * sx, (pos.y - lp.y) * sy) > 3 * this.getRenderScale()) {
            pts.push(pos);
            this.render();
        }
    }

    onMouseUp(e) {
        if (!this.editor.isDrawing || !this.editor.currentPath) return;

        this.editor.shiftPreviewPoint = false;
        if (this.editor.currentPath.points.length > 1) {
            this.editor.paths.push(this.editor.currentPath);
        } else if (this.editor.currentPath.points.length === 1) {
            this.editor.currentPath.isSinglePoint = true;
            this.editor.currentPath.name = 'Static ' + (this.editor.paths.filter(p => p.isSinglePoint).length + 1);
            this.editor.paths.push(this.editor.currentPath);
        }

        this.editor.selectedPathIndex = this.editor.paths.length - 1;
        this.editor.currentColor = MathUtils.getRandomColor();
        this.editor.updateSidebar();
        
        this.editor.currentPath = null;
        this.editor.isDrawing = false;
        this.render();
    }

    findPathAtPoint(pt, baseThresh = CONFIG.UI.HIT_THRESH_BASE) {
        const thresh = baseThresh * this.getRenderScale(), sx = this.getScaleX(), sy = this.getScaleY();
        const vPt = { x: pt.x * sx, y: pt.y * sy };

        for (let i = this.editor.paths.length - 1; i >= 0; i--) {
            const p = this.editor.paths[i];
            if ((p.isSinglePoint || p.points.length === 1) && Math.hypot(vPt.x - p.points[0].x * sx, vPt.y - p.points[0].y * sy) < thresh) {
                return i;
            }
        }
        
        for (let i = this.editor.paths.length - 1; i >= 0; i--) {
            const p = this.editor.paths[i];
            if (p.isSinglePoint || p.points.length <= 1) continue;
            
            for (let j = 0; j < p.points.length - 1; j++) {
                if (MathUtils.distanceToSegment(vPt, { x: p.points[j].x * sx, y: p.points[j].y * sy }, { x: p.points[j+1].x * sx, y: p.points[j+1].y * sy }) < thresh) {
                    return i;
                }
            }
        }
        return -1;
    }

    getRenderScale() { return Math.min(this.canvas.width, this.canvas.height) / 512; }
    getScaleX() { return this.canvas.width / this.editor.baseCanvasWidth; }
    getScaleY() { return this.canvas.height / this.editor.baseCanvasHeight; }

    render() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = 'rgb(30, 30, 30)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.editor.backgroundImage?.complete) {
            this.ctx.save();
            this.ctx.globalAlpha = this.editor.backgroundOpacity;
            this.ctx.drawImage(this.editor.backgroundImage, 0, 0); 
            this.ctx.restore();
        }

        this.editor.updateStats();
        this.editor.paths.forEach((path, i) => this.drawPath(path, i === this.editor.selectedPathIndex));
        if (this.editor.currentPath) this.drawPath(this.editor.currentPath, true);
    }

    drawPath(path, isSelected = false) {
        const isSingle = path.isSinglePoint || path.points.length === 1;
        const scale = this.getRenderScale(), sx = this.getScaleX(), sy = this.getScaleY();
        const totalT = 1 + (path.qty || 0), spreadB = (path.spread !== undefined ? path.spread : 1.50) * 0.01 * (this.editor.baseCanvasWidth + this.editor.baseCanvasHeight) / 2;

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
        const pts = path.points, tans = [];
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
            this.ctx.lineWidth = (isSelected && isCtr ? this.editor.pathThickness + 0.1 : this.editor.pathThickness) * scale;
            if (!isCtr) this.ctx.lineWidth = Math.max(1, this.editor.pathThickness * 0.5) * scale;
            this.ctx.lineCap = 'round'; this.ctx.lineJoin = 'round'; this.ctx.stroke();

            this.ctx.save();
            this.ctx.beginPath();
            for (let i = 0; i < pts.length; i++) {
                const px = (pts[i].x + tans[i].px * off) * sx, py = (pts[i].y + tans[i].py * off) * sy;
                i === 0 ? this.ctx.moveTo(px, py) : this.ctx.lineTo(px, py);
            }
            this.ctx.setLineDash([10 * scale, 10 * scale]);
            this.ctx.lineDashOffset = -this.editor.animationOffset * scale;
            this.ctx.strokeStyle = (isSelected && isCtr) ? 'rgba(0, 255, 65, 0.8)' : 'rgba(255, 255, 255, 0.4)';
            this.ctx.lineWidth = Math.max(1, this.editor.pathThickness * 0.5) * scale;
            this.ctx.stroke(); this.ctx.restore();
        }

        if (isSelected) {
            pts.forEach((pt, idx) => {
                const px = pt.x * sx, py = pt.y * sy;
                this.ctx.beginPath(); this.ctx.arc(px, py, Math.max(6, this.editor.pathThickness + 2) * scale, 0, Math.PI * 2);
                this.ctx.fillStyle = '#00FF41'; this.ctx.fill();
                this.ctx.beginPath(); this.ctx.arc(px, py, Math.max(3, this.editor.pathThickness * 0.6) * scale, 0, Math.PI * 2);
                this.ctx.fillStyle = '#000'; this.ctx.fill();
                if (pts.length < 20) { this.ctx.fillStyle = '#00FF41'; this.ctx.font = `bold ${10 * scale}px sans-serif`; this.ctx.fillText(idx, px + 8*scale, py - 8*scale); }
            });

            const mp = pts[Math.floor(pts.length / 2)];
            this.ctx.fillStyle = '#00FF41'; this.ctx.font = `bold ${12 * scale}px sans-serif`;
            this.ctx.fillText(`Motion (${pts.length} pts)${path.qty > 0 ? ' + '+path.qty+' Spread' : ''}`, mp.x * sx + 10*scale, mp.y * sy - 10*scale);
        }
    }
}