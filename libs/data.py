#!/usr/bin/env python

__version__ = "0.1"
__author__  = "Shalin Garg"

from typing    import List
from pydantic  import BaseModel
import os

__all__ = ["LLMParams", "File", "LLMParamsSnap", "LLMParamsHistory"]

class LLMParams(BaseModel):
    llmID: str
    temperature: float
    max_new_tokens: int
    topp_nucleus_sampling: float
    topk: int | None = None
    repetition_penalty: float | None = None
    presence_penalty: float | None = None
    system_prompt: str | None = "You are a helpful assistant"
    context: str | None = None
    code_snippet: str | None = None
    user_prompt: str

class File(BaseModel):
    name: str           # loc/loc/program_name.ver.js ver=1, 2, 3
    version: int | None = None
    content: str | None = None # file content

class LLMParamsSnap(BaseModel):
    tm: int
    user: str
    purpose: str
    hash: str
    params: LLMParams

class LLMParamsHistory(BaseModel):
    records: List[LLMParamsSnap]

if __name__ == '__main__':
  print ('Cannot execute as a program, it is a module')
