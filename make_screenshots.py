from PIL import Image, ImageDraw, ImageFont
import os

width = 720
height = 1280

font_path = "C:/Windows/Fonts/malgunbd.ttf"
if not os.path.exists(font_path):
    font_path = "C:/Windows/Fonts/malgun.ttf"

f_banner_title = ImageFont.truetype(font_path, 34)
f_banner_sub = ImageFont.truetype(font_path, 21)
f_h1 = ImageFont.truetype(font_path, 24)
f_h2 = ImageFont.truetype(font_path, 20)
f_body = ImageFont.truetype(font_path, 17)
f_sm = ImageFont.truetype(font_path, 14)
f_mono = ImageFont.truetype(font_path, 22)

out_dir = r"d:\부동산업무\antigravity\onestore_screenshots"

screens_data = [
    {
        "filename": "screenshot_1.png",
        "badge": "초간편 현장 수첩",
        "title": "활동 동 탭 누르고 지번만 툭!",
        "sub": "시·도 전체 입력 없이 3초 만에 주소 등록 끝",
        "active_dong": "성산동",
        "jibun": "234-12 201호",
        "bldg": "성산아트빌",
        "common_pw": "#1234*",
        "door_pw": "1357*",
        "owner": "임대인 (김대표)",
        "owner_tel": "010-3456-7890",
        "appt_time": "오늘 14:00",
        "client": "직방 (5678)",
        "memo": "전세 2억3천, 채광 및 주차 1대 희망"
    },
    {
        "filename": "screenshot_2.png",
        "badge": "스마트 동선 관리",
        "title": "오늘 약속시간 빠른 순 자동 정렬",
        "sub": "지금 당장 가야 할 집이 맨 위 1등 카드로!",
        "active_dong": "중동",
        "jibun": "65-4 302호",
        "bldg": "대우베스트",
        "common_pw": "종0101",
        "door_pw": "0089#",
        "owner": "관리소장님",
        "owner_tel": "010-9876-1234",
        "appt_time": "오늘 16:30",
        "client": "신혼부부 (8899)",
        "memo": "즉시입주 가능여부 체크 및 대출 상담"
    },
    {
        "filename": "screenshot_3.png",
        "badge": "현장 원터치 통화",
        "title": "비번 오류 시 임대인 즉시 통화!",
        "sub": "손님 호칭 자동 식별 (직방, 네이버, 신혼부부)",
        "active_dong": "성산동",
        "jibun": "108-5 101호",
        "bldg": "드림하우스",
        "common_pw": "#9988*",
        "door_pw": "5566*",
        "owner": "집주인 사모님",
        "owner_tel": "010-2222-3333",
        "appt_time": "내일 11:00",
        "client": "네이버 (1234)",
        "memo": "문 안 열릴 땐 임대인 통화로 1초 해결!"
    },
    {
        "filename": "screenshot_4.png",
        "badge": "공인중개사 자산 보호",
        "title": "앱 삭제해도 100% 자동 복구!",
        "sub": "금융권 등급 AES-256 군사 암호화 금고 보관",
        "active_dong": "전체 동",
        "jibun": "234-12 201호",
        "bldg": "성산아트빌",
        "common_pw": "#1234*",
        "door_pw": "1357*",
        "owner": "임대인",
        "owner_tel": "010-3456-7890",
        "appt_time": "10/18 11:00 (지난 안내)",
        "client": "LH/버팀목 (3321)",
        "memo": "채광 좋다고 호평. 대출 한도 조회 후 재연락"
    }
]

