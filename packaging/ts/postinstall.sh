#!/bin/sh
# After installing or upgrading ${PKG_DISPLAY_NAME}: Chromium's sandbox helper must be setuid root, for systems where it
# cannot sandbox with unprivileged user namespaces (Ubuntu 23.10 and later restrict them; see packaging/ts/launcher.sh).
chown root:root /opt/${PKG_NAME}/chrome-sandbox
chmod 4755 /opt/${PKG_NAME}/chrome-sandbox
