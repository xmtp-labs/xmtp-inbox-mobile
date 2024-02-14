 # !/bin/sh

# include helpers
source retry.sh

echo "###===== Installing Cocoapods"
retry 5 brew install node

echo "###===== Installing Homebrew"
retry 5 brew install cocoapods

echo "###===== Installing Yarn"
npm install --global yarn
