#!/usr/bin/env python3
import sys
import re

def remove_ar(msg: str) -> str:
    # remove standalone 'AR' tokens and 'AR-' prefixes, case-insensitive
    s = re.sub(r"(?i)\bAR\b[\s,\-]*", "", msg)
    return s

def smart_title(s: str) -> str:
    # Title-case words but keep short all-caps tokens (like UI, 3D)
    def process_token(tok: str) -> str:
        pre = re.match(r"^[^A-Za-z0-9]*", tok).group(0)
        post = re.search(r"[^A-Za-z0-9]*$", tok).group(0)
        core = tok[len(pre):len(tok)-len(post)] if len(tok)-len(post) > len(pre) else tok[len(pre):]
        if not core:
            return tok
        # keep tokens that have digits or are short acronyms in all-caps
        if re.search(r"\d", core) or (core.isupper() and len(core) <= 3):
            newcore = core.upper()
        else:
            newcore = core.capitalize()
        return f"{pre}{newcore}{post}"

    parts = s.split()
    return " ".join(process_token(p) for p in parts)

def normalize_separators(s: str) -> str:
    # replace multiple spaces and clean up stray commas/spaces
    s = re.sub(r"\s+,", ",", s)
    s = re.sub(r",\s*", ", ", s)
    s = re.sub(r"\s{2,}", " ", s)
    s = s.strip(' -,_')
    return s.strip()

if __name__ == '__main__':
    msg = sys.stdin.read()
    original = msg
    if re.search(r"(?i)\bAR\b", msg):
        s = remove_ar(msg)
        s = normalize_separators(s)
        if not s:
            # if removing left nothing, keep original
            sys.stdout.write(original)
        else:
            sys.stdout.write(smart_title(s))
    else:
        sys.stdout.write(original)