for idx, data in enumerate(screens_data):
    img = Image.new('RGB', (width, height), color='#0f172a')
    draw = ImageDraw.Draw(img)

    # Top banner gradient background
    for y in range(260):
        ratio = y / 260
        r = int(15 * (1 - ratio) + 29 * ratio)
        g = int(23 * (1 - ratio) + 78 * ratio)
        b = int(42 * (1 - ratio) + 216 * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    # Top Banner Texts
    draw.rounded_rectangle([250, 36, 470, 72], radius=18, fill='#1e293b', outline='#38bdf8', width=2)
    draw.text((360, 54), data["badge"], font=f_sm, fill='#38bdf8', anchor="mm")

    draw.text((360, 114), data["title"], font=f_banner_title, fill='#ffffff', anchor="mm")
    draw.text((360, 168), data["sub"], font=f_banner_sub, fill='#93c5fd', anchor="mm")

    # Mobile Mockup Area (White / Slate card)
    mock_x1, mock_y1, mock_x2, mock_y2 = 36, 220, 684, 1240
    draw.rounded_rectangle([mock_x1, mock_y1, mock_x2, mock_y2], radius=24, fill='#f8fafc', outline='#334155', width=3)

    # App Header inside mockup
    draw.rounded_rectangle([mock_x1 + 3, mock_y1 + 3, mock_x2 - 3, mock_y1 + 75], radius=22, fill='#ffffff')
    draw.rectangle([mock_x1 + 3, mock_y1 + 45, mock_x2 - 3, mock_y1 + 75], fill='#ffffff')
    draw.line([(mock_x1, mock_y1 + 75), (mock_x2, mock_y1 + 75)], fill='#e2e8f0', width=2)

    draw.text((mock_x1 + 24, mock_y1 + 38), "🏡 중개노트", font=f_h1, fill='#0f172a', anchor="lm")
    draw.rounded_rectangle([mock_x2 - 120, mock_y1 + 20, mock_x2 - 20, mock_y1 + 56], radius=8, fill='#2563eb')
    draw.text((mock_x2 - 70, mock_y1 + 38), "+ 새 집 등록", font=f_sm, fill='#ffffff', anchor="mm")

    # Dong Pills inside mockup
    pills_y = mock_y1 + 95
    pills = ["전체 동", "성산동", "중동", "연남동"]
    cur_px = mock_x1 + 24
    for p in pills:
        is_active = (p == data["active_dong"] or (data["active_dong"] == "전체 동" and p == "전체 동"))
        pw = 88
        p_bg = '#1e293b' if is_active else '#ffffff'
        p_fg = '#ffffff' if is_active else '#475569'
        draw.rounded_rectangle([cur_px, pills_y, cur_px + pw, pills_y + 36], radius=18, fill=p_bg, outline='#cbd5e1', width=1)
        draw.text((cur_px + pw // 2, pills_y + 18), p, font=f_sm, fill=p_fg, anchor="mm")
        cur_px += pw + 10

    # Sort Bar
    sort_y = pills_y + 52
    draw.text((mock_x1 + 24, sort_y + 12), "총 3개 집 (약속순)", font=f_sm, fill='#64748b', anchor="lm")
    draw.rounded_rectangle([mock_x2 - 165, sort_y, mock_x2 - 20, sort_y + 28], radius=6, fill='#1d4ed8')
    draw.text((mock_x2 - 92, sort_y + 14), "⏰ 일정 빠른순", font=f_sm, fill='#ffffff', anchor="mm")

    # Main Property Card
    card_y1 = sort_y + 40
    card_y2 = card_y1 + 470
    draw.rounded_rectangle([mock_x1 + 18, card_y1, mock_x2 - 18, card_y2], radius=16, fill='#ffffff', outline='#cbd5e1', width=2)
    # Accent top border
    draw.rounded_rectangle([mock_x1 + 18, card_y1, mock_x2 - 18, card_y1 + 5], radius=2, fill='#1e40af')

    # Card Top Address Header
    head_y = card_y1 + 28
    draw.text((mock_x1 + 36, head_y), "★", font=f_h1, fill='#f59e0b', anchor="lm")
    draw.rounded_rectangle([mock_x1 + 68, head_y - 14, mock_x1 + 140, head_y + 14], radius=6, fill='#e0e7ff')
    draw.text((mock_x1 + 104, head_y), data["active_dong"] if data["active_dong"] != "전체 동" else "성산동", font=f_sm, fill='#3730a3', anchor="mm")
    draw.text((mock_x1 + 154, head_y), data["jibun"], font=f_h1, fill='#0f172a', anchor="lm")

    # Map button
    draw.rounded_rectangle([mock_x2 - 120, head_y - 16, mock_x2 - 36, head_y + 16], radius=6, fill='#f1f5f9', outline='#cbd5e1')
    draw.text((mock_x2 - 78, head_y), "📍 지도열기", font=f_sm, fill='#0284c7', anchor="mm")

    # Building name
    draw.text((mock_x1 + 68, head_y + 26), f"🏢 {data['bldg']}", font=f_sm, fill='#64748b', anchor="lm")

    # Passwords Line Box
    pw_box_y = head_y + 54
    draw.rounded_rectangle([mock_x1 + 36, pw_box_y, mock_x2 - 36, pw_box_y + 60], radius=8, fill='#f8fafc', outline='#94a3b8', width=1)
    draw.text((mock_x1 + 50, pw_box_y + 20), "🔑 공동현관:", font=f_sm, fill='#475569', anchor="lm")
    draw.text((mock_x1 + 140, pw_box_y + 20), data["common_pw"], font=f_mono, fill='#0f172a', anchor="lm")

    draw.text((mock_x1 + 50, pw_box_y + 44), "🚪 세대도어락:", font=f_sm, fill='#475569', anchor="lm")
    draw.text((mock_x1 + 155, pw_box_y + 44), data["door_pw"], font=f_mono, fill='#1d4ed8', anchor="lm")

    # Owner call button
    draw.rounded_rectangle([mock_x2 - 170, pw_box_y + 12, mock_x2 - 48, pw_box_y + 48], radius=6, fill='#fef3c7', outline='#fde68a')
    draw.text((mock_x2 - 109, pw_box_y + 30), f"📞 임대인 통화", font=f_sm, fill='#92400e', anchor="mm")

    # Indented Tree Section
    tree_y = pw_box_y + 76
    draw.text((mock_x1 + 44, tree_y + 14), "↳ 매달린 약속 목록", font=f_sm, fill='#1e40af', anchor="lm")
    draw.rounded_rectangle([mock_x2 - 110, tree_y, mock_x2 - 36, tree_y + 28], radius=6, fill='#ffffff', outline='#2563eb')
    draw.text((mock_x2 - 73, tree_y + 14), "+ 약속잡기", font=f_sm, fill='#2563eb', anchor="mm")

    # Indented sub-card (Tree branch)
    sub_y = tree_y + 38
    # Dashed line indicator
    draw.line([(mock_x1 + 54, sub_y), (mock_x1 + 54, sub_y + 160)], fill='#93c5fd', width=3)

    # Future appointment box
    draw.rounded_rectangle([mock_x1 + 72, sub_y, mock_x2 - 36, sub_y + 110], radius=10, fill='#ffffff', outline='#bfdbfe', width=2)
    draw.rectangle([mock_x1 + 72, sub_y, mock_x1 + 78, sub_y + 110], fill='#2563eb')

    draw.text((mock_x1 + 92, sub_y + 24), f"⏰ {data['appt_time']}", font=f_h2, fill='#1d4ed8', anchor="lm")
    draw.text((mock_x1 + 240, sub_y + 24), f"👤 {data['client']}", font=f_h2, fill='#0f172a', anchor="lm")

    # Client call button
    draw.rounded_rectangle([mock_x2 - 130, sub_y + 10, mock_x2 - 50, sub_y + 40], radius=6, fill='#dbeafe')
    draw.text((mock_x2 - 90, sub_y + 25), "📞 손님통화", font=f_sm, fill='#1e40af', anchor="mm")

    draw.text((mock_x1 + 92, sub_y + 60), f"💡 {data['memo']}", font=f_sm, fill='#64748b', anchor="lm")

    # Feedback mini buttons
    draw.rounded_rectangle([mock_x2 - 150, sub_y + 75, mock_x2 - 50, sub_y + 100], radius=4, fill='#f1f5f9', outline='#cbd5e1')
    draw.text((mock_x2 - 100, sub_y + 87), "📝 반응기록", font=f_sm, fill='#334155', anchor="mm")

    # Past History item below
    past_y = sub_y + 126
    draw.text((mock_x1 + 72, past_y), "📜 지난 안내 기록 (1건 누적)", font=f_sm, fill='#64748b', anchor="lm")
    draw.rounded_rectangle([mock_x1 + 72, past_y + 12, mock_x2 - 36, past_y + 54], radius=6, fill='#f8fafc', outline='#e2e8f0')
    draw.text((mock_x1 + 86, past_y + 33), "· 10/18 11:00  LH/버팀목 (3321)  [채광 좋다고 호평]", font=f_sm, fill='#475569', anchor="lm")

    # Bottom phone nav bar
    draw.rounded_rectangle([mock_x1 + 3, mock_y2 - 50, mock_x2 - 3, mock_y2 - 3], radius=18, fill='#ffffff')
    draw.line([(mock_x1, mock_y2 - 50), (mock_x2, mock_y2 - 50)], fill='#e2e8f0', width=1)
    draw.text((width // 2, mock_y2 - 25), "🛡️ AES-256 군사 암호화 금고 실시간 백업 중", font=f_sm, fill='#10b981', anchor="mm")

    out_file = os.path.join(out_dir, data["filename"])
    img.save(out_file, "PNG", optimize=True)
    print(f"Generated: {out_file} ({os.path.getsize(out_file)} bytes)")

print("All 4 screenshots generated successfully!")
