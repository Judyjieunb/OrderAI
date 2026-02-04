#!/usr/bin/env python3
"""
Claude Code SessionEnd Hook: 세션 종료 시 작업 요약을 Teams 채널에 게시합니다.

동작 흐름:
1. stdin으로 세션 메타데이터(session_id, transcript_path 등) 수신
2. transcript JSONL 파싱 → 사용자/어시스턴트 메시지 + 수정된 파일 추출
3. Claude Haiku API → 한국어 작업 요약 생성
4. Teams Webhook → Adaptive Card POST
"""

import json
import sys
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

# 프로젝트 루트의 .env 로드
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass  # dotenv 없으면 환경변수에서 직접 읽기


def parse_transcript(transcript_path: str) -> dict:
    """JSONL 트랜스크립트를 파싱하여 대화 내용과 수정된 파일 목록을 추출합니다."""
    user_messages = []
    assistant_texts = []
    modified_files = set()

    with open(transcript_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue

            entry_type = entry.get("type")

            if entry_type == "user":
                content = entry.get("message", {}).get("content", "")
                if isinstance(content, str) and content.strip():
                    user_messages.append(content.strip())
                elif isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            text = block.get("text", "").strip()
                            if text:
                                user_messages.append(text)

            elif entry_type == "assistant":
                content_blocks = entry.get("message", {}).get("content", [])
                if isinstance(content_blocks, list):
                    for block in content_blocks:
                        if not isinstance(block, dict):
                            continue

                        if block.get("type") == "text":
                            text = block.get("text", "").strip()
                            if text:
                                assistant_texts.append(text)

                        elif block.get("type") == "tool_use":
                            name = block.get("name", "")
                            inp = block.get("input", {})
                            if name in ("Write", "Edit") and "file_path" in inp:
                                file_path = inp["file_path"]
                                # 프로젝트 상대 경로로 변환
                                try:
                                    rel = os.path.relpath(file_path, str(PROJECT_ROOT))
                                    if not rel.startswith(".."):
                                        modified_files.add(rel)
                                    else:
                                        modified_files.add(file_path)
                                except ValueError:
                                    modified_files.add(file_path)

    return {
        "user_messages": user_messages,
        "assistant_texts": assistant_texts,
        "modified_files": sorted(modified_files),
    }


def build_conversation_summary_text(parsed: dict) -> str:
    """Haiku에 전달할 대화 컨텍스트 텍스트를 구성합니다."""
    parts = []

    parts.append("=== 사용자 메시지 ===")
    for i, msg in enumerate(parsed["user_messages"], 1):
        # 각 메시지를 300자로 제한
        truncated = msg[:300] + "..." if len(msg) > 300 else msg
        parts.append(f"[{i}] {truncated}")

    parts.append("\n=== Claude 응답 (요약용) ===")
    for i, text in enumerate(parsed["assistant_texts"][:20], 1):
        truncated = text[:500] + "..." if len(text) > 500 else text
        parts.append(f"[{i}] {truncated}")

    if parsed["modified_files"]:
        parts.append("\n=== 수정된 파일 ===")
        for f in parsed["modified_files"]:
            parts.append(f"- {f}")

    return "\n".join(parts)


def summarize_with_haiku(conversation_text: str) -> str:
    """Claude Haiku API를 호출하여 한국어 작업 요약을 생성합니다."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=api_key)

        # 입력 텍스트를 적절히 제한 (Haiku 컨텍스트 효율)
        if len(conversation_text) > 8000:
            conversation_text = conversation_text[:8000] + "\n\n... (이하 생략)"

        response = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=800,
            messages=[
                {
                    "role": "user",
                    "content": f"""다음은 Claude Code 세션의 대화 기록과 수정된 파일 목록입니다.
이 세션에서 수행한 작업을 업무 성과 보고서 형태로 한국어 요약해 주세요.

요구사항:
- bullet point 형식 (각 항목 "- "로 시작)
- 5~8개 항목
- 각 작업을 구체적인 기술 용어와 함께 서술 (예: "파이프라인 구축", "아키텍처 설계", "폴백 로직 구현")
- 단순 파일 수정이 아니라 해당 작업의 목적과 기술적 의사결정을 포함
- 문제 해결 과정이 있으면 "이슈 분석 → 원인 파악 → 해결" 흐름으로 서술
- 수정된 파일은 괄호 안에 표기 (예: "~~를 구현 (post_session_summary.py)")
- 마지막 항목에 전체 작업의 비즈니스 임팩트 또는 효과를 한 줄로 정리

작성 톤: 개발 업무일지 / 주간 성과 보고서

{conversation_text}"""
                }
            ],
        )

        return response.content[0].text.strip()

    except Exception as e:
        print(f"Haiku API error: {e}", file=sys.stderr)
        return None


def summarize_with_openai(conversation_text: str) -> str:
    """OpenAI API를 호출하여 한국어 작업 요약을 생성합니다. (Haiku 실패 시 폴백)"""
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return None

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)

        if len(conversation_text) > 8000:
            conversation_text = conversation_text[:8000] + "\n\n... (이하 생략)"

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=800,
            messages=[
                {
                    "role": "user",
                    "content": f"""다음은 Claude Code 세션의 대화 기록과 수정된 파일 목록입니다.
이 세션에서 수행한 작업을 업무 성과 보고서 형태로 한국어 요약해 주세요.

요구사항:
- bullet point 형식 (각 항목 "- "로 시작)
- 5~8개 항목
- 각 작업을 구체적인 기술 용어와 함께 서술 (예: "파이프라인 구축", "아키텍처 설계", "폴백 로직 구현")
- 단순 파일 수정이 아니라 해당 작업의 목적과 기술적 의사결정을 포함
- 문제 해결 과정이 있으면 "이슈 분석 → 원인 파악 → 해결" 흐름으로 서술
- 수정된 파일은 괄호 안에 표기 (예: "~~를 구현 (post_session_summary.py)")
- 마지막 항목에 전체 작업의 비즈니스 임팩트 또는 효과를 한 줄로 정리

작성 톤: 개발 업무일지 / 주간 성과 보고서

{conversation_text}"""
                }
            ],
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        print(f"OpenAI API error: {e}", file=sys.stderr)
        return None


def fallback_summary(parsed: dict) -> str:
    """API 키가 없거나 API 실패 시 룰 기반 폴백 요약을 생성합니다."""
    lines = []
    lines.append(f"- 사용자 메시지 {len(parsed['user_messages'])}건, Claude 응답 {len(parsed['assistant_texts'])}건")

    if parsed["modified_files"]:
        lines.append(f"- 수정된 파일 {len(parsed['modified_files'])}개:")
        for f in parsed["modified_files"][:5]:
            lines.append(f"  - {f}")
        if len(parsed["modified_files"]) > 5:
            lines.append(f"  - ... 외 {len(parsed['modified_files']) - 5}개")

    # 첫 번째 사용자 메시지로 주제 추정
    if parsed["user_messages"]:
        first_msg = parsed["user_messages"][0][:100]
        lines.append(f"- 시작 주제: {first_msg}")

    return "\n".join(lines)


def post_to_teams(webhook_url: str, summary: str, session_id: str, cwd: str, modified_files: list):
    """Teams Webhook으로 Adaptive Card를 전송합니다."""
    import requests

    kst = timezone(timedelta(hours=9))
    now_kst = datetime.now(kst).strftime("%Y-%m-%d %H:%M KST")

    # 수정된 파일 목록 텍스트
    files_text = ""
    if modified_files:
        file_items = [f"- {f}" for f in modified_files[:10]]
        if len(modified_files) > 10:
            file_items.append(f"- ... 외 {len(modified_files) - 10}개")
        files_text = "\n".join(file_items)

    # Adaptive Card payload (Teams Workflow webhook 형식)
    card_payload = {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "content": {
                    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                    "type": "AdaptiveCard",
                    "version": "1.4",
                    "msteams": {"width": "Full"},
                    "body": [
                        {
                            "type": "TextBlock",
                            "text": "Claude Code Session Summary",
                            "weight": "Bolder",
                            "size": "Medium",
                            "color": "Accent",
                        },
                        {
                            "type": "FactSet",
                            "facts": [
                                {"title": "Session", "value": session_id[:8] + "..."},
                                {"title": "Project", "value": os.path.basename(cwd)},
                                {"title": "Time", "value": now_kst},
                            ],
                        },
                        {
                            "type": "TextBlock",
                            "text": "**Work Summary**",
                            "weight": "Bolder",
                            "spacing": "Medium",
                        },
                        {
                            "type": "TextBlock",
                            "text": summary,
                            "wrap": True,
                        },
                    ],
                },
            }
        ],
    }

    # 수정된 파일 섹션 추가
    if files_text:
        card_body = card_payload["attachments"][0]["content"]["body"]
        card_body.append({
            "type": "TextBlock",
            "text": "**Modified Files**",
            "weight": "Bolder",
            "spacing": "Medium",
        })
        card_body.append({
            "type": "TextBlock",
            "text": files_text,
            "wrap": True,
            "fontType": "Monospace",
            "size": "Small",
        })

    resp = requests.post(
        webhook_url,
        json=card_payload,
        headers={"Content-Type": "application/json"},
        timeout=10,
    )
    resp.raise_for_status()


def main():
    # stdin에서 세션 메타데이터 읽기
    try:
        stdin_data = sys.stdin.read()
        meta = json.loads(stdin_data)
    except (json.JSONDecodeError, Exception) as e:
        print(f"Failed to parse stdin: {e}", file=sys.stderr)
        sys.exit(0)  # 훅 실패가 세션 종료를 막으면 안 됨

    session_id = meta.get("session_id", "unknown")
    transcript_path = meta.get("transcript_path", "")
    cwd = meta.get("cwd", str(PROJECT_ROOT))

    # transcript 파일 존재 확인
    if not transcript_path or not os.path.isfile(transcript_path):
        print(f"Transcript not found: {transcript_path}", file=sys.stderr)
        sys.exit(0)

    # Teams webhook URL 확인
    webhook_url = os.environ.get("TEAMS_WEBHOOK_URL", "").strip()
    if not webhook_url:
        print("TEAMS_WEBHOOK_URL not set, skipping Teams post", file=sys.stderr)
        sys.exit(0)

    # 트랜스크립트 파싱
    parsed = parse_transcript(transcript_path)

    # 스킵 조건: 사용자 메시지 3개 미만
    if len(parsed["user_messages"]) < 3:
        print("Session too short (< 3 user messages), skipping", file=sys.stderr)
        sys.exit(0)

    # AI 요약 생성 (Haiku → OpenAI → 룰 기반 폴백)
    conversation_text = build_conversation_summary_text(parsed)
    summary = summarize_with_haiku(conversation_text)

    if not summary:
        summary = summarize_with_openai(conversation_text)

    if not summary:
        summary = fallback_summary(parsed)

    # Teams에 게시
    try:
        post_to_teams(webhook_url, summary, session_id, cwd, parsed["modified_files"])
        print("Successfully posted session summary to Teams", file=sys.stderr)
    except Exception as e:
        print(f"Failed to post to Teams: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
