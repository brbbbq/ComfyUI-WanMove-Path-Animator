import math
import json

class WanMove_PathAnimator:

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("coordinates",)
    FUNCTION = "animate_paths"
    CATEGORY = "WanMove Path Animator"
    DESCRIPTION = """
Creates animated points that follow user-drawn paths.
Open the path editor to draw trajectories on a reference image, then points will follow these paths over time.
Includes custom Bezier easing support.
"""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "frame_width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 1}),
                "frame_height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 1}),
                "frame_count": ("INT", {"default": 30, "min": 1, "max": 500, "step": 1}),
            },
            "optional": {
                "paths_data": ("STRING", {"default": '{"paths":[], "canvas_size": {"width": 512, "height": 512}}', "multiline": True}),
            }
        }

    def solve_bezier_x(self, x_target, x1, x2):
        """Binary search to find the parametric 't' for a given X (Time)."""
        if x_target <= 0.0: return 0.0
        if x_target >= 1.0: return 1.0
        
        t_min, t_max = 0.0, 1.0
        for _ in range(20):  # 20 iterations for high precision
            t = (t_min + t_max) / 2.0
            x = 3 * (1 - t)**2 * t * x1 + 3 * (1 - t) * t**2 * x2 + t**3
            if x < x_target:
                t_min = t
            else:
                t_max = t
        return (t_min + t_max) / 2.0

    def get_bezier_y(self, t, y0, y1, y2, y3):
        """Calculate Y (Progress) given the parametric 't' and variable start/end Y values."""
        return (1 - t)**3 * y0 + 3 * (1 - t)**2 * t * y1 + 3 * (1 - t) * t**2 * y2 + t**3 * y3

    def resample_path_uniform(self, points, num_samples=121, bezier_points=None):
        """
        Resample path to exactly num_samples points with custom easing based on arc-length.
        """
        if len(points) == 0:
            return[]

        # Handle backward compatibility and defaults
        if bezier_points is None:
            bezier_points =[0.0, 0.0, 0.0, 1.0, 1.0, 1.0]

        if len(bezier_points) == 4:
            # Old format [x1, y1, x2, y2]
            x1, y1, x2, y2 = bezier_points
            y0, y3 = 0.0, 1.0
        elif len(bezier_points) == 6:
            # New format [y0, x1, y1, x2, y2, y3]
            y0, x1, y1, x2, y2, y3 = bezier_points
        else:
            y0, x1, y1, x2, y2, y3 = 0.0, 0.0, 0.0, 1.0, 1.0, 1.0

        if len(points) == 1:
            return[{'x': points[0]['x'], 'y': points[0]['y']} for _ in range(num_samples)]

        cumulative_lengths = [0.0]
        for i in range(len(points) - 1):
            dx = points[i + 1]['x'] - points[i]['x']
            dy = points[i + 1]['y'] - points[i]['y']
            length = math.sqrt(dx * dx + dy * dy)
            cumulative_lengths.append(cumulative_lengths[-1] + length)

        total_length = cumulative_lengths[-1]

        if total_length == 0:
            return[{'x': points[0]['x'], 'y': points[0]['y']} for _ in range(num_samples)]

        resampled =[]
        for i in range(num_samples):
            # 1. Get linear time progress [0 to 1]
            linear_time = 0 if num_samples == 1 else i / (num_samples - 1)
            
            # 2. Map linear time to eased progress using the Bezier curve
            t_param = self.solve_bezier_x(linear_time, x1, x2)
            eased_progress = self.get_bezier_y(t_param, y0, y1, y2, y3)
            
            # 3. Apply the eased progress to the path's total length
            target_length = eased_progress * total_length

            # Determine segment index (handles extrapolation smoothly for bounce/overshoot)
            if target_length <= 0:
                j = 0
            elif target_length >= total_length:
                j = len(cumulative_lengths) - 2
            else:
                for k in range(len(cumulative_lengths) - 1):
                    if cumulative_lengths[k] <= target_length <= cumulative_lengths[k + 1]:
                        j = k
                        break
                else:
                    j = len(cumulative_lengths) - 2

            # Interpolate or Extrapolate within this segment
            seg_length = cumulative_lengths[j + 1] - cumulative_lengths[j]
            if seg_length > 0:
                t = (target_length - cumulative_lengths[j]) / seg_length
            else:
                t = 0

            x = points[j]['x'] + t * (points[j + 1]['x'] - points[j]['x'])
            y = points[j]['y'] + t * (points[j + 1]['y'] - points[j]['y'])
            resampled.append({'x': x, 'y': y})

        return resampled

    def animate_paths(self, frame_width, frame_height, frame_count, 
                     paths_data='{"paths":[], "canvas_size": {"width": 512, "height": 512}}'):

        try:
            paths_obj = json.loads(paths_data)
            paths = paths_obj.get('paths',[])
            canvas_size = paths_obj.get('canvas_size', {'width': frame_width, 'height': frame_height})
        except json.JSONDecodeError:
            print("WanMove_PathAnimator: Invalid JSON in paths_data, using empty paths")
            paths =[]
            canvas_size = {'width': frame_width, 'height': frame_height}

        canvas_width = canvas_size.get('width', frame_width)
        canvas_height = canvas_size.get('height', frame_height)
        scale_x = frame_width / canvas_width if canvas_width > 0 else 1.0
        scale_y = frame_height / canvas_height if canvas_height > 0 else 1.0

        scaled_paths =[]
        for path in paths:
            scaled_path = path.copy()
            scaled_points = []
            for point in path.get('points',[]):
                scaled_points.append({
                    'x': point['x'] * scale_x,
                    'y': point['y'] * scale_y
                })
            scaled_path['points'] = scaled_points

            if 'isSinglePoint' in path:
                scaled_path['isSinglePoint'] = path['isSinglePoint']

            scaled_paths.append(scaled_path)

        coord_tracks =[]
        for path in scaled_paths:
            points = path.get('points',[])
            bezier_pts = path.get('bezier_pts',[0.0, 0.0, 0.0, 1.0, 1.0, 1.0])

            is_single_point = path.get('isSinglePoint', False) or len(points) == 1

            # Resample to frame count with the bezier points applied
            resampled_points = self.resample_path_uniform(points, num_samples=frame_count, bezier_points=bezier_pts)

            track_coords =[
                {"x": int(round(p["x"])), "y": int(round(p["y"]))}
                for p in resampled_points
            ]

            coord_tracks.append(track_coords)

        coord_string = json.dumps(coord_tracks)

        print(f"WanMove_PathAnimator: Generated {len(coord_tracks)} tracks with {frame_count} points each for Wan-Move")

        return (coord_string,)