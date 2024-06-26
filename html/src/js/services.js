/*##################################################################################################
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
##################################################################################################*/

import { Model, ModelList, CodeFile, LLMParams, LLMParamsHistory, LLMContextHistory, User } from "./models.js";

class WebError extends Error {

  constructor(code, msg) {
    super(msg);
    this.code = code;
  }

  toString() {
    return `Code: ${this.code}, Message: [${super.toString()}]`
  }
}

class FetchAPI {
  //getToken() {
  //  return "";
  //  let token = sessionStorage.getItem('token');
  //  if (token) return "Bearer " + JSON.parse(token).access_token;
  //  throw new WebError(401, "Not Authorized to call a service");
  //}

  async get(uri, params = {}) {
    const urlObj = new URL(uri, window.location.origin);
    Object.keys(params).forEach(key => urlObj.searchParams.append(key, params[key]));
    const response = await fetch(urlObj.toString());
    await this.handleResponse(response);
    return await response.json();
  }

  async getImage(uri, params = {}) {
    const urlObj = new URL(uri, window.location.origin);
    Object.keys(params).forEach(key => urlObj.searchParams.append(key, params[key]));
    const response = await fetch(urlObj.toString());
    await this.handleResponse(response);
    return response.blob();
  }

  async post(url, data) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    await this.handleResponse(response);
    return await response.json();
  }

  async put(url, data) {    // data : JSON
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    await this.handleResponse(response);
    return await response.json();
  }

  async delete(uri, query=null, data=null) {    // data : JSON
    const urlObj = new URL(uri, window.location.origin);
    if (query) {
      Object.keys(query).forEach(key => urlObj.searchParams.append(key, query[key]));
    }
    const response = await fetch(urlObj.toString(), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : ""
    });
    await this.handleResponse(response);
    return await response.json();
  }

  async handleResponse(response) {
    if (!response.ok) {
      const code = response.status;
      let data = await response.text();
      try {
        data = JSON.parse(data);
      } catch (err) {
        // Response is not valid JSON
        console.log(`Code: ${code}, Response: [${data}]`);
        throw new WebError(code, data);
      }

      let msg = "";
      if (data.detail && Array.isArray(data.detail)) {
        data.detail.forEach(error => {
          if (error.loc && error.msg && error.type) {
            msg += error.msg + ", "
            console.log(`Code: ${code}, Location: ${error.loc.join(', ')}, Message: ${error.msg}, Type: ${error.type}`);
          }
        });
      } else if (typeof data === 'object') {
        if (data.detail) {
          msg = data.detail.msg;
          if (data.detail.loc && data.detail.msg && data.detail.type) {
            console.log(`Code: ${code}, Location: ${data.detail.loc.join(', ')}, Message: ${msg}, Type: ${data.detail.type}`);
          } else {
            msg = msg ? msg : data.detail;
            console.log(`Code: ${code}, Message: ${msg}`)
          }
        } else {
          msg = JSON.stringify(data);
          console.log(`Code: ${code}, Response: [${msg}]`);
        }
      } else {
        msg = data;
        console.log(msg);
      }

      throw new WebError(code, msg);
    }
  }
}

class ModelService {
  constructor() {
  }

  async getModels() {
    // Return a ModelList object
    const response = await new FetchAPI().get('/models/');
    return new ModelList(Object.keys(response).map(id => Model.fromJSON({ 'id': id, ...response[id] })));
  }
}

class FilesService {
  constructor() {
  }

  async getFiles(dirName = null, editable = false) {
    const response = await new FetchAPI().get('/files/' + (dirName ? dirName : ""), { 'editable': editable });
    if ((dirName && response.dirname == dirName) || (dirName == null && response.dirname == "/")) {
      return response.files;
    } else {
      throw new Error(`Unable to fetch Directory Listing for [${dirName}]`);
    }
  }

  async getFileContent(filepath, editable = false) {
    if (!filepath || filepath.length == 0) {
      throw new Error("Cannot get file content without filename.");
    }

    const response = await new FetchAPI().get('/files/' + filepath, { 'editable': editable });
    if (filepath && response.name == filepath) {
      return CodeFile.fromJSON(response);
    } else if (editable && filepath && response.name) {
      return CodeFile.fromJSON(response);
    } else {
      console.log(response);
      throw new Error(`Unable to fetch File [${filepath}]`);
    }
  }

  async getGitFiles() {
    const response = await new FetchAPI().get('/gitfiles/');
    if (response.dirname == "/") {
      return response.files;
    } else {
      throw new Error(`Unable to fetch Directory Listing from Git`);
    }
  }
  
  async getGitFileContent(filepath) {
    if (!filepath || filepath.length == 0) {
      throw new Error("Cannot get file content without filename.");
    }

    const response = await new FetchAPI().get('/gitfiles/' + filepath);
    if (filepath && response.name == filepath) {
      return CodeFile.fromJSON(response);
    } else {
      console.log(response);
      throw new Error(`Unable to fetch File [${filepath}]`);
    }
  }

  async saveFile(codeFile) {
    if (!codeFile || codeFile.content == null) {
      throw new Error(`Cannot save file [${codeFile.name}] without content.`);
    }

    const response = await new FetchAPI().put('/files/' + codeFile.name, codeFile.toJSON());
    if (response.name && response.version) {
      return CodeFile.fromJSON(response);  // This response should not have the "file.content"
    } else {
      console.log(`Incomplete Save File response [${JSON.stringify(response)}]`);
      throw new Error("Unable to save successfully, see console");
    }
  }

