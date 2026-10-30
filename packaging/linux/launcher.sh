#!/bin/sh
# Starts ${PKG_DISPLAY_NAME} (installed in /opt/${PKG_NAME}).
exec /opt/${PKG_NAME}/${PKG_EXECUTABLE} "$@"
