#!/bin/sh

echo "####===== Stage: PRE-Xcode Build is activated .... "

cat > ../../.env <<EOF
XMTP_ENV=${XMTP_ENV}
THRID_WEB_CLIENT_ID=${THRID_WEB_CLIENT_ID}
AWS_S3_REGION=${AWS_S3_REGION}
AWS_S3_BUCKET=${AWS_S3_BUCKET}
AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
EOF

# Debug output for ENV variables
# Note: Values are encrypted in CI host.
# Output will result as: XMTP_ENV=****
#
# echo "####===== Temporary ENV Debug"
# cat ../../.env

echo "####===== Run Yarn Install"
yarn install

exit 0