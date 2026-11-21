# -*- coding: utf-8 -*-
"""주간 보고 생성기 사용자 매뉴얼(PPTX) 생성기. llm-pulse docs/manual/build_manual.py 양식을 이 앱에 맞게 고쳐 썼다.

    python -m http.server 8732                         # 저장소 폴더에서 (다른 창)
    node docs/manual/shoot.mjs http://127.0.0.1:8732/  # shots/*.png + shots/rects.json (합성 데이터 화면)
    python docs/manual/build_manual.py                 # PPTX 생성
    python docs/manual/build_manual.py --pdf           # PPTX + PDF (PowerPoint 가 설치된 Windows)

스크린샷은 1440x900 화면 픽셀 그대로이고, 말풍선 위치는 shoot.mjs 가 기록한 rects.json(요소 좌표)에서 읽는다.
Pptx*.png 는 make_pptx_shots.mjs 로 만든 덱을 PowerPoint 로 PNG 로 내보낸 그림이다.
"""
import json
import os
import subprocess
import sys

from PIL import Image
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Inches, Pt

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, "shots")
ASSETS = os.path.join(HERE, "assets")
CACHE = os.path.join(HERE, ".cache")
OUT = os.path.join(HERE, "Weekly-Report-User-Manual-ko.pptx")
VERSION = "1.0.0"
DATE = "2026.11.21"
APP = "주간 보고 생성기"
DIP = (1440, 900)
RECTS = json.load(open(os.path.join(SHOTS, "rects.json"), encoding="utf-8"))

# ---------------------------------------------------------------- 디자인 토큰 (llm-pulse 양식, 강조색만 앱 색)
INK = RGBColor(0x1F, 0x29, 0x37)
SUB = RGBColor(0x5B, 0x65, 0x73)
BLUE = RGBColor(0xC0, 0x00, 0x00)   # 강조색 (이 앱은 빨강)
NAVY = RGBColor(0x1A, 0x1A, 0x1A)
CARD = RGBColor(0xF3, 0xF5, 0xF8)
LINE = RGBColor(0xD9, 0xDE, 0xE5)
AMBER = RGBColor(0xE5, 0xA0, 0x2D)
AMBER_BG = RGBColor(0xFF, 0xF6, 0xE5)
AMBER_TX = RGBColor(0x7A, 0x4E, 0x00)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
FONT = "맑은 고딕"
MONO = "Consolas"

prs = Presentation()
prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
TOTAL = 21
state = {"n": 0}


def new_slide():
    state["n"] += 1
    return prs.slides.add_slide(prs.slide_layouts[6])


def box(s, x, y, w, h, fill=None, line=None, shape=MSO_SHAPE.RECTANGLE, radius=None, lw=0.75):
    sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid()
        sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(lw)
    sh.shadow.inherit = False
    if radius is not None and shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        sh.adjustments[0] = radius
    return sh


def rbox(s, x, y, w, h, fill=CARD, line=None, radius=0.03, lw=0.75):
    return box(s, x, y, w, h, fill, line, MSO_SHAPE.ROUNDED_RECTANGLE, radius, lw)


def text(s, x, y, w, h, t, size=12, bold=False, color=INK, align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP,
         shape=None, font=FONT, spacing=None):
    tb = shape or s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = Inches(0.05)
    tf.margin_top = tf.margin_bottom = Inches(0.02)
    tf.vertical_anchor = anchor
    lines = t if isinstance(t, list) else [t]
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        if spacing:
            p.line_spacing = spacing
        r = p.add_run()
        r.text = line
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.color.rgb = color
        r.font.name = font
    return tb


def num_circle(s, x, y, n, d=0.3, size=11):
    c = box(s, x, y, d, d, fill=BLUE, line=WHITE, shape=MSO_SHAPE.OVAL, lw=1.5)
    text(s, 0, 0, 0, 0, str(n), size, True, WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, shape=c)
    c.text_frame.margin_left = c.text_frame.margin_right = 0
    return c


def tip_bar(s, x, y, w, msg, h=0.42, size=10):
    t = rbox(s, x, y, w, h, fill=AMBER_BG, line=AMBER, radius=0.15)
    text(s, 0, 0, 0, 0, "Tip  " + msg, size, False, AMBER_TX, PP_ALIGN.LEFT, MSO_ANCHOR.MIDDLE, shape=t)
    t.text_frame.margin_left = Inches(0.12)


# ---------------------------------------------------------------- 공통 틀
def header(s, section, title, bullets):
    pill = box(s, 10.2, 0.0, 2.7, 0.34, fill=BLUE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.3)
    text(s, 0, 0, 0, 0, section, 10, True, WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, shape=pill)
    text(s, 0.45, 0.32, 11.5, 0.6, f"[{APP}] {title}", 26, True)
    box(s, 0.5, 1.0, 0.9, 0.06, fill=BLUE)
    for i, t in enumerate(bullets):
        box(s, 0.55, 1.37 + i * 0.36, 0.07, 0.07, fill=BLUE, shape=MSO_SHAPE.OVAL)
        text(s, 0.72, 1.24 + i * 0.36, 12.1, 0.32, t, 13.5)
    footer(s)


def footer(s):
    box(s, 0.5, 7.05, 12.33, 0.01, fill=LINE)
    s.shapes.add_picture(os.path.join(ASSETS, "icon.png"), Inches(0.5), Inches(7.12), Inches(0.22), Inches(0.22))
    text(s, 0.78, 7.1, 6, 0.25, f"{APP} 사용자 매뉴얼  ·  v{VERSION}  ·  배민혁", 9, False, SUB)
    text(s, 11.8, 7.1, 1.03, 0.25, f"{state['n']} / {TOTAL}", 9, True, SUB, PP_ALIGN.RIGHT)


