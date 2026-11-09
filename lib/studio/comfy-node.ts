/**
 * The ComfyUI tracker, as a single-file custom node. Each person downloads
 * their own copy from Settings with their token already inside, drops it in
 * ComfyUI's custom_nodes folder, and it starts with ComfyUI from then on.
 * Running inside ComfyUI means no Python install, terminal or port to set up.
 */

const SOURCE = String.raw`"""
IP Animations studio tracker for ComfyUI.

This file is personal: it holds your own connection to the studio dashboard,
so please don't share it. It runs quietly whenever ComfyUI is open.

Only run ids, times, workflow names and output file names are sent: never
prompts, media or API keys. To stop it, delete this file and restart ComfyUI.
"""
import json
import logging
import re
import ssl
import threading
import time
import urllib.error
import urllib.request

TOKEN = __TOKEN__
ENDPOINT = __ENDPOINT__

CHECK_EVERY = 20  # seconds between looks at ComfyUI's history
HEARTBEAT_EVERY = 300  # seconds between "still here" messages to the dashboard
TASK_ID = re.compile(r"\bcgt-[A-Za-z0-9-]+")
LOG_PREFIX = "[IP Animations tracker] "

# ComfyUI expects these from anything in custom_nodes. This adds no nodes.
NODE_CLASS_MAPPINGS = {}
NODE_DISPLAY_NAME_MAPPINGS = {}


def ssl_context():
    # Some packaged Pythons ship without system certificates.
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def post(payload, context):
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + TOKEN,
            "User-Agent": "ipa-comfy-tracker/2",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30, context=context) as res:
        return json.load(res)


def timestamp(messages, *names):
    for message in messages:
        if len(message) == 2 and message[0] in names:
            data = message[1]
            if isinstance(data, dict) and data.get("timestamp"):
                return data["timestamp"]
    return None


def summarise(prompt_id, entry):
    """One finished run reduced to what the dashboard needs."""
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
    workflow_extra = workflow.get("extra") if isinstance(workflow, dict) else None
    name = workflow_extra.get("title") if isinstance(workflow_extra, dict) else None

    # Some BytePlus nodes print the task id into their output.
    searchable = json.dumps(entry.get("outputs") or {}, default=str) + json.dumps(messages, default=str)

    return {
        "prompt_id": prompt_id,
        "workflow": name,
        "filename_prefix": prefix,
        "started_at": started,
        "ended_at": ended or started,
        "status": status.get("status_str"),
        "task_ids": sorted(set(TASK_ID.findall(searchable))),
        "outputs": files[:50],
    }


def watch():
    from server import PromptServer

    context = ssl_context()
    sent = set()
    last_contact = 0
    connected = False
    time.sleep(3)

    while True:
        try:
            queue = getattr(PromptServer.instance, "prompt_queue", None)
            runs = []
            if queue is not None:
                for prompt_id, entry in list(queue.get_history().items()):
                    if prompt_id not in sent:
                        run = summarise(prompt_id, entry)
                        if run:
                            runs.append(run)

            for start in range(0, len(runs), 100):
                batch = runs[start : start + 100]
                post({"runs": batch}, context)
                sent.update(run["prompt_id"] for run in batch)
                last_contact = time.time()

            if time.time() - last_contact >= HEARTBEAT_EVERY:
                post({"runs": []}, context)
                last_contact = time.time()

            if not connected:
                connected = True
                logging.info(LOG_PREFIX + "connected to the studio dashboard.")
        except urllib.error.HTTPError as err:
            if err.code == 401:
                logging.warning(LOG_PREFIX + "this file is out of date. Download a new one from Studio > Settings.")
                return
            logging.warning(LOG_PREFIX + "the dashboard answered %s, will retry." % err.code)
        except Exception as err:
            # Never let tracking get in the way of ComfyUI.
            logging.warning(LOG_PREFIX + "will retry (%s)." % err)
        time.sleep(CHECK_EVERY)


threading.Thread(target=watch, name="ipa-studio-tracker", daemon=True).start()
`;

export function buildComfyNode(token: string, origin: string): string {
  return SOURCE.replace("__TOKEN__", () => JSON.stringify(token)).replace("__ENDPOINT__", () =>
    JSON.stringify(`${origin}/api/studio/comfy`),
  );
}
