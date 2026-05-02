import math
import json
import torch

# ==========================================
# 1. CONFIGURATION & CONSTANTS
# ==========================================
class Config:
    DEFAULT_WIDTH = 512
    DEFAULT_HEIGHT = 512
    DEFAULT_BEZIER =[0.0, 0.0, 0.0, 1.0, 1.0, 1.0]
    BEZIER_ITERATIONS = 20
    DEFAULT_SPREAD = 1.50

# ==========================================
# 2. UTILITY CLASSES (SoC)
# ==========================================
class BezierUtils:
    @staticmethod
    def parse_bezier_points(bezier_points):
        """Handle fallback structure for older node versions."""
        if not bezier_points:
            return Config.DEFAULT_BEZIER
        if len(bezier_points) == 4:
            x1, y1, x2, y2 = bezier_points
            return [0.0, x1, y1, x2, y2, 1.0]
        if len(bezier_points) == 6:
            return bezier_points
        return Config.DEFAULT_BEZIER

    @staticmethod
    def solve_x(x_target, x1, x2):
        """Binary search to find the parametric 't' for a given X (Time)."""
        if x_target <= 0.0: return 0.0
        if x_target >= 1.0: return 1.0
        
        t_min, t_max = 0.0, 1.0
        for _ in range(Config.BEZIER_ITERATIONS):
            t = (t_min + t_max) / 2.0
            x = 3 * (1 - t)**2 * t * x1 + 3 * (1 - t) * t**2 * x2 + t**3
            if x < x_target:
                t_min = t
            else:
                t_max = t
        return (t_min + t_max) / 2.0

    @staticmethod
    def get_y(t, y0, y1, y2, y3):
        """Calculate Y (Progress) given the parametric 't' and Y values."""
        return (1 - t)**3 * y0 + 3 * (1 - t)**2 * t * y1 + 3 * (1 - t) * t**2 * y2 + t**3 * y3


class GeometryUtils:
    @staticmethod
    def get_segment_length(p1, p2):
        dx = p2['x'] - p1['x']
        dy = p2['y'] - p1['y']
        return math.sqrt(dx * dx + dy * dy)

    @staticmethod
    def calculate_tangents(points):
        tangents =[]
        num_pts = len(points)
        for i in range(num_pts):
            if num_pts > 1:
                if i < num_pts - 1:
                    tx = points[i+1]['x'] - points[i]['x']
                    ty = points[i+1]['y'] - points[i]['y']
                else:
                    tx = points[i]['x'] - points[i-1]['x']
                    ty = points[i]['y'] - points[i-1]['y']
            else:
                tx, ty = 0.0, 0.0
            
            length = math.sqrt(tx**2 + ty**2)
            if length > 0:
                tangents.append((-ty / length, tx / length))
            else:
                tangents.append((1.0, 0.0))
        return tangents

    @staticmethod
    def resample_path_uniform(points, num_samples=121, bezier_points=None):
        """Resample path to exactly num_samples points with custom easing."""
        if not points:
            return[]

        y0, x1, y1, x2, y2, y3 = BezierUtils.parse_bezier_points(bezier_points)

        # Early return for single points
        if len(points) == 1:
            return [{'x': points[0]['x'], 'y': points[0]['y']} for _ in range(num_samples)]

        cumulative_lengths =[0.0]
        for i in range(len(points) - 1):
            cumulative_lengths.append(cumulative_lengths[-1] + GeometryUtils.get_segment_length(points[i], points[i+1]))

        total_length = cumulative_lengths[-1]
        if total_length == 0:
            return [{'x': points[0]['x'], 'y': points[0]['y']} for _ in range(num_samples)]

        resampled =[]
        for i in range(num_samples):
            linear_time = 0 if num_samples == 1 else i / (num_samples - 1)
            t_param = BezierUtils.solve_x(linear_time, x1, x2)
            eased_progress = BezierUtils.get_y(t_param, y0, y1, y2, y3)
            
            target_length = eased_progress * total_length

            # Determine segment index 
            j = 0
            if target_length >= total_length:
                j = len(cumulative_lengths) - 2
            elif target_length > 0:
                for k in range(len(cumulative_lengths) - 1):
                    if cumulative_lengths[k] <= target_length <= cumulative_lengths[k + 1]:
                        j = k
                        break

            # Interpolate
            seg_length = cumulative_lengths[j + 1] - cumulative_lengths[j]
            t = (target_length - cumulative_lengths[j]) / seg_length if seg_length > 0 else 0

            x = points[j]['x'] + t * (points[j + 1]['x'] - points[j]['x'])
            y = points[j]['y'] + t * (points[j + 1]['y'] - points[j]['y'])
            resampled.append({'x': x, 'y': y})

        return resampled

# ==========================================
# 3. FACTORY PATTERN
# ==========================================
class PathStateFactory:
    @staticmethod
    def parse_path_data(paths_data_str, frame_width, frame_height):
        try:
            data = json.loads(paths_data_str)
            paths = data.get('paths',[])
            canvas_size = data.get('canvas_size', {'width': frame_width, 'height': frame_height})
        except json.JSONDecodeError:
            print("WanMove_PathAnimator: Invalid JSON, using empty paths")
            paths =[]
            canvas_size = {'width': frame_width, 'height': frame_height}
        return paths, canvas_size