# ---------------------------------------------------------------- 스크린샷 카드
def R(shot, *keys):
    """rects.json 에서 말풍선 좌표 (화면 픽셀)"""
    return [tuple(RECTS[shot][k]) for k in keys]


def U(shot, keys, pad=24, minx=None, maxx=None):
    """여러 요소를 감싸는 잘라내기 영역"""
    rs = R(shot, *keys)
    x0, y0 = min(r[0] for r in rs) - pad, min(r[1] for r in rs) - pad
    x1, y1 = max(r[2] for r in rs) + pad, max(r[3] for r in rs) + pad
    if minx is not None:
        x0 = min(x0, minx)
    if maxx is not None:
        x1 = max(x1, maxx)
    return (max(0, x0), max(0, y0), min(DIP[0], x1), min(DIP[1], y1))


def load_shot(name, crop=None, dip=DIP):
    """crop: 화면 픽셀 사각형 (x0,y0,x1,y1). 반환: (경로, 크기, 오프셋)"""
    path = os.path.join(SHOTS, f"{name}.png")
    im = Image.open(path)
    k = im.width / dip[0]
    if not crop:
        return path, dip, (0, 0)
    os.makedirs(CACHE, exist_ok=True)
    x0, y0, x1, y1 = crop
    out = os.path.join(CACHE, f"{name}_{x0}_{y0}_{x1}_{y1}.png")
    im.crop((round(x0 * k), round(y0 * k), round(x1 * k), round(y1 * k))).save(out, optimize=True)
    return out, (x1 - x0, y1 - y0), (x0, y0)


def shot_card(s, x, y, w, h, title, name, callouts=(), crop=None, dip=DIP, d=0.24, note="※ 합성 데이터로 찍은 화면"):
    rbox(s, x, y, w, h)
    text(s, x + 0.15, y + 0.1, w - 0.3, 0.32, title, 13, True)
    path, (dw, dh), (ox, oy) = load_shot(name, crop, dip)
    bw, bh = w - 0.4, h - 0.82
    k = min(bw / dw, bh / dh)
    iw, ih = dw * k, dh * k
    ix, iy = x + (w - iw) / 2, y + 0.5
    box(s, ix - 0.02, iy - 0.02, iw + 0.04, ih + 0.04, fill=WHITE, line=LINE)
    s.shapes.add_picture(path, Inches(ix), Inches(iy), Inches(iw), Inches(ih))
    for n, r in enumerate(callouts, 1):
        x0, y0, x1, y1 = max(r[0], ox), max(r[1], oy), min(r[2], ox + dw), min(r[3], oy + dh)  # 그림 밖으로 나가지 않게
        box(s, ix + (x0 - ox) * k, iy + (y0 - oy) * k, max(0.08, (x1 - x0) * k), max(0.08, (y1 - y0) * k), fill=None, line=BLUE,
            shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.08, lw=1.75)
        c = box(s, ix + (x0 - ox) * k - d / 2, iy + (y0 - oy) * k - d / 2, d, d, fill=BLUE, line=WHITE, shape=MSO_SHAPE.OVAL, lw=1.25)
        text(s, 0, 0, 0, 0, str(n), 10, True, WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, shape=c)
        c.text_frame.margin_left = c.text_frame.margin_right = 0
    if note:
        text(s, x + w - 3.0, y + h - 0.27, 2.85, 0.22, note, 8.5, False, SUB, PP_ALIGN.RIGHT)


def steps_card(s, x, y, w, h, steps, title="사용 순서", tip=None, desc_size=10):
    rbox(s, x, y, w, h)
    text(s, x + 0.15, y + 0.1, w - 0.3, 0.32, title, 13, True)
    n = len(steps)
    top = y + 0.52
    avail = h - 0.52 - (0.62 if tip else 0.15)
    pitch = min(0.8, avail / n)
    for i, (hd, ds) in enumerate(steps):
        yy = top + i * pitch
        num_circle(s, x + 0.2, yy + 0.03, i + 1)
        text(s, x + 0.62, yy - 0.02, w - 0.8, 0.28, hd, 12, True)
        text(s, x + 0.62, yy + 0.24, w - 0.8, pitch - 0.22, ds, desc_size, False, SUB)
    if tip:
        tip_bar(s, x + 0.15, y + h - 0.55, w - 0.3, tip, size=9.5)


CY, CH = 2.45, 4.5      # 카드 영역
LX, LW = 0.5, 7.4       # 왼쪽(스크린샷) 카드
RX, RW = 8.05, 4.78     # 오른쪽(순서) 카드


def shot_steps(section, title, bullets, shot, callouts, steps, tip=None, card_title=None, crop=None, desc_size=10):
    s = new_slide()
    header(s, section, title, bullets)
    shot_card(s, LX, CY, LW, CH, card_title or title, shot, callouts, crop)
    steps_card(s, RX, CY, RW, CH, steps, tip=tip, desc_size=desc_size)
    return s


