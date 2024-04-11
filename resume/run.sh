#!/usr/bin/env bash

source /mnt/shalin/.venv9/bin/activate

export OPENAI_API_VERSION="2023-07-01-preview"
export AZURE_OPENAI_ENDPOINT="https://<endpoint>.openai.azure.com/"
export OPENAI_API_KEY_4T=""
export OPENAI_API_KEY_ADA=""

python resume_match.py
