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

    def resample_path_uniform(self, points, num_samples=121):
        """
        Resample path to exactly num_samples points with even arc-length spacing.

        Args:
            points: List of {x, y} dicts representing the path
            num_samples: Number of points to resample to (frame_count)

        Returns:
            List of {x, y} dicts with exactly num_samples points evenly distributed along the arc
        """
        if len(points) == 0:
            return[]

        # SOLUTION 1: Support static single points
        if len(points) == 1:
            # Single point - repeat for all samples (creates static anchor)
            return [{'x': points[0]['x'], 'y': points[0]['y']} for _ in range(num_samples)]

        # Calculate cumulative arc lengths along the path
        cumulative_lengths = [0.0]
        for i in range(len(points) - 1):
            dx = points[i + 1]['x'] - points[i]['x']
            dy = points[i + 1]['y'] - points[i]['y']
            length = math.sqrt(dx * dx + dy * dy)
            cumulative_lengths.append(cumulative_lengths[-1] + length)

        total_length = cumulative_lengths[-1]

        # Handle zero-length path (all points are the same)
        if total_length == 0:
            return [{'x': points[0]['x'], 'y': points[0]['y']} for _ in range(num_samples)]

        # Resample at even intervals along the arc
        resampled =[]
        for i in range(num_samples):
            # Calculate target distance along path
            if num_samples == 1:
                target_length = 0
            else:
                target_length = (i / (num_samples - 1)) * total_length

            # Find segment containing target length
            for j in range(len(cumulative_lengths) - 1):
                if cumulative_lengths[j] <= target_length <= cumulative_lengths[j + 1]:
                    # Interpolate within this segment
                    seg_length = cumulative_lengths[j + 1] - cumulative_lengths[j]
                    if seg_length > 0:
                        t = (target_length - cumulative_lengths[j]) / seg_length
                    else:
                        t = 0

                    x = points[j]['x'] + t * (points[j + 1]['x'] - points[j]['x'])
                    y = points[j]['y'] + t * (points[j + 1]['y'] - points[j]['y'])
                    resampled.append({'x': x, 'y': y})
                    break
            else:
                # Fallback to last point (shouldn't happen with correct logic)
                resampled.append({'x': points[-1]['x'], 'y': points[-1]['y']})

        return resampled

    def animate_paths(self, frame_width, frame_height, frame_count, 
                     paths_data='{"paths":[], "canvas_size": {"width": 512, "height": 512}}'):

        # Parse paths data
        try:
            paths_obj = json.loads(paths_data)
            paths = paths_obj.get('paths',[])
            canvas_size = paths_obj.get('canvas_size', {'width': frame_width, 'height': frame_height})
        except json.JSONDecodeError:
            print("WanMove_PathAnimator: Invalid JSON in paths_data, using empty paths")
            paths =[]
            canvas_size = {'width': frame_width, 'height': frame_height}

        # Calculate scaling factors to transform from canvas coordinates to frame coordinates
        canvas_width = canvas_size.get('width', frame_width)
        canvas_height = canvas_size.get('height', frame_height)
        scale_x = frame_width / canvas_width if canvas_width > 0 else 1.0
        scale_y = frame_height / canvas_height if canvas_height > 0 else 1.0

        # Scale all path coordinates
        scaled_paths =[]
        for path in paths:
            scaled_path = path.copy()
            scaled_points =[]
            for point in path.get('points', []):
                scaled_points.append({
                    'x': point['x'] * scale_x,
                    'y': point['y'] * scale_y
                })
            scaled_path['points'] = scaled_points

            # Preserve isSinglePoint flag if it exists
            if 'isSinglePoint' in path:
                scaled_path['isSinglePoint'] = path['isSinglePoint']

            scaled_paths.append(scaled_path)

        # Resample each path to the frame count with visibility flags
        coord_tracks =[]
        for path in scaled_paths:
            points = path.get('points',[])

            # Check if this is a single-point path (static anchor)
            is_single_point = path.get('isSinglePoint', False) or len(points) == 1

            # Resample to frame count
            resampled_points = self.resample_path_uniform(points, num_samples=frame_count)

            # Add visibility flag (1.0 = visible)
            # Format:[{"x": x, "y": y}, {"x": x, "y": y}, ...]
            # The visibility will be added as a third coordinate when processed (?)
            track_coords =[
                {"x": int(round(p["x"])), "y": int(round(p["y"]))}
                for p in resampled_points
            ]

            coord_tracks.append(track_coords)

        # Output as list of tracks (each track is a list of frame_count number of {x, y} points)
        coord_string = json.dumps(coord_tracks)

        print(f"WanMove_PathAnimator: Generated {len(coord_tracks)} tracks with {frame_count} points each for Wan-Move")

        return (coord_string,)