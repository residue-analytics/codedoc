#!/usr/bin/env python

__version__ = "0.1"
__author__  = "Shalin Garg"

from typing import List
from typing import Annotated

from fastapi             import Depends, FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses   import FileResponse
from langchain.globals   import set_verbose
from langchain.globals   import set_debug
from langchain.globals   import set_llm_cache
from langchain.cache     import InMemoryCache
from langchain.prompts   import PromptTemplate
from langchain.schema    import BaseOutputParser
from langchain.schema    import HumanMessage
from langchain.chat_models import AzureChatOpenAI
from langchain.chat_models import ChatOpenAI
from langchain.llms      import OpenAI
from langchain.chains    import LLMChain
from langserve           import add_routes
from pathlib             import Path
from datetime            import datetime
from sys                 import exit
import ssl
import os
import copy
import json
from libs.data           import *
from libs.llms           import HuggingFaceSpaces
from libs                import auth
from libs                import user_db
from libs.auth           import get_current_active_user, User, sqlite_dbname
from libs.user_db        import UserDatabase, ParamsDatabase


INPUT_CODE_DIR = "./oldcode"
OUTPUT_CODE_DIR = "./newcode"

keys_to_remove = ['api-key', 'id_for_prvdr', 'api_name', 'fn_index']
MODELS_FOR_UI = None
MODELS = {
    'code_llama_playground': {
        'id_for_prvdr': 'codellama/codellama-playground', 
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
        'id_for_prvdr': 'huggingface-projects/llama-2-7b-chat',
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
    },
    'azure-openai-chat': {
        'id_for_prvdr': 'AzureAI/OpenAIChat',
        'name': 'Azure OpenAI Chat',
        'code': 'AzOpC',
        'api-key': None,
        'provider': 'AzureChatOpenAI',
        'model_kwargs': {
            'system_prompt': 'You are a helpful agent',
            'max_new_tokens': 256,
            'temperature': 0.1,
            'topp_nucleus_sampling': 0.9,
            'repetition_penalty': 1
        }
    },
    'azure-openai-llm': {
        'id_for_prvdr': 'text-davinci-003',
        'name': 'Azure OpenAI LLM',
        'code': 'AzOpL',
        'api-key': None,
        'provider': 'AzureOpenAILLM',
        'model_kwargs': {
            'system_prompt': 'You are a helpful agent',
            'max_new_tokens': 256,
            'temperature': 0.1,
            'topp_nucleus_sampling': 0.9,
            'repetition_penalty': 1
        }
    },
    'openai-llm': {
        'id_for_prvdr': 'text-davinci-003',
        'name': 'OpenAI LLM',
        'code': 'OpLM',
        'api-key': None,
        'provider': 'OpenAI',
        'model_kwargs': {
            'system_prompt': 'You are a helpful agent',
            'max_new_tokens': 256,
            'temperature': 0.1,
            'topp_nucleus_sampling': 0.9,
            'repetition_penalty': 1,
            'presence_penalty': 0
        }
    },
    'openai-chat': {
        'id_for_prvdr': 'ChatOpenAI',
        'name': 'OpenAI Chat',
        'code': 'COAI',
        'api-key': None,
        'provider': 'ChatOpenAI',
        'model_kwargs': {
            'system_prompt': 'You are a helpful agent',
            'max_new_tokens': 256,
            'temperature': 0.1,
            'topp_nucleus_sampling': 0.9,
            'repetition_penalty': 1,
            'presence_penalty': 0
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
app.mount("/html", StaticFiles(directory="./html/staging", html=True), name="html")
app.include_router(auth.router)

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
            openai_api_version=os.getenv('OPENAI_API_VERSION'),
            azure_deployment=os.getenv('AZURE_DEPLOYMENT_NAME') )
        message = HumanMessage(params.user_prompt)
        return { 'model_resp': str(model([message])) }
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
    else:
        raise HTTPException(status_code=404, detail={'msg':f"Model Provider {params['provider']} not available"})

    local_prompt = PromptTemplate(
            template=local_template,
            input_variables=['ctxt', 'code', 'user'])

    local_chain = local_prompt | local_llm
    resp = local_chain.invoke({'ctxt':params.context, 'code':params.code_snippet, 'user':params.user_prompt})

    return { 'model_resp': resp }

@app.get("/models/")
def get_models(current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    global MODELS_FOR_UI
    if MODELS_FOR_UI is None:
        MODELS_FOR_UI = copy_dict_and_remove_keys(MODELS, keys_to_remove)

    return MODELS_FOR_UI

@app.get("/files/")
def get_dirlist(current_user: Annotated[User, Depends(get_current_active_user)],
                editable: bool = False) -> dict:
    basedir  = None
    if editable:
        basedir = OUTPUT_CODE_DIR
    else:
        basedir = INPUT_CODE_DIR

    filepath = Path(basedir + "/")
    if filepath.is_dir():
        files_paths = []
        for file in filepath.glob("**/*"):
            if not (file.name.startswith('_') or file.name.startswith('.')):
                if not file.is_dir():
                    files_paths.append(file.relative_to(basedir).as_posix())
        # files = os.listdir("./" + dir_path)
        #files_paths = sorted([f"{request.url._url}/{f}" for f in files if not (f.startswith('.') or f.startswith('_'))])
        return {'dirname': "/", 'files': files_paths}
    else:
        raise HTTPException(status_code=404, detail={'msg': f"Could not read {filepath.name}"})

@app.get("/files/{file_path:path}")
def get_file(file_path: str, current_user: Annotated[User, Depends(get_current_active_user)],
             raw: bool = False, editable: bool = False):
    if file_path.find("..") != -1:
        raise HTTPException(status_code=403, detail={'msg': "Forbidden access"})
    
    basedir  = None
    findVersionedFile = False
    if editable:
        basedir = OUTPUT_CODE_DIR
        findVersionedFile = True
    else:
        basedir = INPUT_CODE_DIR

    filepath = Path(basedir + "/" + file_path)

    if filepath.is_file():   # We don't have un-versioned files in output directory
        if raw:
            return FileResponse(str(filepath))    # FastAPI to return proper content headers
        else:
            return File(name=file_path, content=filepath.read_text())
    elif findVersionedFile:
        # Try to find the versioned files
        most_recent_file = get_editable_file(filepath)
        if most_recent_file is None:
            raise HTTPException(status_code=404, detail={'msg': f"Could not read {filepath.name}"})
        else:
            return File(name=most_recent_file.relative_to(basedir).as_posix(), version=get_version(most_recent_file), content=most_recent_file.read_text())
    else:
        raise HTTPException(status_code=404, detail={'msg': f"Could not read {filepath.name}"})

def get_editable_file(file_path: Path):
    # Find the highest versioned file in the output folder
    stem = file_path.stem    # string - /outputdir/html/css/styles
    file_list = [file for file in file_path.parent.glob(stem + ".*")]
    if len(file_list) > 0:
        return sorted(file_list, key=lambda x: get_version(x), reverse=True)[0]
    else:
        return None

def get_version(file_path):
    split_name = file_path.name.split('.')
    if len(split_name) == 1:
        return 0
    if split_name[-1].isdigit():
        return int(split_name[-1])
    elif split_name[-2].isdigit():
        return int(split_name[-2])
    else:
        return 0

@app.put("/files/{dir_path:path}")
def save_file(dir_path: str, fileData: File, request: Request,
              current_user: Annotated[User, Depends(get_current_active_user)]) -> File:
    if dir_path.find("..") != -1 or fileData.name.find("..") != -1:
        raise HTTPException(status_code=403, detail={'msg': "Forbidden access"})

    file_path = Path(fileData.name)   # a/b/n1, a/b/n1.py, n1.1.py, n1.tar.1.gz, n1.1, n1.tar.gz
    dir_path  = file_path.parent      # a/b,    a/b,
    base_name = file_path.stem        # n1,     n1,        n1.1,    n1.tar.1,    n1,   n1.tar
    suffix = file_path.suffix         # '',     .py,       .py,     .gz,         .1,   .gz

    # Using Path().name to split for cases where dir name has a '.' and we don't want dirname to be split
    split_name = file_path.name.split('.')
    curVer = 0
    newVer = 0
    newfilepath = None
    if len(split_name) == 1:
        # No suffix filename
        newVer = curVer + 1
        newfilepath = Path(OUTPUT_CODE_DIR + "/" + fileData.name + "." + str(newVer))
    elif split_name[-1].isdigit():
        # No suffix filename, having a version as suffix
        if not Path(OUTPUT_CODE_DIR + "/" + fileData.name).exists():
            raise HTTPException(status_code=409, detail={'msg': f"Versioned File [{fileData.name}] with version [{split_name[-1]}] does not exist."})
            
        curVer = int(split_name[-1])
        newVer = curVer + 1
        newfilepath = Path(OUTPUT_CODE_DIR + "/" + dir_path.name + "/" + base_name + "." + str(newVer))
    elif split_name[-2].isdigit():
        # With suffix filename, having a version as second last
        if not Path(OUTPUT_CODE_DIR + "/" + fileData.name).exists():
            raise HTTPException(status_code=409, detail={'msg': f"Versioned File [{fileData.name}] with version [{split_name[-2]}] does not exist."})
            
        curVer = int(split_name[-2])
        newVer = curVer + 1
        split_name[-2] = str(newVer)    # Replace the version number
        newName = ".".join(split_name)
        newfilepath = Path(OUTPUT_CODE_DIR + "/" + str(file_path.with_name(newName)))
    else:
        # There is no version in the filename and there are more than 1 parts in the filename
        newVer = 1
        newfilepath = Path(OUTPUT_CODE_DIR + "/" + dir_path.name + "/" + base_name + "." + str(newVer) + suffix)

        #raise HTTPException(status_code=406, detail={'msg': f"File [{fileData.name}] not satisfying the versioning structure"})

    if newfilepath.exists():
        raise HTTPException(status_code=409, detail={'msg': f"File [{fileData.name}] with new version [{newVer}] already exists."})

    # Create the directory structure, don't raise exceptions if paths exist
    newfilepath.parent.mkdir(mode=0o644, parents=True, exist_ok=True)

    try:
        newfilepath.touch(mode=0o644, exist_ok=False)  # Raises FileExistsError if file already exists (expecting this to take care of any race conditions too)
    except FileExistsError:
        raise HTTPException(status_code=409, detail={'msg': f"File [{fileData.name}] with new version [{newVer}] already exists."})

    newfilepath.write_text(fileData.content)
    
    fileData.name = newfilepath.relative_to(OUTPUT_CODE_DIR).as_posix()
    fileData.version = newVer
    fileData.content = None
    return fileData

@app.get("/params-history/")
def get_all_params_history(current_user: Annotated[User, Depends(get_current_active_user)]) -> LLMParamsHistory:
    params_db = ParamsDatabase(sqlite_dbname)
    users_db = UserDatabase(sqlite_dbname)
    db_params = params_db.get_all_params()
    if db_params:
        params_list = []
        for param in db_params:
            param_dict = param.toDict()
            param_dict['params'] = json.loads(param.data)
            param_dict['user'] = users_db.get_user_by_id(param.user_id).fullname
            param_dict['hash'] = param_dict['data_hash']
            params_list.append(param_dict)
        return LLMParamsHistory(records=params_list)
    raise HTTPException(status_code=404, detail={'msg':f"Params not available"})

@app.get("/params/")
def get_all_params(current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    params_db = ParamsDatabase(sqlite_dbname)
    db_params = params_db.get_params_by_username(current_user.username)
    if db_params:
        params_list = []
        for param in db_params:
            params_list.append(json.loads(param.data))
        return { 'param_list': params_list }
    raise HTTPException(status_code=404, detail={'msg':f"Params not available"})

@app.get("/params/{llmID}")
def get_params(llmID:str, current_user: Annotated[User, Depends(get_current_active_user)]) -> LLMParams:
    params_db = ParamsDatabase(sqlite_dbname)
    db_params = params_db.get_latest_by_name_username(llmID, current_user.username)
    if db_params:
        return  json.loads(db_params.data)
    raise HTTPException(status_code=404, detail={'msg':f"Params for Model ID [{llmID}] not available"})

@app.put("/params/{llmID}")
def save_params(llmID: str, params: LLMParams, 
              current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    params_db = ParamsDatabase(sqlite_dbname)
    params_db.add_params_by_username(user_db.LLMParamsRec(llmID, None, int(datetime.now().timestamp()*1000), 
                                                       params.model_dump_json()), current_user.username)
    count = params_db.get_count_by_name(current_user.username, llmID)
    return {'llmID': llmID, 'count': count }

def checkEnviron():
    res = True
    for model in MODELS.values():
        res &= EnvVars.checkEnviron(model["provider"])
    
    if not res:
        exit(1)

if __name__ == "__main__":
    import uvicorn
    
    #checkEnviron()

    #uvicorn.run(app, host="localhost", port=8000, ssl_keyfile="./key.pem", ssl_certfile="./cert.pem")
    uvicorn.run(app, host="localhost", port=8000)
