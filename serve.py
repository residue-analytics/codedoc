#!/usr/bin/env python
from typing import List

from fastapi             import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from langchain.globals   import set_verbose
from langchain.globals   import set_debug
from langchain.prompts   import PromptTemplate
from langchain.chains    import LLMChain
from langchain.globals   import set_llm_cache
from langchain.cache     import InMemoryCache
from langchain.schema    import BaseOutputParser
from HuggingFaceSpaces   import HuggingFaceSpaces
from pydantic            import BaseModel
from langserve           import add_routes
from pathlib             import Path
import ssl
import os
import copy

INPUT_CODE_DIR = "./oldcode"
OUTPUT_CODE_DIR = "./newcode"

keys_to_remove = ['api-key', 'id', 'api_name', 'fn_index']
MODELS_FOR_UI = None
MODELS = {
    'code_llama_playground': { 
        'id': 'codellama/codellama-playground', 
        'name': 'Code Llama Playground',
        'code': 'CLP',
        'api-key': None, 
        'provider': 'HuggingFaceSpaces',
        'model_kwargs': {
            'temperature': 0.1,
            'max_new_tokens': 256,
            'topp_nucleus_sampling': 0.9,
            'repetition_penalty': 1,
            'fn_index': 1
        }
    },
    'llama2-7b': {
        'id': 'huggingface-projects/llama-2-7b-chat',
        'name': 'Llama2 7B',
        'code': 'L27B',
        'api-key': None,
        'provider': 'HuggingFaceSpaces',
        'model_kwargs': {
            'system_prompt': 'You are a helpful agent',
            'max_new_tokens': 256,
            'temperature': 0.1,
            'topp_nucleus_sampling': 0.9,
            'topk': 40,
            'repetition_penalty': 1,
            'api_name': '/chat'
        }
    }
}

def copy_dict_and_remove_keys(original_dict, keys_to_remove):
    new_dict = {}
    for key, value in original_dict.items():
        if key not in keys_to_remove:
            if isinstance(value, dict):
                new_dict[key] = copy_dict_and_remove_keys(value, keys_to_remove)
            else:
                new_dict[key] = value
    return new_dict


class CommaSeparatedListOutputParser(BaseOutputParser[List[str]]):
    """Parse the output of an LLM call to a comma-separated list."""


    def parse(self, text: str) -> List[str]:
        """Parse the output of an LLM call."""
        return text.strip().split(", ")

set_verbose(True)

# raise HTTPException(status_code=404, detail={'exp':excp_trace, 'msg':Message}) -> JSON { detail:{...}}
#ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
#ssl_context.load_cert_chain('./cert.pem', keyfile='./key.pem')

# App definition
app = FastAPI(
  title="LangChain HuggingFaceSpaces Server",
  version="1.0",
  description="A simple api server using Langchain's Runnable interfaces",
)

# To serve static files from /html directory
app.mount("/html", StaticFiles(directory="./html", html=True), name="html")

user_template = """{user_prompt}."""

prompt = PromptTemplate(
    template=user_template,
    input_variables=['user_prompt']
)

# initialize Spaces LLM
spcs_llm = HuggingFaceSpaces(
    task="summarization",
    repo_id="huggingface-projects/llama-2-7b-chat",
    model_kwargs={'system_prompt':'You are a helpful agent', 'max_new_tokens':256,'temperature':0.1,'topp_nucleus_sampling': 0.9,'topk':40,'repetition_penalty':1,'api_name':'/chat'}
)

category_chain = prompt | spcs_llm | CommaSeparatedListOutputParser()

add_routes(
    app,
    category_chain,
    path="/spaces_chain",
)


class LLMParams(BaseModel):
    llmID: str
    temp: float
    maxTokens: int
    topp: float
    topk: int | None = None
    repeat_penalty: float | None = None
    sys_prompt: str = "You are a helpful assistant"
    context: str | None = None
    code_snippet: str | None = None
    user_prompt: str

class File(BaseModel):
    name: str           # program_name.js
    loc: str            # Directory location
    prevVer: int = 0    # 1, 2, 3 ...
    content: str        # file content