# ==========================================
# 4. MAIN NODE CLASS
# ==========================================
class WanMove_PathAnimator:

    RETURN_TYPES = ("TRACKS", "STRING")
    RETURN_NAMES = ("tracks", "coordinates")
    FUNCTION = "animate_paths"
    CATEGORY = "WanMove Path Animator"
    DESCRIPTION = """
Creates animated points that follow user-drawn paths.
Open the path editor to draw trajectories on a reference image, then points will follow these paths over time.
Includes custom Bezier easing support and timeline visibility controls.
"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "frame_width": ("INT", {"default": Config.DEFAULT_WIDTH, "min": 64, "max": 4096, "step": 1}),
                "frame_height": ("INT", {"default": Config.DEFAULT_HEIGHT, "min": 64, "max": 4096, "step": 1}),
                "frame_count": ("INT", {"default": 30, "min": 1, "max": 500, "step": 1}),
            },
            "optional": {
                "image": ("IMAGE",),
                "paths_data": ("STRING", {"default": '{"paths":[], "canvas_size": {"width": 512, "height": 512}}', "multiline": True}),
            }
        }

    def animate_paths(self, frame_width, frame_height, frame_count, paths_data='{"paths":[], "canvas_size": {"width": 512, "height": 512}}', image=None):
        
        paths, canvas_size = PathStateFactory.parse_path_data(paths_data, frame_width, frame_height)

        canvas_width = canvas_size.get('width', frame_width)
        canvas_height = canvas_size.get('height', frame_height)
        scale_x = frame_width / canvas_width if canvas_width > 0 else 1.0
        scale_y = frame_height / canvas_height if canvas_height > 0 else 1.0

        coord_tracks =[]
        visibility_tracks =[]
        
        for path in paths:
            # Scale coordinates immediately
            scaled_points = [{'x': p['x'] * scale_x, 'y': p['y'] * scale_y} for p in path.get('points',[])]
            
            # Setup Time Ranges
            start_time = path.get('startTime', 0.0)
            end_time = path.get('endTime', 1.0)
            
            start_frame = max(0, min(frame_count - 1, int(round(start_time * (frame_count - 1)))))
            end_frame = max(0, min(frame_count - 1, int(round(end_time * (frame_count - 1)))))
            if start_frame > end_frame: start_frame, end_frame = end_frame, start_frame
            active_frames = end_frame - start_frame + 1

            resampled_points = GeometryUtils.resample_path_uniform(scaled_points, num_samples=active_frames, bezier_points=path.get('bezier_pts'))

            if not resampled_points:
                continue

            tangents = GeometryUtils.calculate_tangents(resampled_points)
            
            qty = path.get('qty', 0)
            total_tracks = 1 + qty
            track_spread_px = path.get('spread', Config.DEFAULT_SPREAD) * 0.01 * (frame_width + frame_height) / 2.0
            visibility_mode = path.get('visibilityMode', 'pop')

            # Expand Tracks for "Spread" logic
            for track_idx in range(total_tracks):
                track_coords = []
                track_mask =[]
                offset = (track_idx - (total_tracks - 1) / 2.0) * track_spread_px

                perp_x_start, perp_y_start = tangents[0]
                perp_x_end, perp_y_end = tangents[-1]

                first_point = {"x": int(round(resampled_points[0]["x"] + perp_x_start * offset)), "y": int(round(resampled_points[0]["y"] + perp_y_start * offset))}
                last_point = {"x": int(round(resampled_points[-1]["x"] + perp_x_end * offset)), "y": int(round(resampled_points[-1]["y"] + perp_y_end * offset))}

                # Padding Start
                for _ in range(start_frame):
                    track_coords.append(first_point)
                    track_mask.append(1.0 if visibility_mode == 'static' else 0.0)
                    
                # Animated Frames
                for p, (perp_x, perp_y) in zip(resampled_points, tangents):
                    track_coords.append({"x": int(round(p["x"] + perp_x * offset)), "y": int(round(p["y"] + perp_y * offset))})
                    track_mask.append(1.0)
                    
                # Padding End
                for _ in range(frame_count - end_frame - 1):
                    track_coords.append(last_point)
                    track_mask.append(1.0 if visibility_mode == 'static' else 0.0)

                coord_tracks.append(track_coords)
                visibility_tracks.append(track_mask)

        # Formatting Output
        coord_string = json.dumps(coord_tracks)
        
        if not coord_tracks:
            tracks_tensor = torch.zeros((frame_count, 0, 2), dtype=torch.float32)
            track_visibility = torch.zeros((frame_count, 0), dtype=torch.bool)
        else:
            formatted_list = [
                [[track[f]['x'], track[f]['y']] for track in coord_tracks]
                for f in range(frame_count)
            ]
            tracks_tensor = torch.tensor(formatted_list, dtype=torch.float32)
            mask_tensor = torch.tensor(visibility_tracks, dtype=torch.float32).transpose(0, 1)
            track_visibility = (mask_tensor > 0.5)

        print(f"WanMove_PathAnimator: Generated {len(coord_tracks)} tracks for Wan-Move")

        return ({"track_path": tracks_tensor, "track_visibility": track_visibility}, coord_string)