# ================================================================ 1. 표지
def cover():
    s = new_slide()
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = NAVY
    box(s, 0, 0, 0.35, 7.5, fill=BLUE)
    s.shapes.add_picture(os.path.join(ASSETS, "icon.png"), Inches(0.8), Inches(0.9), Inches(0.9), Inches(0.9))
    text(s, 0.75, 2.0, 6.2, 1.0, APP, 46, True, WHITE)
    text(s, 0.8, 3.05, 6, 0.6, "사용자 매뉴얼", 26, False, RGBColor(0xFF, 0x9A, 0x9A))
    box(s, 0.85, 3.8, 0.9, 0.06, fill=BLUE)
    text(s, 0.8, 4.0, 5.9, 1.2, ["git log 에서 주간 보고 PPTX 까지,", "입력에 없는 숫자를 막는 브라우저 앱"], 15, False, RGBColor(0xD0, 0xD0, 0xD0))
    text(s, 0.8, 6.65, 7, 0.3, f"Version {VERSION}   ·   {DATE}   ·   배민혁", 11, False, RGBColor(0x9A, 0x9A, 0x9A))
    path, _, _ = load_shot("Shadow")
    box(s, 6.88, 1.3, 6.1, 3.83, fill=None, line=RGBColor(0x44, 0x44, 0x44), lw=1.5)
    s.shapes.add_picture(path, Inches(6.9), Inches(1.32), Inches(6.06), Inches(3.79))
    text(s, 6.9, 5.2, 6.06, 0.3, "※ 화면은 모두 가상 프로젝트 SpotCheck 의 합성 데이터", 9.5, False, RGBColor(0x9A, 0x9A, 0x9A), PP_ALIGN.RIGHT)


# ================================================================ 2. 목차
def toc():
    s = new_slide()
    pill = box(s, 10.2, 0.0, 2.7, 0.34, fill=BLUE, shape=MSO_SHAPE.ROUNDED_RECTANGLE, radius=0.3)
    text(s, 0, 0, 0, 0, "목차", 10, True, WHITE, PP_ALIGN.CENTER, MSO_ANCHOR.MIDDLE, shape=pill)
    text(s, 0.45, 0.32, 11.5, 0.6, "목차", 26, True)
    box(s, 0.5, 1.0, 0.9, 0.06, fill=BLUE)
    text(s, 0.55, 1.2, 12, 0.35, "처음 쓰는 분은 1~2번, 필요한 화면만 찾는 분은 오른쪽 쪽수를 보세요.", 13.5, False, SUB)
    groups = [
        ("1", "시작하기", [("3", "이 앱이 푸는 문제"), ("4", "열기 · 설치 · 첫 실행"), ("5", "화면 구성")]),
        ("2", "보고서 만들기", [("6", "커밋 불러오기"), ("7", "주제 · 메모 편집"), ("8", "사실 검증"), ("9", "지난주 대비")]),
        ("3", "내보내기", [("10", "미리보기 · 내보내기"), ("11", "PPTX 결과"), ("12", "내 PPTX 양식")]),
        ("4", "현장 검증 절차", [("13", "4단계 한눈에"), ("14", "바꾸기 전 비교"), ("15", "Shadow · 전환 · 롤백")]),
        ("5", "설정 · 부록", [("16", "LLM 키 · 개인정보"), ("17", "영역 사전"), ("18", "입력 형식 · 오류 메시지"),
                           ("19", "데이터 · 화면 옵션"), ("20", "FAQ · 문제 해결")]),
    ]
    pos = [(0.5, 1.9, 3.95, 2.45), (4.69, 1.9, 3.95, 2.45), (8.88, 1.9, 3.95, 2.45),
           (0.5, 4.5, 6.05, 2.4), (6.78, 4.5, 6.05, 2.4)]
    for (no, name, items), (x, y, w, h) in zip(groups, pos):
        rbox(s, x, y, w, h)
        num_circle(s, x + 0.2, y + 0.2, no, 0.38, 13)
        text(s, x + 0.7, y + 0.2, w - 0.9, 0.4, name, 16, True, anchor=MSO_ANCHOR.MIDDLE)
        for i, (pg, nm) in enumerate(items):
            yy = y + 0.74 + i * 0.32
            text(s, x + 0.3, yy, 0.9, 0.3, pg, 11.5, True, BLUE)
            text(s, x + 1.2, yy, w - 1.4, 0.3, nm, 11.5, False, INK)
    footer(s)