@app.post("/llm/")
async def call_llm(params: LLMParams) -> dict:
    # initialize Spaces LLM
    model_obj = MODELS.get(params.llmID)
    if model_obj is None:
        raise HTTPException(status_code=404, detail={'msg':f"Model ID {params.llmID} not available"})

    if model_obj['provider'] != 'HuggingFaceSpaces':
        raise HTTPException(status_code=404, detail={'msg':f"Model Provider {params['provider']} not available"})

    kwargs = copy.deepcopy(model_obj['model_kwargs'])
    kwargs['temperature'] = params.temp
    kwargs['max_new_tokens'] = params.maxTokens
    kwargs['topp_nucleus_sampling'] = params.topp
    if params.topk is not None and 'topk' in kwargs:
        kwargs['topk'] = params.topk
    if params.repeat_penalty is not None and 'repetition_penalty' in kwargs:
        kwargs['repetition_penalty'] = params.repeat_penalty
    if 'system_prompt' in kwargs:
        kwargs['system_prompt'] = params.sys_prompt

    local_llm = HuggingFaceSpaces(
        task="summarization",
        repo_id=model_obj['id'],
        model_kwargs=kwargs
    )

    local_template = """Context:{ctxt} 

    Code:{code} 

    {user}."""

    local_prompt = PromptTemplate(
        template=local_template,
        input_variables=['ctxt', 'code', 'user']
    )

    local_chain = local_prompt | local_llm

    resp = local_chain.invoke({'ctxt':params.context, 'code':params.code_snippet, 'user':params.user_prompt})

    return { 'model_resp': resp }

@app.get("/models/")
def get_models() -> dict:
    global MODELS_FOR_UI
    if MODELS_FOR_UI is None:
        MODELS_FOR_UI = copy_dict_and_remove_keys(MODELS, keys_to_remove)

    return MODELS_FOR_UI

@app.get("/files/{dir_path:path}")
def get_file(dir_path: str, request: Request) -> dict:
    if dir_path.find("..") != -1:
        raise HTTPException(status_code=403, detail={'msg': "Forbidden access"})

    filepath = Path(INPUT_CODE_DIR + "/" + dir_path)
    if filepath.is_file():
        return {'file': dir_path, 'data': filepath.read_text()}
    elif filepath.is_dir():
        files_paths = []
        for file in filepath.glob("**/*"):
            if not (file.name.startswith('_') or file.name.startswith('.')):
                #files_paths.append(request.url._url.rstrip("/") + "/" + file.name)
                files_paths.append(file.relative_to(INPUT_CODE_DIR).as_posix())
        # files = os.listdir("./" + dir_path)
        #files_paths = sorted([f"{request.url._url}/{f}" for f in files if not (f.startswith('.') or f.startswith('_'))])
        return {'dirname': dir_path, 'files': files_paths}
    else:
        raise HTTPException(status_code=404, detail={'msg': f"Could not read {filepath.name}"})

@app.put("/files/{dir_path:path}")
def save_file(dir_path: str, fileData: File, request: Request) -> dict:
    if dir_path.find("..") != -1:
        raise HTTPException(status_code=403, detail={'msg': "Forbidden access"})
    
    newVer = fileData.prevVer + 1
    name = Path(fileData.name)
    filepath = Path(OUTPUT_CODE_DIR + "./" + fileData.loc + "./" + name.stem + "." + str(newVer) + name.suffix)

    if filepath.exists():
        raise HTTPException(status_code=409, detail={'msg': f"File [{fileData.name}] with version [{newVer}] already exists."})

    # Create the directory structure, don't raise exceptions if paths exist
    filepath.parent.mkdir(mode=0o644, parents=True, exist_ok=True)

    try:
        filepath.touch(mode=0o644, exist_ok=False)  # Raises FileExistsError if file already exists (expecting this to take care of any race conditions too)
    except FileExistsError:
        raise HTTPException(status_code=409, detail={'msg': f"File [{fileData.name}] with version [{newVer}] already exists."})

    filepath.write_text(fileData.content)
    
    return {'msg': "File [" + str(filepath) + "] created successfully.", 'version': newVer}

if __name__ == "__main__":
    import uvicorn

    #uvicorn.run(app, host="localhost", port=8000, ssl_keyfile="./key.pem", ssl_certfile="./cert.pem")
    uvicorn.run(app, host="localhost", port=8000)
