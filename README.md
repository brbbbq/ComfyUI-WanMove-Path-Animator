# WanMove Path Animator
A ComfyUI custom node for creating motion tracks to be used with [Wan-Move](https://github.com/ali-vilab/Wan-Move) based on [FL Path Animator](https://github.com/filliptm/ComfyUI_FL-Path-Animator).
1) [Features](https://github.com/brbbbq/ComfyUI-WanMove-Path-Animator#1-features)
2) [Installation](https://github.com/brbbbq/ComfyUI-WanMove-Path-Animator#2-installation)
3) [Usage](https://github.com/brbbbq/ComfyUI-WanMove-Path-Animator#3-usage)
4) [Path Animator Editor](https://github.com/brbbbq/ComfyUI-WanMove-Path-Animator#4-pathh-animator-editor)
5) [Examples](https://github.com/brbbbq/ComfyUI-WanMove-Path-Animator#5-examples)
6) [License](https://github.com/brbbbq/ComfyUI-WanMove-Path-Animator#6-license)

![wanMove_path_animator_header.webp](assets/wanMove_path_animator_header.webp)


## 1) Features
- **Interactive Path Editor** - Visual modal interface for drawing motion paths and static anchor points
- **Two Path Types**:
    - **Motion Paths** - Draw continuous paths for shapes to follow over time
    - **Static Anchors** - Single-point paths for stationary shapes
- **Background Image Support** - Input, load, or paste reference images to draw paths on
- **Timeline Start & End** - Set when the animation begins and finishes
- **Animation Curves** - Control the speed and direction of the animation
- **Path Spread** - Duplicate paths to widen their effects
- **Visibility** - Modes for 

## 2) Installation
1. Clone or download this repository into your ComfyUI custom_nodes folder:
<code>
cd ComfyUI/custom_nodes/
git clone https://github.com/brbbbq/ComfyUI-WanMove-Path-Animator
</code>

2. Restart ComfyUI

<br>

## 3) Usage
### Basic Workflow:
1. Add the **"WanMove Path Animator"** node to your workflow
2. Connect image to image input to appear in background.
3. Click the **"Edit Paths"** button to open the path editor
4. Optionally load a background image with **🖼️** or paste with **Ctrl+V** (only if there's no image input)
5. Use the [toolbar](https://github.com/brbbbq/ComfyUI-WanMove-Path-Animator#toolbar) to:
    - **✏️ Pencil** - Draw motion paths (hold SHIFT for straight lines)
    - **📍 Point** - Add static anchor points
    - **🔒 Lock Perimeter** - Auto-generate static points around border
6. Use [sidebar](https://github.com/brbbbq/ComfyUI-WanMove-Path-Animator#sidebar) to:
    - **🕗 Timeline Range** - Control the Start and End point of the animation
    - **📈 Custom Easing Curve** - Control the dynamic speed of the animation
    - **🧈 Spread** - Create parallel paths
    - **👁️ Visibility Mode** - Set track visibilty properties
8. Press **ESC**, or click **Save Paths** to save and close
9. Connect outputs to your workflow

![wanMove_path_animator_node.webp](assets/wanMove_path_animator_node.webp)

### Node Parameters:
- `frame_width` & `frame_height` - Frame dimensions that the output coordinates will be resized to (project dimensions)
- `frame_count` - Number of frames that the motion path will be resampled to (should be equal to the project length)

### Outputs:
1. **TRACKS** - Motion paths formated for native [**"WanMoveTrackToVideo"**](https://docs.comfy.org/built-in-nodes/WanMoveTrackToVideo) nodes (includes visability info)
2. **COORDINATES** - Raw coordinate data for use with [**"comfyui_cotracker_node"**](https://github.com/s9roll7/comfyui_cotracker_node) pack (no visibility info)
   - **PerlinCoordinateRandomizerNode**
   - **XYMotionAmplifierNode**
4. **DEBUG** - Raw path data from the Path Animator Editor (JavaScript) before being resampled by the node (Python)  

## 4) Path Animation Editor
![wanMove_path_animator_editor.webp](assets/wanMove_path_animator_editor.webp)
### Keyboard Shortcuts:
- **ESC** - Save paths and close editor
- **SHIFT (hold)** - Draw straight lines (can be pressed intermittently)
- **Ctrl+V** - Paste background image from clipboard

### Toolbar:
**✏️ Pencil Tool** - Draw motion paths by clicking and dragging
- Hold **SHIFT** to constrain to straight lines
- Can be pressed intermittently so you can go from hand drawn to straight lines along a single path.

**📍 Point Tool** - Create a single anchor point 
- Useful when you don't want an element to move in the video
- You can also use the **Pencil Tool** to create static points by clicking on the canvas once
- Compatible with Spread and Visibiliity options

**↖️ Select Tool** - Directly select paths in the canvas to open their parameters in the sidebar

**🔒 Lock Perimeter** - Evenly distributes static anchor points around the edge of the canvas
- Useful for generating a static camera shot by fixing the edges of the frames in place

**🗑️ Clear All** - Deletes all tracks

### Sidebar:
**🕗 Timeline Range** - Sets the **Start** & **End** points of the animation
- Calculated as a percentage of the `frame_count`
- Use the visual slider or set exact values in the numerical fields

**📈 Custom Easing Curve** - Basic animation curve to control the rate and direction of the movement
- Y-Axis (vertical) **Position** - Defines the **Position** of the point along the path
- X-Axis (horizontal) **Timeline** - Corresponds with when along the **Timeline** the point should be at what **Position** along the path
- `Start Y` & `End Y` - Defines the **Position** along the **Path** you want the animation to **Start** & **End**
- `Start H.X` & `Start H.Y` - Sets the coordinates for the Bezier **Handles** that define the curve from the **Start** point
- `End H.X` & `End H.Y` - Sets the coordinates for the Bezier **Handles** that define the curve from the **End** point

**🧈 Spread** - Creates duplicate parallel tracks
- Quantities are in units of 2 as pairs are added outward from the center
- The spread distance is scaled proportional to the size of the canvas

**👁️ Visibility Mode** - Sets whether path visbility is defined by timeline or always persistent
- **Pop Mode** - Path/Point will only be visible for the duration of the **Timeline**
- **Static Mode** - Path/Point will remain visible through the whole video
- Useful for creating continuous movement over the same area of the frame, or stringing together complex movements

## 5) Examples
### Linear
![wanMove_path_animator_example-01-linear.webp](assets/wanMove_path_animator_example-01-linear.webp)

### Reverse
![wanMove_path_animator_example-02-reverse.webp](assets/wanMove_path_animator_example-02-reverse.webp)

### Ease In
![wanMove_path_animator_example-03-easeIn.webp](assets/wanMove_path_animator_example-03-easeIn.webp)

### Ease Out
![wanMove_path_animator_example-04-easeOut.webp](assets/wanMove_path_animator_example-04-easeOut.webp)

### Ease In-Out
![wanMove_path_animator_example-05-easeInOut.webp](assets/wanMove_path_animator_example-05-easeInOut.webp)

### Ease Out-In
![wanMove_path_animator_example-06-easeOutIn.webp](assets/wanMove_path_animator_example-06-easeOutIn.webp)

### Ping-Pong
![wanMove_path_animator_example-07-pingPong.webp](assets/wanMove_path_animator_example-07-pingPong.webp)

### Spread
![wanMove_path_animator_example-12-spread.webp](assets/wanMove_path_animator_example-12-spread.webp)

### Visibility Mode Pop
![wanMove_path_animator_example-08-visPop.webp](assets/wanMove_path_animator_example-08-visPop.webp)

### Visibility Mode Static
![wanMove_path_animator_example-09-visStatic.webp](assets/wanMove_path_animator_example-09-visStatic.webp)

### Timeline
![wanMove_path_animator_example-10-timeline.webp](assets/wanMove_path_animator_example-10-timeline.webp)

### Perimeter Lock
![wanMove_path_animator_example-11-perimeter.webp](assets/wanMove_path_animator_example-11-perimeter.webp)


## 6) License
MIT License - See LICENSE file for details