  async deleteFile(filepath, editable = true) {
    if (!filepath) {
      throw new Error("Cannot delete file without its name");
    }

    const response = await new FetchAPI().delete('/files/' + filepath, { 'editable': editable });
    if (response.name && response.deleted) {
      console.log(`File [${response.name}] Deleted [${response.deleted}]`);
    } else {
      throw new Error(`Unable to delete File [${response.name}] Deleted [${response.deleted}]`);
    }

    return response;
  }

  async uploadFile(formData, dirpath) {
    const response = await fetch("/uploadfiles/"+dirpath.trim().replace(/^\//, ""), {
      method: "POST",
      // Set the FormData instance as the request body
      body: formData,
    });
    await new FetchAPI().handleResponse(response);
    return await response.json();
  }
}

class LLMParamsService {
  constructor() {
  }

  async getAllParamsHistory() {
    const response = await new FetchAPI().get('/params-history/');
    if (response.records) {
      return new LLMParamsHistory(response);
    } else {
      console.log(response);
      throw new Error('Unable to fetch all params history');
    }
  }

  async getAllParams() {
    const response = await new FetchAPI().get('/params/');
    if (response.param_list) {
      return response.param_list.map(param => LLMParams.fromJSON(param));
    } else {
      console.log(response);
      throw new Error('Unable to fetch all params');
    }
  }

  async getParams(llmID) {
    const response = await new FetchAPI().get('/params/' + llmID);
    if (response.llmID && response.llmID == llmID) {
      return LLMParams.fromJSON(response);
    } else {
      console.log(response);
      throw new Error(`Unable to fetch Params for [${llmID}]`);
    }
  }

  async saveParams(paramsnp) {
    if (!paramsnp) {
      throw new Error(`Cannot save null LLMParams.`);
    }

    const response = await new FetchAPI().put('/params/' +paramsnp.params.llmID, paramsnp.toJSON());
    if (response.llmID && response.count) {
      return response;
    } else {
      console.log(`Incomplete Save Params response [${JSON.stringify(response)}]`);
      throw new Error("Unable to save params successfully, see console");
    }
  }

  async deleteParam(paramSnap) {
    if (!paramSnap || !paramSnap.hash) {
      throw new Error(`Cannot delete null LLMParams.`);
    }

    const response = await new FetchAPI().delete('/params/' + paramSnap.hash);  // no Query, no Body
    if (response.deleted > 0) {
      return response;
    } else {
      console.log(`Unable to delete Param. Response [${JSON.stringify(response)}]`);
      throw new Error("Unable to delete param successfully, see console");
    }
  }
}

class LLMContextService {
  constructor() {
  }

  async getAllContexts() {
    const response = await new FetchAPI().get('/context/');
    if (response.records) {
      return new LLMContextHistory(response);
    } else {
      console.log(response);
      throw new Error('Unable to fetch all params');
    }
  }

  async getContext(llmID) {
    const response = await new FetchAPI().get('/context/' + llmID);
    if (response.llmID && response.llmID == llmID) {
      return LLMParams.fromJSON(response);
    } else {
      console.log(response);
      throw new Error(`Unable to fetch Params for [${llmID}]`);
    }
  }

  async saveContext(paramsnp) {
    if (!paramsnp) {
      throw new Error(`Cannot save null LLM Context.`);
    }

    const response = await new FetchAPI().put('/context/' +paramsnp.params.llmID, paramsnp.toJSON());
    if (response.llmID && response.count) {
      return response;
    } else {
      console.log(`Incomplete Save Context response [${JSON.stringify(response)}]`);
      throw new Error("Unable to save Context successfully, see console");
    }
  }

  async deleteContext(paramSnap) {
    if (!paramSnap || !paramSnap.hash) {
      throw new Error(`Cannot delete null LLM Context.`);
    }

    const response = await new FetchAPI().delete('/context/' + paramSnap.hash);  // no Query, no Body
    if (response.deleted > 0) {
      return response;
    } else {
      console.log(`Unable to delete Context. Response [${JSON.stringify(response)}]`);
      throw new Error("Unable to delete context successfully, see console");
    }
  }
}


class LLMService {
  constructor() {
  }

  async callLLM(params) {
    // Returns text

    const response = await new FetchAPI().post('/llm/', params.toJSON());
    //console.log(response);
    // Gets a model_resp JSON attribute
    return response.model_resp;
  }
}

class ChatService {
  constructor() {
  }

  async callLLM(message) {
    // Returns text

    const response = await new FetchAPI().post('/chat/', message.toJSON());
    //console.log(response);
    // Gets a model_resp JSON attribute
    return response.model_resp;
  }
}

class LoginService {
  constructor() {
  }

  async login(formData) {
    let response = await fetch("/token", {
      method: 'POST',
      body: new URLSearchParams(formData)
    });
    if (response.ok) {
      return await response.json();
    } else {
      throw new WebError(response.status, await response.text());
    }
  }

  async logout() {
    await fetch("/logout");
  }

  async me() {
    return User.fromJSON(await new FetchAPI().get("/users/me"));
  }

  async isSessionValid() {
    try {
      await new LoginService().me();
    } catch (err) {
      return false;
    }
    return true;
  }
}

export { WebError, FetchAPI, ModelService, FilesService, LLMService, ChatService, LLMParamsService, LLMContextService, LoginService }