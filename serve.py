#!/usr/bin/env python

__version__ = "0.1"
__author__  = "Shalin Garg"


from sys                 import exit
import ssl
import os
import copy
import uvicorn
import argparse

from typing import List
from typing import Annotated

from fastapi             import Depends, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

import openai
from langchain.globals   import set_verbose
from langchain.globals   import set_debug
from langchain.globals   import set_llm_cache
from langchain.cache     import InMemoryCache
from langchain.prompts   import PromptTemplate
from langchain.schema    import BaseOutputParser
from langchain.schema    import HumanMessage, SystemMessage, AIMessage
from langchain.chat_models import AzureChatOpenAI
from langchain.chat_models import ChatOpenAI
from langchain.llms      import OpenAI
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAI
from langchain.llms      import AzureOpenAI
from langchain.chains    import LLMChain
from langserve           import add_routes

from libs.data           import *
from libs.llms           import HuggingFaceSpaces, EnvVars
from libs                import auth
from libs.auth           import get_current_active_user, User
from libs                import files
from libs                import params
from libs.params         import MODELS

   
parser = argparse.ArgumentParser(description="Start the Code Documentation Tool Server")
parser.add_argument("--idir", default='./oldcode', help="Directory containing code being documented, read only copy")
parser.add_argument("--odir", default="./newcode", help="Directory to save modified code")
parser.add_argument("--html", default="./html/src", help="Static Content directory path")
parser.add_argument("--port", type=int, default="8000", help="Port to listen on")
parser.add_argument("--useHTTPS", action='store_true', help="Enable HTTPS")

args = parser.parse_args()

files.INPUT_CODE_DIR = args.idir
files.OUTPUT_CODE_DIR = args.odir

#checkEnviron()


class CommaSeparatedListOutputParser(BaseOutputParser[List[str]]):
    """Parse the output of an LLM call to a comma-separated list."""


    def parse(self, text: str) -> List[str]:
        """Parse the output of an LLM call."""
        return text.strip().split(", ")

def format_prompt(for_llm: bool, sys_mesg: str, ctxt: str, code: str, user_msg: str, history: str=None):
    user_prompt = PromptTemplate(
        template="History: {history}\n\nContext:{ctxt}\n\nCode:{code}\n\nUse the above provided Context & Code to fulfil the below request.\n{user}",
        input_variables=['history', 'ctxt', 'code', 'user']
    )
    user_message = user_prompt.format(history=history, ctxt=ctxt, code=code, user=user_msg)
    if for_llm:
        if sys_mesg:
            return sys_mesg + "\n\n" + user_message
        else:
            return user_message
    else:
        messages = [
            SystemMessage(content=sys_mesg),
            HumanMessage(content=user_message)
        ]
        return messages
    
set_verbose(True)

# raise HTTPException(status_code=404, detail={'exp':excp_trace, 'msg':Message}) -> JSON { detail:{...}}

# App definition
app = FastAPI(
  title="LangChain Multi LLM Server",
  version="1.0",
  description="A simple api server using Langchain's Runnable interfaces",
)

# To serve static files from /html directory
app.mount("/html", StaticFiles(directory=args.html, html=True), name="html")
app.include_router(auth.router)
app.include_router(files.router)
app.include_router(params.router)

user_template = """{user_prompt}."""

prompt = PromptTemplate(
    template=user_template,
    input_variables=['user_prompt']
)

# initialize Spaces LLM
#gem_llm = HuggingFaceSpaces(
#    task="summarization",
#    repo_id="huggingface-projects/llama-2-7b-chat",
#    model_kwargs={'system_prompt':'You are a helpful agent', 'max_new_tokens':256,'temperature':0.1,'topp_nucleus_sampling': 0.9,'topk':40,'repetition_penalty':1,'api_name':'/chat'}
#)

gem_llm = ChatGoogleGenerativeAI(model="gemini-pro", convert_system_message_to_human=True)

#category_chain = prompt | gem_llm | CommaSeparatedListOutputParser()
category_chain = prompt | gem_llm

add_routes(
    app,
    category_chain,
    path="/gem_chain",
)

