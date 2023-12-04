import { Model, ModelList, CodeFile } from "./models.js";

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
  async get(uri, params = {}) {
    const urlObj = new URL(uri, window.location.origin);
    Object.keys(params).forEach(key => urlObj.searchParams.append(key, params[key]));
    const response = await fetch(urlObj.toString());
    await this.handleResponse(response);
    return await response.json();
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
    console.log(response);
    return new ModelList(Object.keys(response).map(id => Model.fromJSON({ 'id': id, ...response[id] })));
  }
}

class FilesService {
  constructor() {
  }

  async getFiles(dirName = null, editable = false) {
    const response = await new FetchAPI().get('/files/' + (dirName ? dirName : ""), { 'editable': editable });
    if ((dirName && response.dirname == dirName) || (dirName == null && response.dirname == "")) {
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

  async saveFile(codeFile) {
    if (!codeFile || codeFile.content == null) {
      throw new Error(`Cannot save file [${codeFile.name}] without content.`);
    }

    const response = await new FetchAPI().put('/files/' + codeFile.name, codeFile.toJSON());
    if (response.name && response.version) {
      return CodeFile.fromJSON(response);  // This response does not have the "file.content"
    } else {
      console.log(`Incomplete Save File response [${JSON.stringify(response)}]`);
      throw new Error("Unable to save successfully, see console");
    }
  }
}

class LLMService {
  constructor() {
  }

  async callLLM(params) {
    // Returns text

    const response = await new FetchAPI().post('/llm/', params.toJSON());
    console.log(response);
    // Gets a model_resp JSON attribute
    return response.model_resp;
  }
}

export { WebError, ModelService, FilesService, LLMService }