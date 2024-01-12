#!/usr/bin/env python

import json
from datetime            import datetime

from fastapi             import Depends, APIRouter, HTTPException

from libs.data           import LLMParamsHistory, LLMParams, LLMParamsSnap
from libs.auth           import get_current_active_user, User, sqlite_dbname
from libs                import user_db
from libs.user_db        import UserDatabase, ParamsDatabase


__version__ = "0.1"
__author__  = "Shalin Garg"

from typing import Annotated

__all__ = ["router", "MODELS"]

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
    },
    'gemini-pro-chat': {
        'id_for_prvdr': 'gemini-pro',
        'name': 'Google Gemini Pro Chat',
        'code': 'GGPC',
        'api-key': "AIzaSyAyd1PpWxnQ24dM51-onvVIlrkDtyUIKWM",
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
                new_dict[key] = copy_dict_and_remove_keys(value, keys_to_remove)
            else:
                new_dict[key] = value
    return new_dict


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

@router.get("/params/")
def get_all_params(current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    params_db = ParamsDatabase(sqlite_dbname)
    db_params = params_db.get_params_by_username(current_user.username)
    if db_params:
        params_list = []
        for param in db_params:
            params_list.append(json.loads(param.data))
        return { 'param_list': params_list }
    raise HTTPException(status_code=404, detail={'msg':f"Params not available"})

@router.get("/params/{llmID}")
def get_params(llmID:str, current_user: Annotated[User, Depends(get_current_active_user)]) -> LLMParams:
    params_db = ParamsDatabase(sqlite_dbname)
    db_params = params_db.get_latest_by_name_username(llmID, current_user.username)
    if db_params:
        return  json.loads(db_params.data)
    raise HTTPException(status_code=404, detail={'msg':f"Params for Model ID [{llmID}] not available"})

@router.put("/params/{llmID}")
def save_params(llmID: str, paramsnp: LLMParamsSnap, 
              current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    params_db = ParamsDatabase(sqlite_dbname)
    params_db.add_params_by_username(user_db.LLMParamsRec(llmID, None, int(datetime.now().timestamp()*1000), 
                                                       paramsnp.purpose, paramsnp.params.model_dump_json()), current_user.username)
    count = params_db.get_count_by_name(current_user.username, llmID)
    return {'llmID': llmID, 'count': count }

@router.delete("/params/{data_hash}")
def delete_param(data_hash:str, 
                 current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    params_db = ParamsDatabase(sqlite_dbname)
    count = params_db.delete_param(current_user.username, data_hash)
    return {'deleted': count}

if __name__ == '__main__':
  print ('Cannot execute as a program, it is a module')
