import math
import json
import torch

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
                "frame_width": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 1}),
                "frame_height": ("INT", {"default": 512, "min": 64, "max": 4096, "step": 1}),
                "frame_count": ("INT", {"default": 30, "min": 1, "max": 500, "step": 1}),
            },
            "optional": {
                "image": ("IMAGE",),
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
            # New format[y0, x1, y1, x2, y2, y3]
            y0, x1, y1, x2, y2, y3 = bezier_points
        else:
            y0, x1, y1, x2, y2, y3 = 0.0, 0.0, 0.0, 1.0, 1.0, 1.0

        if len(points) == 1:
            return [{'x': points[0]['x'], 'y': points[0]['y']} for _ in range(num_samples)]

        cumulative_lengths = [0.0]
        for i in range(len(points) - 1):
            dx = points[i + 1]['x'] - points[i]['x']
            dy = points[i + 1]['y'] - points[i]['y']
            length = math.sqrt(dx * dx + dy * dy)
            cumulative_lengths.append(cumulative_lengths[-1] + length)

        total_length = cumulative_lengths[-1]

        if total_length == 0:
            return [{'x': points[0]['x'], 'y': points[0]['y']} for _ in range(num_samples)]

        resampled =[]
        for i in range(num_samples):
            # 1. Get linear time progress[0 to 1]
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
                     paths_data='{"paths":[], "canvas_size": {"width": 512, "height": 512}}', image=None):
        
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

        coord_tracks = []
        visibility_tracks =[]
        
        for path in paths:
            points = path.get('points',[])
            # Rescale points from canvas to actual frame size
            scaled_points = [{'x': p['x'] * scale_x, 'y': p['y'] * scale_y} for p in points]
            
            bezier_pts = path.get('bezier_pts',[0.0, 0.0, 0.0, 1.0, 1.0, 1.0])
            start_time = path.get('startTime', 0.0)
            end_time = path.get('endTime', 1.0)
            visibility_mode = path.get('visibilityMode', 'pop')

            # 1. Convert 0.0-1.0 time range into absolute frame indices
            start_frame = max(0, min(frame_count - 1, int(round(start_time * (frame_count - 1)))))
            end_frame = max(0, min(frame_count - 1, int(round(end_time * (frame_count - 1)))))
            
            if start_frame > end_frame:
                start_frame, end_frame = end_frame, start_frame
                
            active_frames = end_frame - start_frame + 1

            # 2. Resample path to the active duration
            resampled_points = self.resample_path_uniform(scaled_points, num_samples=active_frames, bezier_points=bezier_pts)

            if not resampled_points:
                continue

            qty = path.get('qty', 0)
            spread = path.get('spread', 1.50)
            total_tracks = 1 + qty
            track_spread_px = spread * 0.01 * (frame_width + frame_height) / 2.0

            tangents =[]
            num_pts = len(resampled_points)
            for i in range(num_pts):
                if num_pts > 1:
                    if i < num_pts - 1:
                        tx = resampled_points[i+1]['x'] - resampled_points[i]['x']
                        ty = resampled_points[i+1]['y'] - resampled_points[i]['y']
                    else:
                        tx = resampled_points[i]['x'] - resampled_points[i-1]['x']
                        ty = resampled_points[i]['y'] - resampled_points[i-1]['y']
                else:
                    tx, ty = 0.0, 0.0
                
                length = math.sqrt(tx**2 + ty**2)
                if length > 0:
                    tangents.append((-ty / length, tx / length))
                else:
                    tangents.append((1.0, 0.0))

            for track_idx in range(total_tracks):
                track_coords = []
                track_mask =[]
                offset = (track_idx - (total_tracks - 1) / 2.0) * track_spread_px

                perp_x_start, perp_y_start = tangents[0]
                perp_x_end, perp_y_end = tangents[-1]

                first_point = {"x": int(round(resampled_points[0]["x"] + perp_x_start * offset)), 
                               "y": int(round(resampled_points[0]["y"] + perp_y_start * offset))}
                last_point = {"x": int(round(resampled_points[-1]["x"] + perp_x_end * offset)), 
                              "y": int(round(resampled_points[-1]["y"] + perp_y_end * offset))}

                # 3. Padding Start
                for _ in range(start_frame):
                    track_coords.append(first_point)
                    track_mask.append(1.0 if visibility_mode == 'static' else 0.0)
                    
                # 4. Animated Frames
                for p, (perp_x, perp_y) in zip(resampled_points, tangents):
                    track_coords.append({"x": int(round(p["x"] + perp_x * offset)), "y": int(round(p["y"] + perp_y * offset))})
                    track_mask.append(1.0)
                    
                # 5. Padding End
                for _ in range(frame_count - end_frame - 1):
                    track_coords.append(last_point)
                    track_mask.append(1.0 if visibility_mode == 'static' else 0.0)

                coord_tracks.append(track_coords)
                visibility_tracks.append(track_mask)

        # 6. Generate JSON string (Matches existing legacy functionality)
        coord_string = json.dumps(coord_tracks)
        
        # 7. Generate TRACKS Dictionary (Compatible with WanMove nodes)
        if not coord_tracks:
            tracks_tensor = torch.zeros((frame_count, 0, 2), dtype=torch.float32)
            track_visibility = torch.zeros((frame_count, 0), dtype=torch.bool)
        else:
            # Create list of frames, each containing a list of [x, y] for all tracks
            formatted_list =[]
            for f in range(frame_count):
                frame_data = [[track[f]['x'], track[f]['y']] for track in coord_tracks]
                formatted_list.append(frame_data)
            
            tracks_tensor = torch.tensor(formatted_list, dtype=torch.float32)
            
            # Transpose visibility_tracks from [num_tracks, frames] ->[frames, num_tracks]
            mask_tensor = torch.tensor(visibility_tracks, dtype=torch.float32).transpose(0, 1)
            track_visibility = (mask_tensor > 0.5)

        tracks_output = {
            "track_path": tracks_tensor,
            "track_visibility": track_visibility
        }

        print(f"WanMove_PathAnimator: Generated {len(coord_tracks)} tracks for Wan-Move")

        return (tracks_output, coord_string)