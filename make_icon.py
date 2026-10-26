from PIL import Image, ImageDraw, ImageFont
import os
import math

size = 512
img = Image.new('RGBA', (size, size), color=(0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# 1. Base Squircle / Rounded Card Background
# Deep royal navy gradient
bg = Image.new('RGB', (size, size), color='#1e3a8a')
bg_draw = ImageDraw.Draw(bg)
for y in range(size):
    ratio = y / size
    r = int(15 * (1 - ratio) + 29 * ratio)
    g = int(23 * (1 - ratio) + 78 * ratio)
    b = int(42 * (1 - ratio) + 216 * ratio)
    bg_draw.line([(0, y), (size, y)], fill=(r, g, b))

# Mask for rounded corners (squircle radius: 110px)
mask = Image.new('L', (size, size), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([0, 0, size, size], radius=110, fill=255)

img.paste(bg, (0, 0), mask)

draw = ImageDraw.Draw(img)

# Outer subtle glow border
draw.rounded_rectangle([2, 2, size - 3, size - 3], radius=110, outline=(255, 255, 255, 40), width=4)

# 2. Main Illustration: Clean Notebook / Clipboard Body
nb_x1, nb_y1, nb_x2, nb_y2 = 100, 90, 412, 430
draw.rounded_rectangle([nb_x1, nb_y1, nb_x2, nb_y2], radius=28, fill='#ffffff')
# Notebook header bar (accent blue)
draw.rounded_rectangle([nb_x1, nb_y1, nb_x2, nb_y1 + 54], radius=28, fill='#2563eb')
draw.rectangle([nb_x1, nb_y1 + 28, nb_x2, nb_y1 + 54], fill='#2563eb')

# Binder rings / clips
for cx in [160, 256, 352]:
    draw.rounded_rectangle([cx - 10, nb_y1 - 12, cx + 10, nb_y1 + 18], radius=6, fill='#94a3b8')
    draw.rounded_rectangle([cx - 7, nb_y1 - 10, cx + 7, nb_y1 + 14], radius=4, fill='#cbd5e1')

# 3. Inside Notebook: House Roof + Key Symbol
# House roof (orange/amber)
roof_pts = [(256, 175), (160, 245), (180, 245), (256, 192), (332, 245), (352, 245)]
draw.polygon(roof_pts, fill='#f59e0b')

# House body outline
draw.rectangle([186, 245, 326, 335], fill='#f8fafc', outline='#cbd5e1', width=3)

# Keyhole / Digital Key icon inside house
draw.ellipse([244, 265, 268, 289], fill='#2563eb')
draw.polygon([(250, 285), (262, 285), (260, 315), (252, 315)], fill='#2563eb')
draw.rectangle([256, 300, 266, 306], fill='#2563eb')
draw.rectangle([256, 309, 264, 315], fill='#2563eb')

# 4. Text below: "중개노트"
font_path = "C:/Windows/Fonts/malgunbd.ttf"
if not os.path.exists(font_path):
    font_path = "C:/Windows/Fonts/malgun.ttf"

try:
    font_text = ImageFont.truetype(font_path, 34)
except Exception:
    font_text = ImageFont.load_default()

# Notebook ruled line
draw.line([(140, 355), (372, 355)], fill='#e2e8f0', width=3)

# Badge text "중개노트" inside
draw.rounded_rectangle([150, 368, 362, 412], radius=10, fill='#eff6ff')
draw.text((256, 390), "중개노트", font=font_text, fill='#1d4ed8', anchor="mm")

# Convert RGBA to RGB for ONE store icon compatibility
final_img = Image.new('RGB', (size, size), color='#1e3a8a')
final_img.paste(img, (0, 0), img)

out_path = r"d:\부동산업무\antigravity\onestore_icon_512x512.png"
final_img.save(out_path, "PNG")
print("Saved Icon:", out_path)
