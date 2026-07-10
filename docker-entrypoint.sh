#!/bin/sh
set -e

# Fix permissions on the mounted db-data volume so the non-root sagaf user can write to it.
# This runs as root (ENTRYPOINT), before switching to the sagaf user.
if [ -d /app/db-data ]; then
    chown -R sagaf:sagaf /app/db-data
fi

# Drop privileges and exec the CMD
exec gosu sagaf "$@"
