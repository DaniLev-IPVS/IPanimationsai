#!/usr/bin/env python3
"""
IP Animations studio tracker for ComfyUI.

Leave this running next to ComfyUI. It reports each finished run to the studio
dashboard so its BytePlus spend lands on the right project and video.

    python3 comfy-tracker.py --token YOUR_TOKEN

Your token is in Studio > Settings > ComfyUI.

Save your videos under Project/Video/name, for example set a save node's
filename_prefix to:   Wooshi/Episode 3/shot

No need to install anything. Only run ids, times, workflow names and output
file names are sent: never prompts, media or API keys.
"""
import argparse
import json
import re
import time
import urllib.error
import urllib.request

TASK_ID = re.compile(r"\bcgt-[A-Za-z0-9-]+")


def get_json(url):
    with urllib.request.urlopen(url, timeout=15) as res:
        return json.load(res)


def post_json(url, token, payload):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + token,
            "User-Agent": "ipa-comfy-tracker/1",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def timestamp(messages, *names):
    for name, data in messages:
        if name in names and isinstance(data, dict) and data.get("timestamp"):
            return data["timestamp"]
    return None


def summarise(prompt_id, entry):
    """One /history entry reduced to what the dashboard needs."""
    status = entry.get("status") or {}
    if not status.get("completed") and status.get("status_str") != "error":
        return None
    messages = status.get("messages") or []
    started = timestamp(messages, "execution_start")
    ended = timestamp(messages, "execution_success", "execution_error", "execution_interrupted")
    if not started:
        return None

    prompt = entry.get("prompt") or []
    graph = prompt[2] if len(prompt) > 2 and isinstance(prompt[2], dict) else {}
    extra = prompt[3] if len(prompt) > 3 and isinstance(prompt[3], dict) else {}

    prefixes = [
        node["inputs"]["filename_prefix"]
        for node in graph.values()
        if isinstance(node, dict)
        and isinstance(node.get("inputs"), dict)
        and isinstance(node["inputs"].get("filename_prefix"), str)
    ]
    prefix = next((p for p in prefixes if "/" in p or "\\" in p), prefixes[0] if prefixes else None)

    files = []
    for node_output in (entry.get("outputs") or {}).values():
        if not isinstance(node_output, dict):
            continue
        for items in node_output.values():
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, dict) and item.get("filename"):
                        files.append("/".join(p for p in (item.get("subfolder"), item["filename"]) if p))

    pnginfo = extra.get("extra_pnginfo") or {}
    workflow = pnginfo.get("workflow") if isinstance(pnginfo, dict) else None
    extra_meta = workflow.get("extra") if isinstance(workflow, dict) else None
    name = extra_meta.get("title") if isinstance(extra_meta, dict) else None

    # Some BytePlus nodes print the task id into their output or history.
    task_ids = sorted(set(TASK_ID.findall(json.dumps(entry.get("outputs") or {}) + json.dumps(messages))))

    return {
        "prompt_id": prompt_id,
        "workflow": name,
        "filename_prefix": prefix,
        "started_at": started,
        "ended_at": ended or started,
        "status": status.get("status_str"),
        "task_ids": task_ids,
        "outputs": files[:50],
    }


def main():
    parser = argparse.ArgumentParser(description="Report ComfyUI runs to the IP Animations studio.")
    parser.add_argument("--token", required=True)
    parser.add_argument("--comfy", default="http://127.0.0.1:8188", help="ComfyUI address")
    parser.add_argument("--server", default="https://ipanimations.ai", help="Studio address")
    parser.add_argument("--every", type=int, default=20, help="Seconds between checks")
    parser.add_argument("--once", action="store_true", help="Check once and exit")
    args = parser.parse_args()

    endpoint = args.server.rstrip("/") + "/api/studio/comfy"
    history_url = args.comfy.rstrip("/") + "/history"
    sent = set()
    print("Watching ComfyUI at " + args.comfy + ". Leave this window open.", flush=True)

    while True:
        try:
            history = get_json(history_url)
            runs = []
            for prompt_id, entry in history.items():
                if prompt_id in sent:
                    continue
                run = summarise(prompt_id, entry)
                if run:
                    runs.append(run)
            for start in range(0, len(runs), 100):
                batch = runs[start:start + 100]
                post_json(endpoint, args.token, {"runs": batch})
                sent.update(run["prompt_id"] for run in batch)
                print("Reported %d run(s)." % len(batch), flush=True)
        except urllib.error.HTTPError as err:
            if err.code == 401:
                print("The studio rejected this token. Copy a new one from Settings > ComfyUI.", flush=True)
                return 1
            print("Studio error %s, will retry." % err.code, flush=True)
        except (urllib.error.URLError, TimeoutError, ConnectionError) as err:
            print("Can't reach ComfyUI or the studio (%s), will retry." % err, flush=True)
        if args.once:
            return 0
        time.sleep(args.every)


if __name__ == "__main__":
    raise SystemExit(main())
