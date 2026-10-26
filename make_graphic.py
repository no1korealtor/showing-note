from PIL import Image, ImageDraw, ImageFont
import os

width = 1024
height = 578

# Create background with rich gradient
img = Image.new('RGB', (width, height), color='#0f172a')
draw = ImageDraw.Draw(img)

# Gradient effect
for y in range(height):
    ratio = y / height
    r = int(15 * (1 - ratio) + 30 * ratio)
    g = int(23 * (1 - ratio) + 58 * ratio)
    b = int(42 * (1 - ratio) + 138 * ratio)
    draw.line([(0, y), (width, y)], fill=(r, g, b))

# Font setup
font_title = None
font_sub = None
font_chip = None

font_candidates = [
    "C:/Windows/Fonts/malgunbd.ttf",
    "C:/Windows/Fonts/malgun.ttf",
    "C:/Windows/Fonts/Pretendard-Bold.otf",
    "C:/Windows/Fonts/gulim.ttc"
]

for font_path in font_candidates:
    if os.path.exists(font_path):
        try:
            font_title = ImageFont.truetype(font_path, 54)
            font_sub = ImageFont.truetype(font_path, 26)
            font_desc = ImageFont.truetype(font_path, 20)
            font_chip = ImageFont.truetype(font_path, 18)
            break
        except Exception:
            continue

if not font_title:
    font_title = font_sub = font_desc = font_chip = ImageFont.load_default()

# Header badge
draw.rounded_rectangle([412, 50, 612, 86], radius=18, fill='#1e293b', outline='#38bdf8', width=2)
draw.text((512, 68), "공인중개사 필수 현장 수첩", font=font_chip, fill='#38bdf8', anchor="mm")

# Main Title
draw.text((512, 140), "중 개 노 트", font=font_title, fill='#ffffff', anchor="mm")

# Subtitle
draw.text((512, 205), "집 보여주러 갈 때 필수! 현장 임장 & 도어락 비번 장부", font=font_sub, fill='#93c5fd', anchor="mm")

# 4 Key Feature Cards
cards = [
    ("📍 3초 주소 입력", "활동동 탭 + 지번만 툭!"),
    ("🔑 도어락 비번 복사", "공동/세대비번 한눈에"),
    ("📞 임대인/손님 통화", "현장 직통 원터치 연결"),
    ("⏰ 일정순 자동 정렬", "오늘 갈 집이 맨 위로!")
]

card_w = 215
card_h = 100
start_x = (width - (4 * card_w + 3 * 20)) // 2
card_y = 280

for i, (title, desc) in enumerate(cards):
    cx = start_x + i * (card_w + 20)
    # Card background
    draw.rounded_rectangle([cx, card_y, cx + card_w, card_y + card_h], radius=14, fill='#1e293b', outline='#334155', width=2)
    # Card top border accent
    draw.rounded_rectangle([cx, card_y, cx + card_w, card_y + 6], radius=3, fill='#2563eb')
    # Text
    draw.text((cx + card_w // 2, card_y + 35), title, font=font_chip, fill='#ffffff', anchor="mm")
    draw.text((cx + card_w // 2, card_y + 68), desc, font=font_desc, fill='#94a3b8', anchor="mm")

# Bottom security trust badge
draw.rounded_rectangle([250, 435, 774, 495], radius=12, fill='#0f172a', outline='#10b981', width=2)
draw.text((512, 465), "🛡️ 금융권 등급 AES-256 암호화 금고 보관 · 앱 삭제 시에도 100% 복구", font=font_desc, fill='#34d399', anchor="mm")

output_path = r"d:\부동산업무\antigravity\onestore_graphic_1024x578.png"
img.save(output_path, "PNG")
print("Saved:", output_path)
