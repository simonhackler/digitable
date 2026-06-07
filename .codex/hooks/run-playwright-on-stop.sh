#!/usr/bin/env bash
set -u

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(git -C "$script_dir" rev-parse --show-toplevel 2>/dev/null || (cd "$script_dir/../.." && pwd))"
log_dir="$repo_root/test-results/codex-stop-hook"
log_file="$log_dir/latest.log"
debug_log="${TMPDIR:-/tmp}/codex-stop-hook-debug.log"

json_string() {
	jq -Rs .
}

block_with_reason() {
	local reason="$1"
	printf '{"decision":"block","reason":%s}\n' "$(printf '%s' "$reason" | json_string)"
}

write_debug_log() {
	local decision="$1"

	{
		printf 'Codex Stop hook debug\n'
		printf 'Started: '
		date -Is
		printf 'Script: %s\n' "$0"
		printf 'Repository: %s\n' "$repo_root"
		printf 'Payload read status: %s\n' "$payload_read_status"
		printf 'Payload bytes: %s\n' "${#payload}"
		printf 'JSON parse ok: %s\n' "$json_parse_ok"
		printf 'permission_mode: %s\n' "${permission_mode:-<empty>}"
		printf 'turn_id: %s\n' "${turn_id:-<empty>}"
		printf 'transcript_path: %s\n' "${transcript_path:-<empty>}"
		printf 'transcript lookup: %s\n' "$transcript_lookup_status"
		printf 'transcript mode: %s\n' "${transcript_mode:-<empty>}"
		printf 'Decision: %s\n\n' "$decision"
	} >>"$debug_log" 2>/dev/null || true
}

read_hook_payload() {
	payload="$(timeout 1s cat 2>/dev/null)"
	case "$?" in
		0) payload_read_status="complete" ;;
		124) payload_read_status="timeout" ;;
		*) payload_read_status="error" ;;
	esac
}

find_transcript_path() {
	if [ -n "$transcript_path" ]; then
		return 0
	fi

	if [ -z "${CODEX_THREAD_ID:-}" ]; then
		return 0
	fi

	transcript_path="$(
		find "${CODEX_HOME:-$HOME/.codex}/sessions" \
			-type f \
			-name "*${CODEX_THREAD_ID}.jsonl" \
			-print \
			-quit 2>/dev/null
	)"
}

read_transcript_mode() {
	transcript_mode=""
	transcript_lookup_status="not-started"

	if [ -z "$turn_id" ]; then
		transcript_lookup_status="missing-turn-id"
		return 0
	fi

	find_transcript_path

	if [ -z "$transcript_path" ]; then
		transcript_lookup_status="missing-transcript-path"
		return 0
	fi

	if [ ! -r "$transcript_path" ]; then
		transcript_lookup_status="unreadable-transcript"
		return 0
	fi

	transcript_mode="$(
		jq -r --arg turn_id "$turn_id" '
			select(
				(.type == "event_msg"
					and .payload.type == "task_started"
					and .payload.turn_id == $turn_id)
				or (.type == "turn_context"
					and .payload.turn_id == $turn_id)
			)
			| .payload.collaboration_mode_kind
				// .payload.collaboration_mode.mode
				// empty
		' "$transcript_path" 2>/dev/null | tail -n 1
	)"

	if [ -n "$transcript_mode" ]; then
		transcript_lookup_status="found"
	else
		transcript_lookup_status="mode-not-found"
	fi
}

mkdir -p "$log_dir"

turn_id=""
transcript_path=""
transcript_mode=""
transcript_lookup_status="not-started"
payload_read_status="not-started"
read_hook_payload
json_parse_ok=true
permission_mode="$(printf '%s' "$payload" | jq -r '.permission_mode // .permissionMode // empty' 2>/dev/null)" || {
	json_parse_ok=false
	permission_mode=""
}
turn_id="$(printf '%s' "$payload" | jq -r '.turn_id // .turnId // empty' 2>/dev/null)" || turn_id=""
transcript_path="$(printf '%s' "$payload" | jq -r '.transcript_path // .transcriptPath // empty' 2>/dev/null)" || transcript_path=""

if [ "$permission_mode" = "plan" ]; then
	write_debug_log "allow plan mode"
	printf '{"continue":true}\n'
	exit 0
fi

if [ -z "$permission_mode" ]; then
	write_debug_log "allow missing permission mode"
	printf '{"continue":true}\n'
	exit 0
fi

read_transcript_mode

if [ "$transcript_mode" = "plan" ]; then
	write_debug_log "allow transcript plan mode"
	printf '{"continue":true}\n'
	exit 0
fi

if [ -z "$transcript_mode" ]; then
	write_debug_log "allow missing transcript mode"
	printf '{"continue":true}\n'
	exit 0
fi

write_debug_log "run validation"

{
	printf 'Codex Stop hook Playwright run\n'
	printf 'Started: '
	date -Is
	printf 'Repository: %s\n' "$repo_root"
	printf 'Command: devenv shell -- bun run playwright test\n\n'
} >"$log_file"

if ! cd "$repo_root"; then
	block_with_reason "Could not change to repo root: $repo_root"
	exit 0
fi

if devenv shell -- bun run playwright test >>"$log_file" 2>&1; then
	printf '{"continue":true}\n'
	exit 0
fi

tail_output="$(tail -n 80 "$log_file")"
block_with_reason "A Playwright test broke because of adding new functionality.

Fix it by reducing and simplifying both the newly added code and the relevant old code. Do not fix it by adding more code, workarounds, waits, mocks, or special cases unless the simpler design has been exhausted.

Log: $log_file

Last 80 log lines:
$tail_output"
