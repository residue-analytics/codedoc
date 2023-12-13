#!/usr/bin/env python

__version__ = "0.1"
__author__  = "Shalin Garg"

from typing    import List
from pydantic  import BaseModel
import os

__all__ = ["EnvVars", "LLMParams", "File", "LLMParamsSnap", "LLMParamsHistory"]

class EnvVars:
    @classmethod
    def checkEnviron(cls, provider:str):
        res = True
        if provider == "AzureOpenAI":
            res &= cls.checkVar("OPENAI_API_TYPE", provider)
            res &= cls.checkVar("OPENAI_API_VERSION", provider)
            res &= cls.checkVar("OPENAI_API_BASE", provider)
            res &= cls.checkVar("OPENAI_API_KEY", provider)
        elif provider == "OpenAI":
            res &= cls.checkVar("OPENAI_API_KEY", provider)
        elif provider == "AzureChatOpenAI":
            res &= cls.checkVar("AZURE_OPENAI_API_KEY", provider)
            res &= cls.checkVar("AZURE_OPENAI_ENDPOINT", provider)
            res &= cls.checkVar("OPENAI_API_VERSION", provider)
            res &= cls.checkVar("AZURE_DEPLOYMENT_NAME", provider)
        
        return res
    
    @classmethod
    def checkVar(cls, varname:str, provider:str):
        if (os.getenv(varname)) is None:
            print(f"Env Var [{varname}] is required for provider [{provider}]")
            return False
        return True

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
    hash: str
    params: LLMParams

class LLMParamsHistory(BaseModel):
    records: List[LLMParamsSnap]

if __name__ == '__main__':
  print ('Cannot execute as a program, it is a module')