# ================================================================ 3. 소개
def intro():
    s = new_slide()
    header(s, "시작하기", "이 앱이 푸는 문제", [
        "장비 SW 팀이 매주 커밋 · 현장 대응 메모를 보고 양식 PPT 로 옮기는 반복 업무를 줄입니다",
        "요약에 측정하지 않은 숫자 · 효과(\"40% 단축\", \"수율 향상\")가 들어가지 않게 막습니다",
        "서버 · 설치 · 클라우드 계정 없이 브라우저에서 내 git log 파일만으로 동작합니다",
    ])
    cards = [
        ("주제로 묶기", "같은 주제 · 같은 현장 이슈 번호(FI-238, #123) 커밋을 묶고 모듈 · 설비 번호(3호기)를 붙입니다."),
        ("사실 검증", "숫자 · 소수 · 날짜, '세 배' '절반' 같은 글자 수량, 상태어, 효과어(수율 · 가동률 등)가 입력에 없으면 막습니다."),
        ("지난주 대비", "이어진 일 · 끝난 일 · 새 일을 나누고, 이어진 주제는 지난주 '왜' 메모를 이어받습니다."),
    ]
    for i, (hd, ds) in enumerate(cards):
        x = 0.5 + i * 4.19
        rbox(s, x, 2.45, 3.95, 1.95)
        num_circle(s, x + 0.2, 2.65, i + 1, 0.36)
        text(s, x + 0.68, 2.64, 3.1, 0.38, hd, 15, True, anchor=MSO_ANCHOR.MIDDLE)
        text(s, x + 0.25, 3.18, 3.5, 1.1, ds, 11, False, SUB)
    text(s, 0.5, 4.62, 6, 0.3, "커밋이 보고서가 되기까지", 13, True)
    flow = [
        ("git log", ["파일 놓기 · 붙여넣기", "공개 GitHub (선택)"]),
        ("주제 · 메모", ["영역 사전으로 묶기", "왜 · 상태 메모"]),
        ("요약 · 검증", ["규칙 요약 (기본)", "LLM 은 Shadow 칸"]),
        ("내보내기", ["PPTX · 내 양식", "Markdown · 복사"]),
    ]
    w, gap = 2.78, 0.4
    for i, (hd, ln) in enumerate(flow):
        x = 0.5 + i * (w + gap)
        hl = i == 2
        rbox(s, x, 5.0, w, 1.75, fill=WHITE if hl else CARD, line=BLUE if hl else None, radius=0.04, lw=2)
        text(s, x + 0.1, 5.1, w - 0.2, 0.4, hd, 14, True, BLUE if hl else INK, PP_ALIGN.CENTER)
        text(s, x + 0.1, 5.6, w - 0.2, 1.0, ln, 10.5, False, SUB, PP_ALIGN.CENTER)
        if i < 3:
            box(s, x + w + 0.06, 5.72, gap - 0.12, 0.34, fill=BLUE, shape=MSO_SHAPE.RIGHT_ARROW)


# ================================================================ 4. 설치
def install():
    s = new_slide()
    header(s, "시작하기", "열기 · 설치 · 첫 실행", [
        "웹 주소를 열면 바로 쓸 수 있고, 주소창의 설치 버튼으로 앱처럼 설치하면 오프라인에서도 동작",
        "처음 열면 합성 예시 4주 세트가 열리고, 맨 위에 3단계 안내가 나옴",
        "데이터는 이 브라우저(IndexedDB)에만 저장되고 자동 저장됨",
    ])
    steps_card(s, 0.5, CY, 6.6, CH, [
        ("열기", "웹 주소를 열거나, 저장소 폴더에서  python -m http.server 8732  후 http://localhost:8732"),
        ("설치 (선택)", "Edge · Chrome 주소창의 '앱 설치' 버튼. 설치하면 시작 메뉴에서 열리고 인터넷 없이도 동작"),
        ("예시로 둘러보기", "첫 화면은 합성 예시 4주 세트입니다. 주제를 눌러 메모 · 요약 · 검증을 살펴보세요"),
        ("내 데이터로", "'내 git log' 탭에서 로그 파일을 놓습니다 (6쪽)"),
    ], title="처음 순서", tip="첫 안내는 '알겠어요'로 닫으면 다시 나오지 않습니다", desc_size=10.5)
    shot_card(s, 7.3, CY, 5.53, CH, "모바일 폭에서도 같은 기능", "Mobile", [], dip=(390, 844))


