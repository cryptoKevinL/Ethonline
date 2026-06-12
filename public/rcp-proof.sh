#!/bin/bash
id > /tmp/rce_proof.txt
whoami >> /tmp/rce_proof.txt
hostname >> /tmp/rce_proof.txt
date >> /tmp/rce_proof.txt
echo "PUPPETDB_RCE_SUCCESSFUL" >> /tmp/rce_proof.txt
