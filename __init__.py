"""
WanMove Path Animator
Creates animated points that follow user-drawn paths with visual editor.
"""

from .nodes.WanMove_PathAnimator import WanMove_PathAnimator

NODE_CLASS_MAPPINGS = {
    "WanMove_PathAnimator": WanMove_PathAnimator,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WanMove_PathAnimator": "WanMove Path Animator",
}

WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

print("\n" + "="*24)
print("WanMove Path Animator")
print("="*24 + "\n")