# ================================================================ 본문
def screens():
    SEC1 = "시작하기"
    shot_steps(SEC1, "화면 구성", [
        "위에서 아래로 1 불러오기 → 2 주제 → 3 지난주 대비 → 4 현장 검증 → 5 내보내기 순서",
        "오른쪽 위: 언어(English/한국어) · 화면 밝기 · 도움말 · 설정",
        "내보내기 줄은 화면 아래에 붙어 있어 어디서든 슬라이드 수와 검증 통과 수를 볼 수 있음",
    ], "Main", R("Main", "guide", "tabs", "weeks", "topics", "export"), [
        ("첫 실행 안내", "3단계 안내. 닫으면 다시 나오지 않습니다"),
        ("불러오기 탭", "예시(합성) · 내 git log · 공개 GitHub 저장소"),
        ("주차", "커밋이 있는 주차. '편집함'은 이미 손댄 주차"),
        ("주제 목록", "주제마다 태그 · 설비 · 이슈 번호와 검증 상태"),
        ("내보내기 줄", "프로젝트 · 작성자, 슬라이드 수, 내보내기 버튼"),
    ], card_title="첫 화면")

    SEC2 = "보고서 만들기"
    shot_steps(SEC2, "커밋 불러오기", [
        "권장 명령의 출력 파일을 놓거나 붙여넣기. 일반 git log · --stat · --name-status · --numstat · --oneline 도 자동 인식",
        "읽지 못한 줄은 몇 번째 줄인지와 이유를 보여줌 (그림은 일부러 깨뜨린 합성 파일)",
        "다음 주에 새 로그를 놓으면 커밋을 해시로 합치고, 지난주 메모는 그대로 남음",
    ], "Import", R("Import", "drop", "cmd", "paste", "result"), [
        ("파일 놓기", "log.txt 를 끌어다 놓거나 [파일 선택]. 화면 어디에 놓아도 받습니다"),
        ("권장 명령", "[명령 복사] 후 저장소 폴더에서 실행해 log.txt 로 저장"),
        ("붙여넣기", "파일 대신 내용을 붙여넣고 [불러오기]"),
        ("읽은 결과", "형식 · 커밋 수 · 작성자 수와 읽지 못한 줄 목록"),
    ], tip="작성자 · 기간 필터는 결과 아래에 나옵니다. EUC-KR 파일은 자동으로 다시 읽어 봅니다",
        crop=U("Import", ["drop", "result"], 30))

    shot_steps(SEC2, "주제 · 메모 편집", [
        "주제마다 메모(왜 · 무엇을 · 상태)가 요약의 근거. 상태는 \"완료: …\" \"예정: …\" 형식이 배지가 됨",
        "커밋을 다른 주제로 옮기고, 주제를 합치거나(왼쪽 체크) 나눌 수 있음(커밋 체크)",
        "손대지 않은 규칙 요약은 메모를 바꾸면 따라 바뀜. 직접 고친 요약은 그대로 둠",
    ], "Editor", R("Editor", "topics", "domain", "commits", "memo", "decision", "shadow"), [
        ("주제 목록", "↑ ↓ 키로 이동. 체크한 주제는 [선택 합치기]"),
        ("설비 · 현장 이슈", "영역 사전 패턴으로 찾은 번호 (17쪽)"),
        ("커밋", "다른 주제로 이동, 체크해서 새 주제로 나누기"),
        ("메모", "왜 · 무엇을 · 상태 · 흐름도 카드"),
        ("보고서 요약", "제목 + 3줄. 규칙 기반 · 예시 · LLM 생성"),
        ("LLM 요약 (Shadow)", "옆 칸에만 보입니다 (15쪽)"),
    ], card_title="편집기 (합성: 카세트 매핑 · 1호기 · FI-245)", desc_size=9.5)

    shot_steps(SEC2, "사실 검증", [
        "요약의 숫자 · 날짜 · 소수, 글자 수량(세 배 · 절반), 상태어(완료 · 배포), 효과어(단축 · 수율 · 가동률)를 입력과 대조",
        "입력(커밋 제목 · 메모)에 없으면 막고, 막힌 표현을 노란색으로 표시하고 이유를 표로 보여줌",
        "숫자가 실제로 맞다면 메모에 적어 근거를 남기면 통과",
    ], "Shadow", R("Shadow", "decision", "marks", "blocked", "adopt"), [
        ("보고서 요약", "지금 보고서에 들어갈 요약과 검증 결과 (통과)"),
        ("막힌 표현", "LLM 이 쓴 '수율' '향상'은 입력에 없어 노란색"),
        ("막힌 이유", "표현마다 무엇이 문제인지와 이유"),
        ("채택 버튼", "검증을 통과한 요약만 누를 수 있습니다"),
    ], tip="그림의 LLM 요약은 앱에 들어 있는 '녹화한 합성 응답'입니다 (키 없이 재생)",
        card_title="검증 결과 (합성: 오토 포커스 · 46주차)")

    shot_steps(SEC2, "지난주 대비 · 설비/이슈 진척", [
        "바로 앞 주차와 비교해 이어진 일 · 끝난 일 · 이번 주 커밋 없음 · 새 일로 나눔",
        "이어진 일은 지난주 → 이번 주 상태를 보여주고, 이번 주에 완료로 바뀐 주제는 표시",
        "현장 이슈 · 설비 번호별 진척 표는 PPTX 에도 한 장으로 들어감",
    ], "Compare", R("Compare", "cont", "fin", "add", "domain"), [
        ("이어진 일", "같은 주제 이름이나 같은 이슈 번호"),
        ("끝난 일", "지난주 상태가 모두 완료 · 해결인 주제"),
        ("새 일", "이번 주에 처음 나온 주제"),
        ("설비 · 이슈 진척", "번호 · 주제 · 설비 · 상태"),
    ], crop=U("Compare", ["cmp", "domain"], 24))


