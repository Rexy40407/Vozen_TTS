"""Unprivileged forced SSH command: upload, deploy, or archive cleanup only."""
import fcntl
import os
import re
import sys
import tempfile
from pathlib import Path

ROOT = Path("/home/vozen/vozen-publish-incoming")


def parse(command):
    if command == "deploy":
        return "deploy", None
    match = re.fullmatch(r"(put|cleanup) ([0-9a-f]{40})", command)
    if not match:
        raise ValueError("unrecognized publish command")
    return match.groups()


def main():
    action, sha = parse(os.environ.get("SSH_ORIGINAL_COMMAND", ""))
    if os.geteuid() != 1001:
        raise ValueError("wrong publisher account")
    if action == "deploy":
        os.execve("/usr/bin/sudo", ["sudo", "-n", "/usr/local/sbin/vozen-deploy-broker"],
                  {"PATH": "/usr/bin:/bin", "HOME": "/home/vozen"})
    ROOT.mkdir(mode=0o700, exist_ok=True)
    if ROOT.resolve() != ROOT:
        raise ValueError("unexpected artifact directory")
    # The publisher cannot ask for arbitrary names, paths, commands or flags.
    with (ROOT / ".upload-lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        directory = ROOT / sha
        if action == "cleanup":
            if directory.resolve() != directory:
                raise ValueError("unexpected cleanup directory")
            (directory / ("vozen-rust-" + sha + ".tar.gz")).unlink(missing_ok=True)
            try:
                directory.rmdir()
            except OSError:
                pass
            return
        if sum(path.stat().st_size for path in ROOT.glob("*/*.tar.gz") if not path.is_symlink()) > 4 * 1024**3:
            raise ValueError("incoming artifact capacity limit")
        directory.mkdir(mode=0o700, exist_ok=True)
        if directory.resolve() != directory:
            raise ValueError("unexpected upload directory")
        descriptor, temporary = tempfile.mkstemp(prefix="upload-", dir=directory)
        try:
            total = 0
            with os.fdopen(descriptor, "wb") as stream:
                while chunk := sys.stdin.buffer.read(1024 * 1024):
                    total += len(chunk)
                    if total > 2 * 1024**3:
                        raise ValueError("artifact size limit")
                    stream.write(chunk)
            if total == 0:
                raise ValueError("empty artifact")
            os.replace(temporary, directory / ("vozen-rust-" + sha + ".tar.gz"))
        finally:
            Path(temporary).unlink(missing_ok=True)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print("Restricted publisher refused or failed.", file=sys.stderr)
        raise SystemExit(1)
