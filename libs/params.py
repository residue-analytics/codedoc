#!/usr/bin/env python

##################################################################################################
#
# Copyright 2024, Shalin Garg
#
# This file is part of CodeDoc Gen AI Tool.
#
# CodeDoc is free software: you can redistribute it and/or modify it under the terms of the 
# GNU General Public License as published by the Free Software Foundation, either version 3 
# of the License, or (at your option) any later version.
#
# CodeDoc is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without 
# even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU 
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with CodeDoc. 
# If not, see <https://www.gnu.org/licenses/>.
#
##################################################################################################

import os
import json
from datetime            import datetime

from fastapi             import Depends, APIRouter, HTTPException

from libs.data           import LLMParamsHistory, LLMParams, LLMParamsSnap, LLMContextHistory
from libs.auth           import get_current_active_user, User, sqlite_dbname
from libs                import user_db
from libs.user_db        import UserDatabase, ParamsDatabase, ParamsType


__version__ = "0.1"
__author__  = "Shalin Garg"

from typing import Annotated

__all__ = ["router", "MODELS"]

keys_to_remove = ['api-key', 'id_for_prvdr', 'api_name', 'fn_index', 'enabled']
MODELS_FOR_UI = None
MODELS = {
    'code_llama_playground': {
        'enabled': False,
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
        'enabled': False,
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
    'azure-openai4t-chat': {
        'enabled': True,
        'id_for_prvdr': 'gpt-4-turbo',
        'api_version': '2023-07-01-preview',
        'endpoint': 'https://dcrdpaiopenai02.openai.azure.com/',
        'name': 'Azure OpenAI 4T Chat',
        'code': 'AzOp4tC',
        'api-key': os.getenv("AZURE_OPENAI_API_KEY2"), 
        'provider': 'AzureChatOpenAI',
        'model_kwargs': {
            'system_prompt': 'You are a helpful agent',
            'max_new_tokens': 4096,
            'temperature': 0.1,
            'topp_nucleus_sampling': 0.9,
            'repetition_penalty': 0.5,
            'presence_penalty': 0
        }
    },
    'azure-openai-chat': {
        'enabled': True,
        'id_for_prvdr': 'gpt-35-turbo-16k',
        'api_version': '2023-07-01-preview',
        'endpoint': 'https://dcrdpaiopenai01.openai.azure.com/',
        'name': 'Azure OpenAI Chat',
        'code': 'AzOpC',
        'api-key': os.getenv("AZURE_OPENAI_API_KEY"), 
        'provider': 'AzureChatOpenAI',
        'model_kwargs': {
            'system_prompt': 'You are a helpful agent',
            'max_new_tokens': 10000,
            'temperature': 0.1,
            'topp_nucleus_sampling': 0.9,
            'repetition_penalty': 0.5,
            'presence_penalty': 0
        }
    },
    'azure-openai-llm': {
        'enabled': True,
        'id_for_prvdr': 'gpt-35-turbo-instruct',
        'api_version': '2023-09-15-preview',
        'endpoint': 'https://dcrdpaiopenai01.openai.azure.com/',
        'name': 'Azure OpenAI LLM',
        'code': 'AzOpL',
        'api-key': os.getenv("AZURE_OPENAI_API_KEY"), 
        'provider': 'AzureOpenAILLM',
        'model_kwargs': {
            'system_prompt': 'You are a helpful agent',
            'max_new_tokens': 10000,
            'temperature': 0.1,
            'topp_nucleus_sampling': 0.9,
            'repetition_penalty': 0.5,
            'presence_penalty': 0
        }
    },
    'openai-llm': {
        'enabled': False,
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
        'enabled': False,
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
    },
    'gemini-pro-chat': {
        'enabled': False,
        'id_for_prvdr': 'gemini-pro',
        'name': 'Google Gemini Pro Chat',
        'code': 'GGPC',
        'api-key': os.getenv("GOOGLE_API_KEY"),
        'provider': 'ChatGeminiPro',
        'model_kwargs': {
            'system_prompt': 'You are a helpful agent',
            'max_new_tokens': 256,
            'temperature': 0.1,
            'topp_nucleus_sampling': 0.9,
            'topk': 1
        }
    }
}

router = APIRouter()

def copy_dict_and_remove_keys(original_dict, keys_to_remove):
    new_dict = {}
    for key, value in original_dict.items():
        if key not in keys_to_remove:
            if isinstance(value, dict):
                if 'enabled' in value and not value.get('enabled'):
                    continue
                next = copy_dict_and_remove_keys(value, keys_to_remove)
                if next is not None:
                    new_dict[key] = next
            else:
                if value is not None:
                    new_dict[key] = value

    if len(new_dict) > 0:
        return new_dict
    else:
        return None

@router.get("/models/")
def get_models(current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    global MODELS_FOR_UI
    if MODELS_FOR_UI is None:
        MODELS_FOR_UI = copy_dict_and_remove_keys(MODELS, keys_to_remove)

    return MODELS_FOR_UI

@router.get("/params-history/")
def get_all_params_history(current_user: Annotated[User, Depends(get_current_active_user)]) -> LLMParamsHistory:
    params_db = ParamsDatabase(sqlite_dbname)
    users_db = UserDatabase(sqlite_dbname)
    db_params = params_db.get_all_params(ParamsType.LLM_PARAMS)
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

@router.get("/params/")
def get_all_params(current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    params_db = ParamsDatabase(sqlite_dbname)
    db_params = params_db.get_params_by_username(current_user.username, ParamsType.LLM_PARAMS)
    if db_params:
        params_list = []
        for param in db_params:
            params_list.append(json.loads(param.data))
        return { 'param_list': params_list }
    raise HTTPException(status_code=404, detail={'msg':f"Params not available"})

@router.get("/context/")
def get_all_contexts(current_user: Annotated[User, Depends(get_current_active_user)]) -> LLMContextHistory:
    params_db = ParamsDatabase(sqlite_dbname)
    users_db = UserDatabase(sqlite_dbname)
    #db_params = params_db.get_params_by_username(current_user.username, ParamsType.LLM_CONTEXT)
    db_params = params_db.get_all_params(ParamsType.LLM_CONTEXT)
    if db_params:
        params_list = []
        for param in db_params:
            param_dict = param.toDict()
            param_dict['context'] = json.loads(param.data)['context']
            param_dict['user'] = users_db.get_user_by_id(param.user_id).fullname
            param_dict['hash'] = param_dict['data_hash']
            params_list.append(param_dict)
        return LLMContextHistory(records=params_list)

    raise HTTPException(status_code=404, detail={'msg':f"Contexts not available"})

@router.get("/params/{llmID}")
def get_params(llmID:str, current_user: Annotated[User, Depends(get_current_active_user)]) -> LLMParams:
    params_db = ParamsDatabase(sqlite_dbname)
    db_params = params_db.get_latest_by_name_username(llmID, current_user.username, ParamsType.LLM_PARAMS)
    if db_params:
        return  json.loads(db_params.data)
    raise HTTPException(status_code=404, detail={'msg':f"No params for Model ID [{llmID}] saved by you"})

@router.put("/params/{llmID}")
def save_params(llmID: str, paramsnp: LLMParamsSnap, 
              current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    params_db = ParamsDatabase(sqlite_dbname)
    params_rec = user_db.LLMParamsRec(llmID, None, paramsnp.tm, 
                                      paramsnp.purpose, paramsnp.params.model_dump_json(), paramsnp.hash,
                                      ParamsType.LLM_PARAMS)
    if paramsnp.hash is None or len(paramsnp.hash) == 0:
        params_rec.tm = int(datetime.now().timestamp()*1000)
        params_db.add_params_by_username(params_rec, current_user.username)
    else:
        params_db.update_params_by_username(params_rec, current_user.username)
    
    count = params_db.get_count_by_name(current_user.username, llmID)
    return {'llmID': llmID, 'count': count }

@router.put("/context/{llmID}")
def save_context(llmID: str, paramsnp: LLMParamsSnap, 
              current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    params_db = ParamsDatabase(sqlite_dbname)
    params_db.add_params_by_username(user_db.LLMParamsRec(llmID, None, int(datetime.now().timestamp()*1000), 
                                                       paramsnp.purpose, paramsnp.params.model_dump_json(), None,
                                                       ParamsType.LLM_CONTEXT), 
                                                       current_user.username)
    count = params_db.get_count_by_name(current_user.username, llmID, ParamsType.LLM_CONTEXT)
    return {'llmID': llmID, 'count': count }

@router.delete("/params/{data_hash}")
def delete_param(data_hash:str, 
                 current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    params_db = ParamsDatabase(sqlite_dbname)
    count = params_db.delete_param(current_user.username, data_hash, ParamsType.LLM_PARAMS)
    return {'deleted': count}

@router.delete("/context/{data_hash}")
def delete_context(data_hash:str, 
                 current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    params_db = ParamsDatabase(sqlite_dbname)
    count = params_db.delete_param(current_user.username, data_hash, ParamsType.LLM_CONTEXT)
    return {'deleted': count}

if __name__ == '__main__':
  print ('Cannot execute as a program, it is a module')