def export_pages():
    SEC = "내보내기"
    shot_steps(SEC, "미리보기 · 내보내기", [
        "슬라이드 미리보기는 PPTX 와 같은 배치값으로 그림 (제목 · 3줄 · 상태 배지 · 흐름도 카드)",
        "검증에 실패한 주제가 있으면 내보내기 전에 한 번 더 묻습니다",
        "PPTX · 내 양식 PPTX · Markdown 저장 · Markdown 복사 (메일 · 메신저 붙여넣기용)",
    ], "Preview", R("Preview", "preview", "stats", "buttons"), [
        ("슬라이드 미리보기", "강조색 · 흐름도 카드 설정이 그대로 반영"),
        ("슬라이드 수", "표지 · 지난주 대비 · 진척 표 · 구역 · 내용 · 끝"),
        ("내보내기 버튼", "내 양식 버튼은 양식을 올리면 나타납니다"),
    ], card_title="미리보기와 내보내기 줄")

    s = new_slide()
    header(s, SEC, "PPTX 결과 (기본 양식)", [
        "표지 → 지난주 대비 → 설비 · 현장 이슈 진척 → 구역 간지 → 주제별 내용 → 끝 순서",
        "내용 슬라이드: 태그 + 제목, 요약 3줄, 상태 배지, 설비 · 이슈 번호, 흐름도 카드",
        "강조색 · 글꼴 · 표지 제목 · 바닥글과 각 슬라이드 종류는 설정 › PPTX 양식에서 바꿈",
    ])
    imgs = [("표지", "PptxCover"), ("지난주 대비", "PptxCompare"), ("설비 · 현장 이슈 진척", "PptxDomain"), ("내용", "PptxContent")]
    for i, (t, n) in enumerate(imgs):
        x, y = 0.5 + (i % 2) * 6.25, 2.45 + (i // 2) * 2.3
        rbox(s, x, y, 6.08, 2.2)
        text(s, x + 0.15, y + 0.06, 3, 0.3, t, 11.5, True)
        ih = 1.75
        iw = ih * 16 / 9
        box(s, x + 0.15 - 0.02, y + 0.38 - 0.02, iw + 0.04, ih + 0.04, fill=WHITE, line=LINE)
        s.shapes.add_picture(os.path.join(SHOTS, n + ".png"), Inches(x + 0.15), Inches(y + 0.38), Inches(iw), Inches(ih))

    s = new_slide()
    header(s, SEC, "내 PPTX 양식 채우기", [
        "내 양식 슬라이드에 {{title}} {{line1}} {{line2}} {{line3}} {{status}} 같은 자리표시자를 넣고 올림",
        "{{title}} 이나 {{line1}} 이 있는 첫 슬라이드를 내지로 보고 주제 수만큼 복제해 채움",
        "표지 등 다른 슬라이드의 {{project}} {{week}} {{range}} {{author}} {{date}} {{footer}} 도 채움",
    ])
    shot_card(s, LX, CY, 6.1, CH, "설정 › PPTX 양식", "SettingsStyle", R("SettingsStyle", "accent", "toggles", "tplRow"),
              crop=U("SettingsStyle", ["accent", "tplRow"], 40, 395, 1045))
    rbox(s, 6.75, CY, 6.08, CH)
    text(s, 6.9, CY + 0.1, 5.8, 0.32, "결과 예 (자리표시자 예시 양식을 채운 내지)", 13, True)
    ih = 2.6
    iw = ih * 16 / 9
    box(s, 6.9 - 0.02, CY + 0.55 - 0.02, min(iw, 5.78) + 0.04, ih + 0.04, fill=WHITE, line=LINE)
    s.shapes.add_picture(os.path.join(SHOTS, "PptxTemplate.png"), Inches(6.9), Inches(CY + 0.55), Inches(min(iw, 5.78)), Inches(ih * min(iw, 5.78) / iw))
    text(s, 6.95, CY + 3.35, 5.75, 1.0, [
        "①  강조색 · 글꼴 · 표지 제목 · 바닥글 (기본 양식용)",
        "②  구역 간지 · 흐름도 카드 · 지난주 대비 · 설비 · 이슈 표 켜고 끄기",
        "③  [양식 올리기] · [자리표시자 예시 양식 받기]",
    ], 10.5, False, SUB, spacing=1.2)


def verify_pages():
    SEC = "현장 검증 절차"
    s = new_slide()
    header(s, SEC, "현장 검증 절차 4단계", [
        "재현 → 비교 → Shadow → 전환 · 롤백: 같은 데이터로 확인하고, 새 방법(LLM)은 옆에서 먼저 돌려 보고, 언제든 되돌림",
        "키 없이도 '녹화 LLM 응답 재생'으로 4단계를 모두 확인할 수 있음 (합성 응답 16건 중 8건이 숫자 · 효과를 지어냄)",
        "내 주차를 라벨을 붙여 재현 세트로 저장하면, 설정을 바꿀 때 그 세트로도 비교함",
    ])
    shot_card(s, 0.5, CY, 12.33, CH, "4. 현장 검증 절차 패널", "Verify", R("Verify", "s1", "s2", "s3", "s4"),
              crop=U("Verify", ["s1", "s4"], 16))

    shot_steps(SEC, "바꾸기 전 비교", [
        "영역 사전 · 보고서 언어를 바꾸고 [저장]하면 바로 적용하지 않고 비교 창을 먼저 띄움",
        "같은 주차의 주제와 저장한 재현 세트에 대해 지금 / 새 설정 결과를 나란히, 바뀐 칸만 노란색",
        "[적용]하면 변경 이력에 남고, 4단계의 [직전 설정으로 되돌리기]로 한 번에 되돌림",
    ], "CompareDialog", R("CompareDialog", "sum", "table", "diff", "apply"), [
        ("바뀐 항목 수", "같은 데이터에서 결과가 달라지는 칸의 수"),
        ("전 / 후 표", "구역 · 태그, 설비 · 이슈, 검증 결과"),
        ("바뀐 칸", "그림: 설비 패턴에 이슈 번호를 넣으면 설비 칸이 바뀜"),
        ("적용", "적용 전에는 아무것도 바뀌지 않습니다"),
    ], card_title="바꾸기 전 비교 창", crop=U("CompareDialog", ["sum", "apply"], 30))

    s = new_slide()
    header(s, SEC, "Shadow · 전환 · 롤백", [
        "LLM 요약은 Shadow 칸에만 나오고 결정은 규칙 · 사람이 함. 검증에 막힌 경우가 Shadow 기록에 쌓임",
        "기록 10건 이상 · 통과율 80% 이상이면 [LLM 채택으로 전환]이 켜짐. 그림은 통과율 50% 라 꺼져 있음",
        "전환 뒤에도 통과한 LLM 요약만 채택하고, 실패하면 규칙 요약. 되돌리면 전환 전 요약으로 돌아감",
    ])
    shot_card(s, LX, CY, 6.6, CH, "3 Shadow · 4 전환 · 롤백", "Verify", R("Verify", "s3", "s4"), crop=U("Verify", ["s3", "s4"], 12))
    steps_card(s, 7.25, CY, 5.58, CH, [
        ("Shadow 기록", "LLM 결과마다 통과 / 막힘, 막힌 표현과 종류(num · numword · status · effect)"),
        ("전환 기준", "기록 10건 이상, 통과율 80% 이상. 미달이면 이유가 버튼 아래에 나옵니다"),
        ("전환 뒤", "통과한 요약은 자동 채택, 실패하면 '규칙 기반 (LLM 검증 실패 대체)'"),
        ("되돌리기", "직전 설정 · 결정 방식과 전환 전 요약으로. 이력은 지우지 않습니다"),
    ], title="동작", desc_size=10)


def settings_pages():
    SEC = "설정 · 부록"
    s = new_slide()
    header(s, SEC, "LLM 키 · 개인정보", [
        "LLM 은 선택. 키가 없어도 규칙 요약 · 검증 · 내보내기 · 녹화 응답 재생이 모두 동작",
        "Anthropic API 키는 페이지 메모리에만 두고 저장하지 않음 (새로고침하면 사라짐). 로컬 Ollama 도 가능",
        "보내기 전 실제 요청을 보여주고, 메일 · IP · URL · 경로와 지정한 단어를 [M1] 처럼 가림",
    ])
    shot_card(s, LX, CY, 6.1, CH, "설정 › LLM", "SettingsLLM", R("SettingsLLM", "provider", "key", "model", "mask", "preview"),
              crop=U("SettingsLLM", ["provider", "preview"], 40, 395, 1045))
    shot_card(s, 6.75, CY, 6.08, CH, "LLM 에 보낼 내용 (가린 뒤)", "Send", R("Send", "text", "ok"), crop=U("Send", ["sub", "ok"], 24))

    shot_steps(SEC, "영역 사전 · 검증 설정", [
        "모듈 규칙: 파일 경로 접두어(match)와, 파일 목록이 없을 때 쓰는 제목 단어(words)",
        "설비 번호 · 현장 이슈 번호 패턴(정규식). 같은 이슈 번호 커밋은 한 주제로 묶임",
        "보고서 언어를 English 로 바꾸면 영어 검증 규칙(줄 길이 · 영어 상태어 · 효과어)을 씀",
    ], "SettingsDict", R("SettingsDict", "lang", "group", "equip", "issue", "rules"), [
        ("보고서 언어", "한국어 / English 검증 규칙"),
        ("구역 나누기", "모듈별 또는 설비별"),
        ("설비 번호", "예: (?<!\\d)\\d{1,2}호기 · EQ-03"),
        ("현장 이슈 번호", "예: FI-238 · #123 · PRJ-1042"),
        ("모듈 규칙 (JSON)", "match · words · tag · section, fallback · order"),
    ], tip="잘못된 정규식 · JSON 은 저장하지 않고 이유를 보여줍니다", card_title="설정 › 영역 사전 · 검증",
        crop=U("SettingsDict", ["lang", "rules"], 40, 395, 1045))

    s = new_slide()
    header(s, SEC, "내 데이터 형식 · 오류 메시지", [
        "어떤 형식인지 자동으로 알아내고, 읽은 형식 · 커밋 수 · 작성자 수를 보여줌",
        "읽지 못한 줄은 'N번째 줄'과 이유로 보여주고, 읽은 커밋은 그대로 씀",
        "--oneline 처럼 날짜가 없는 형식은 정한 날짜의 주차로 묶음",
    ])
    rows = [
        ("앱 권장 형식", "git log --date=short --name-only --format=\"@@%h|%ad|%an|%s\"", "작성자 · 날짜 · 파일 모두"),
        ("일반 git log", "git log  (--stat · --name-only · --name-status · --numstat 가능)", "Merge 커밋은 건너뜀"),
        ("--oneline", "git log --oneline", "날짜 없음 → 날짜 지정 필요"),
        ("GitHub", "공개 저장소 owner/name", "시간당 60회 제한"),
    ]
    rbox(s, 0.5, CY, 6.6, CH)
    text(s, 0.65, CY + 0.1, 6.3, 0.32, "읽는 형식", 13, True)
    for i, (a, b, c) in enumerate(rows):
        y = CY + 0.6 + i * 0.95
        text(s, 0.7, y, 2.0, 0.3, a, 12, True, BLUE)
        text(s, 0.7, y + 0.3, 6.2, 0.3, b, 9.5, False, INK, font=MONO)
        text(s, 0.7, y + 0.58, 6.2, 0.3, c, 10, False, SUB)
    errs = [
        ("해시가 16진수가 아닙니다", "@@ 뒤 첫 칸이 커밋 해시인지 확인"),
        ("날짜를 읽을 수 없습니다", "--date=short 또는 iso 로 다시 저장"),
        ("상대 날짜 ('3 days ago')", "--date=short 를 붙여 다시 저장"),
        ("커밋 머리줄 앞에 있는 줄", "파일 앞부분의 다른 출력을 지우기"),
        ("Date 줄이 없는 커밋", "--pretty 를 바꿨다면 기본 형식으로"),
        ("git log 형식을 찾지 못함", "권장 명령의 출력인지 확인"),
    ]
    rbox(s, 7.3, CY, 5.53, CH)
    text(s, 7.45, CY + 0.1, 5.3, 0.32, "오류 메시지와 해결", 13, True)
    for i, (a, b) in enumerate(errs):
        y = CY + 0.6 + i * 0.62
        text(s, 7.5, y, 5.2, 0.3, a, 11.5, True)
        text(s, 7.5, y + 0.28, 5.2, 0.3, b, 10, False, SUB)

    s = new_slide()
    header(s, SEC, "데이터 · 화면 옵션", [
        "백업(JSON) 내보내기 · 가져오기로 다른 브라우저로 옮김. [모든 데이터 지우기]는 되돌릴 수 없음",
        "앱 오류는 이 브라우저에만 기록되고 밖으로 보내지 않음 (설정 › 데이터 · 오류에서 보기 · 받기)",
        "한국어 / English 전환, 다크 모드(시스템 설정 또는 달 버튼), 모바일 폭, 키보드 조작 지원",
    ])
    shot_card(s, 0.5, CY, 4.0, CH, "설정 › 데이터 · 오류", "SettingsData", R("SettingsData", "backup", "reset", "errors"),
              crop=U("SettingsData", ["backup", "errors"], 40, 395, 1045))
    shot_card(s, 4.67, CY, 4.0, CH, "English (영어 검증 규칙)", "English", R("English", "blocked"), crop=U("English", ["shadow"], 16))
    shot_card(s, 8.83, CY, 4.0, CH, "다크 모드", "Dark", [], crop=(430, 60, 1440, 700))


def faq():
    s = new_slide()
    header(s, "설정 · 부록", "FAQ · 문제 해결", [
        "앱 안의 [도움말]에 같은 내용이 한국어 · 영어로 있음",
        "데이터는 브라우저에만 있으므로, 브라우저 데이터를 지우면 함께 지워짐 (백업 권장)",
        "개인정보 안내: 화면 맨 아래 '개인정보 · 데이터 안내'",
    ])
    qa = [
        ("맞는 숫자인데 막혀요", "그 숫자를 메모(왜 · 상태)에 적으세요. 입력에 있는 숫자는 통과합니다."),
        ("요약이 메모를 따라 안 바뀌어요", "요약을 직접 고쳤기 때문입니다. [규칙 기반]을 누르면 다시 따라갑니다."),
        ("다음 주에 새 로그를 넣으면 메모가 사라지나요", "아니요. 커밋을 해시로 합치고 편집한 주차는 그대로 둡니다."),
        ("다른 프로젝트를 시작하려면", "설정 › 데이터에서 백업 후 [모든 데이터 지우기]."),
        ("Ollama 에 연결이 안 돼요", "Ollama 를 실행하고 이 사이트 주소를 OLLAMA_ORIGINS 에 넣어 다시 시작하세요."),
        ("LLM 채택으로 전환이 안 켜져요", "Shadow 기록 10건 이상, 통과율 80% 이상이어야 합니다. 이유가 버튼 아래에 나옵니다."),
    ]
    cw, ch = 6.05, 1.32
    for i, (q, a) in enumerate(qa):
        col, row = i % 2, i // 2
        x = 0.5 + col * (cw + 0.23)
        y = CY + row * (ch + 0.13)
        rbox(s, x, y, cw, ch)
        text(s, x + 0.15, y + 0.1, 0.4, 0.32, "Q", 13, True, BLUE)
        text(s, x + 0.5, y + 0.1, cw - 0.65, 0.32, q, 12, True)
        text(s, x + 0.5, y + 0.48, cw - 0.65, 0.8, a, 10.5, False, SUB)


def back():
    s = new_slide()
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = NAVY
    box(s, 0, 0, 0.35, 7.5, fill=BLUE)
    s.shapes.add_picture(os.path.join(ASSETS, "icon.png"), Inches(6.2), Inches(1.6), Inches(0.9), Inches(0.9))
    text(s, 0, 2.8, 13.333, 0.6, APP, 30, True, WHITE, PP_ALIGN.CENTER)
    text(s, 0, 3.45, 13.333, 0.4, "Weekly Report Builder", 14, False, RGBColor(0xC9, 0xC9, 0xC9), PP_ALIGN.CENTER)
    text(s, 0, 4.4, 13.333, 0.9, [
        "PptxGenJS 4.0.1 (MIT) · JSZip (MIT) · Anthropic TypeScript SDK 1.6.0 (MIT) · Pretendard 1.3.9 (SIL OFL 1.1)",
        "화면의 데이터는 모두 가상 프로젝트 SpotCheck 의 합성 데이터입니다",
    ], 10.5, False, RGBColor(0x9A, 0x9A, 0x9A), PP_ALIGN.CENTER, spacing=1.3)
    text(s, 0, 6.5, 13.333, 0.3, f"v{VERSION}   ·   {DATE}   ·   만든 사람 배민혁   ·   MIT License", 10, False,
         RGBColor(0x8A, 0x8A, 0x8A), PP_ALIGN.CENTER)


def to_pdf(pptx, pdf):
    ps = ("$pp = New-Object -ComObject PowerPoint.Application; "
          f"$p = $pp.Presentations.Open('{pptx}', $true, $false, $false); "
          f"$p.SaveAs('{pdf}', 32); $n = $p.Slides.Count; $p.Close(); $pp.Quit(); $n")
    n = subprocess.run(["powershell", "-NoProfile", "-Command", ps], capture_output=True, text=True, check=True).stdout.strip()
    print("pdf", pdf, "slides", n)


def main():
    cover()          # 1
    toc()            # 2
    intro()          # 3
    install()        # 4
    screens()        # 5–9
    export_pages()   # 10–12
    verify_pages()   # 13–15
    settings_pages()  # 16–19
    faq()            # 20
    back()           # 21
    assert state["n"] == TOTAL, state["n"]
    prs.save(OUT)
    print("saved", OUT)
    if "--pdf" in sys.argv:
        to_pdf(OUT, OUT.replace(".pptx", ".pdf"))


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