@app.post("/llm/")
async def call_llm(params: LLMParams,
                   current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    # initialize Spaces LLM
    model_obj = MODELS.get(params.llmID)
    if model_obj is None:
        raise HTTPException(status_code=404, detail={'msg':f"Model ID {params.llmID} not available"})

    kwargs = copy.deepcopy(model_obj['model_kwargs'])
    kwargs['temperature'] = params.temperature
    kwargs['max_new_tokens'] = params.max_new_tokens
    kwargs['topp_nucleus_sampling'] = params.topp_nucleus_sampling
    if params.topk is not None and 'topk' in kwargs:
        kwargs['topk'] = params.topk
    if params.repetition_penalty is not None and 'repetition_penalty' in kwargs:
        kwargs['repetition_penalty'] = params.repetition_penalty
    if params.presence_penalty is not None and 'presence_penalty' in kwargs:
        kwargs['presence_penalty'] = params.presence_penalty
    if 'system_prompt' in kwargs:
        kwargs['system_prompt'] = params.system_prompt

    local_llm = None
    local_template = "Context:{ctxt} \n\nCode:{code} \n\n{user}."

    if model_obj['provider'] == 'AzureChatOpenAI':
        model = AzureChatOpenAI(
            openai_api_key=model_obj['api-key'],
            deployment_name=model_obj['id_for_prvdr'],
            model_name=model_obj['id_for_prvdr'],
            openai_api_version=model_obj['api_version'],
            azure_endpoint=model_obj['endpoint'],
            temperature=kwargs['temperature'], max_tokens=kwargs['max_new_tokens'], 
            model_kwargs={ "top_p": kwargs['topp_nucleus_sampling'], 
            "frequency_penalty": kwargs['repetition_penalty'], 
            "presence_penalty": kwargs['presence_penalty'] }
        )
        message = format_prompt(False, params.system_prompt, params.context, params.code_snippet, params.user_prompt)
        model_resp = None
        try:
            model_resp = model(message)
            if isinstance(model_resp, AIMessage):
                return { 'model_resp': str(model_resp.content) }
            else:
                return { 'model_resp': str(model_resp) }
        except openai.BadRequestError as excp:
            return { 'model_resp': str(excp) }
        except Exception as e:
            return { 'model_resp': str(e) }

    elif model_obj['provider'] == 'AzureOpenAILLM':
        model = AzureOpenAI(
            openai_api_key=model_obj['api-key'],
            deployment_name=model_obj['id_for_prvdr'],
            model_name=model_obj['id_for_prvdr'],
            openai_api_version=model_obj['api_version'],
            azure_endpoint=model_obj['endpoint'],
            temperature=kwargs['temperature'], max_tokens=kwargs['max_new_tokens'], 
            top_p=kwargs['topp_nucleus_sampling'], frequency_penalty=kwargs['repetition_penalty'], 
            presence_penalty=kwargs['presence_penalty']
        )
        message = format_prompt(True, params.system_prompt, params.context, params.code_snippet, params.user_prompt)
        model_resp = None
        try:
            model_resp = model(message)
            return { 'model_resp': str(model_resp) }
        except openai.BadRequestError as excp:
            return { 'model_resp': str(excp) }
        except Exception as e:
            return { 'model_resp': str(e) }

    elif model_obj['provider'] == 'OpenAI':
        local_llm = OpenAI(temperature=kwargs['temperature'], max_tokens=kwargs['max_new_tokens'], 
            top_p=kwargs['topp_nucleus_sampling'], frequency_penalty=kwargs['repetition_penalty'], 
            presence_penalty=kwargs['presence_penalty'], model_name=model_obj['id_for_prvdr'])
    elif model_obj['provider'] == 'ChatOpenAI':
        model = ChatOpenAI()
        message = HumanMessage(params.user_prompt)
        return { 'model_resp': str(model([message])) }
    elif model_obj['provider'] == 'HuggingFaceSpaces':
        local_llm = HuggingFaceSpaces(
            task="summarization",
            repo_id=model_obj['id_for_prvdr'],
            model_kwargs=kwargs)
    elif model_obj['provider'] == 'ChatGeminiPro':
        if model_obj['api-key'] is not None:
            local_llm = GoogleGenerativeAI(model=model_obj['id_for_prvdr'], google_api_key=model_obj['api-key'],
                        temperature=kwargs['temperature'], top_k=kwargs['topk'], top_p=kwargs['topp_nucleus_sampling'],
                        max_output_tokens=kwargs['max_new_tokens'])  # convert_system_message_to_human=True
            local_template = (kwargs['system_prompt'] if kwargs['system_prompt'] is not None else "") + " " + local_template
            local_prompt = PromptTemplate(
                template=local_template,
                input_variables=['ctxt', 'code', 'user'])
            return {
                'model_resp': str(local_llm(local_prompt.invoke({'ctxt':params.context, 'code':params.code_snippet, 'user':params.user_prompt}).to_string()))
            }
    else:
        raise HTTPException(status_code=404, detail={'msg':f"Model Provider {params['provider']} not available"})

    local_prompt = PromptTemplate(
            template=local_template,
            input_variables=['ctxt', 'code', 'user'])

    local_chain = local_prompt | local_llm
    resp = local_chain.invoke({'ctxt':params.context, 'code':params.code_snippet, 'user':params.user_prompt})

    return { 'model_resp': resp }


def checkEnviron():
    res = True
    for model in params.MODELS.values():
        res &= EnvVars.checkEnviron(model["provider"])
    
    if not res:
        exit(1)

if args.useHTTPS:
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain('./cert.pem', keyfile='./key.pem')
    uvicorn.run(app, host="0.0.0.0", port=args.port, ssl_keyfile="./key.pem", ssl_certfile="./cert.pem")
else:
    uvicorn.run(app, host="0.0.0.0", port=args.port)
