class Model {
  constructor(id, name, code, provider, model_kwargs) {
    this.id = id;
    this.name = name;
    this.code = code;
    this.provider = provider;
    this.model_kwargs = model_kwargs;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      code: this.code,
      provider: this.provider,
      model_kwargs: this.model_kwargs.toJSON()
    };
  }

  static fromJSON(json) {
    return new Model(
      json.id,
      json.name,
      json.code,
      json.provider,
      ModelKwargs.fromJSON(json.model_kwargs)
    );
  }
}

class ModelKwargs {
  constructor(temperature, max_new_tokens, topp_nucleus_sampling, repetition_penalty, 
    presence_penalty, system_prompt, topk) {
    this.temperature = temperature;
    this.max_new_tokens = max_new_tokens;
    this.topp_nucleus_sampling = topp_nucleus_sampling;
    this.repetition_penalty = repetition_penalty;
    this.presence_penalty = presence_penalty;
    this.system_prompt = system_prompt;
    this.topk = topk;
  }

  toJSON() {
    return {
      temperature: this.temperature,
      max_new_tokens: this.max_new_tokens,
      topp_nucleus_sampling: this.topp_nucleus_sampling,
      repetition_penalty: this.repetition_penalty,
      presence_penalty: this.presence_penalty,
      system_prompt: this.system_prompt,
      topk: this.topk
    };
  }

  static fromJSON(json) {
    return new ModelKwargs(
      json.temperature,
      json.max_new_tokens,
      json.topp_nucleus_sampling,
      json.repetition_penalty,
      json.presence_penalty,
      json.system_prompt,
      json.topk
    );
  }
}

class ModelList {
  // An array of models providing utility methods to search
  constructor(modelList) {
    this.modelList = modelList;
  }

  map(callback) {
    return this.modelList.map(callback);
  }

  findByID(id) {
    // return undefined if not found
    return this.modelList.find((model) => model.id == id);
  }

  findByCode(code) {
    // return undefined if not found
    return this.modelList.find((model) => model.code == code);
  }

  findByName(name) {
    // return undefined if not found
    return this.modelList.find((model) => model.name == name);
  }
}

class LLMParams {
  constructor(llmID = '', temp = 0.0, maxTokens = 0, topp = 0.0, topk = null,
    repeat_penalty = null, presence_penalty = null, sys_prompt = null, context = null,
    code_snippet = null, user_prompt = '') {
    // console.log(`repeat [${repeat_penalty}] presence [${presence_penalty}]`);
    this.llmID = llmID;
    this.model_kwargs = new ModelKwargs(temp, maxTokens, topp, repeat_penalty, presence_penalty, sys_prompt, topk);
    this.context = context;
    this.code_snippet = code_snippet;
    this.user_prompt = user_prompt;
  }

  static fromModel(model, sys_prompt = null, context = null, code_snippet = null, user_prompt = '') {
    // System Prompt, Context, Code, User Prompt?
    const kwargs = model.model_kwargs;
    return new LLMParams(model.id, kwargs.temperature, kwargs.max_new_tokens, kwargs.topp_nucleus_sampling,
      kwargs.topk, kwargs.repetition_penalty, kwargs.presence_penalty, sys_prompt, context, code_snippet, user_prompt);
  }

  // Method to convert class to JSON
  toJSON() {
    return {
      llmID: this.llmID,
      ...this.model_kwargs.toJSON(),
      context: this.context,
      code_snippet: this.code_snippet,
      user_prompt: this.user_prompt
    };
  }

  // Method to create class from JSON
  static fromJSON(json) {
    const { llmID, temperature, max_new_tokens, topp_nucleus_sampling, repetition_penalty,
      presence_penalty, system_prompt, topk, context, code_snippet, user_prompt } = json;
    return new LLMParams(llmID, temperature, max_new_tokens, topp_nucleus_sampling, topk,
      repetition_penalty, presence_penalty, system_prompt, context, code_snippet, user_prompt);
  }
}

class LLMParamsSnap {
  constructor(tm=null, user="", purpose="", hash="", params=None) {
    this.tm = tm;
    this.user = user;
    this.purpose = purpose;
    this.hash = hash;
    this.params = params;
  }

  toJSON() {
    return {
      tm: this.tm,
      user: this.user,
      purpose: this.purpose,
      hash: this.hash,
      params: this.params.toJSON(),
    };
  }

  static fromJSON(json) {
    return new LLMParamsSnap(
      json.tm, 
      json.user, 
      json.purpose,
      json.hash, 
      LLMParams.fromJSON(json.params)
    );
  }
}

class LLMParamsHistory {
  constructor(paramsSnaps={records:[]}) {
    this.records = paramsSnaps.records;
    this.user_tm_tree = new Map();
    if (this.records && this.records.length > 0) {
      this.updateTree(this.records);
    }
  }

  count() {
    return this.records.length;
  }

  updateTree(paramsSnaps) {
    paramsSnaps.forEach((paramsSnap) => {
      const tm_tree = this.user_tm_tree.get(paramsSnap.user);
      if (tm_tree) {
        tm_tree[paramsSnap.tm] = LLMParamsSnap.fromJSON(paramsSnap);
      } else {
        const tm_tree = new Map();
        tm_tree[paramsSnap.tm] = LLMParamsSnap.fromJSON(paramsSnap);
        this.user_tm_tree[paramsSnap.user] = tm_tree;
      }
    });
  }

  addParam(param) {
    this.records.append(param);
    this.updateTree([param]);
  }

  toJSON() {
    return {
      records: this.records.map((paramsSnap) => paramsSnap.toJSON())
    }
  }

  static fromJSON(json) {
    if (json.records && json.records.length > 0) {
      return new LLMParamsHistory(json);
    }

    throw new Error("Cannot create Params History without history records");
  }
}

class CodeFile {
  constructor(name, version = 0, content = null) {
    this.name = name;
    this.version = version == null ? 0 : version;
    this.content = content;
    this.llmParams = null;
  }

  toJSON() {
    return {
      name: this.name,
      version: this.version,
      content: this.content
    };
  }

  static fromJSON(json) {
    return new CodeFile(
      json.name,
      json.version,
      json.content
    );
  }
}

class CodeFileCache {
  constructor() {
    this.cache = new Map();  // { filename -> CodeFile() }
  }

  put(file) {
    this.cache.set(file.name, file);
  }

  get(name) {
    // returns the internal referenced object, beware of changes made are reflected here.
    //   undefined, if not found
    return this.cache.get(name);
  }
}

class User {
  constructor(username, email, fullname, disabled) {
    this.username = username;
    this.email = email
    this.fullname = fullname;
    this.disabled = disabled;
  }

  toJSON() {
    return {
      username: this.username,
      email: this.email,
      fullname: this.fullname,
      disabled: this.disabled
    };
  }

  static fromJSON(json) {
    return new User(
      json.username,
      json.email,
      json.fullname,
      json.disabled
    );
  }
}

class FileTree {
  constructor(strList) {
    // [ "file1", "file2", "dir1/dir2/c", "dir1/d", "dir1/e" ]
    this.filePathList = strList;
    this.tree = {};
    this.buildTree();
  }

  buildTree() {
    for (let path of this.filePathList) {
      let pathParts = path.split('/');
      let currentLevel = this.tree;
      
      while (pathParts.length) {
        let part = pathParts.shift();
        
        if (!currentLevel[part]) {
            currentLevel[part] = {};
        }
        
          currentLevel = currentLevel[part];
      }
    }
  }

  getFormattedTreejs() {
    return this.convertToTreejsFormat(this.tree);
  }

  convertToTreejsFormat(obj) {
    return Object.keys(obj).map(key => {
        if (Object.keys(obj[key]).length) {
            return {
                name: key,
                type: 'folder',
                children: this.convertToTreejsFormat(obj[key])
            };
        } else {
            return { name: key };
        }
    });
  }
}

class GlobalData {
  constructor() {
    this._usr = "guest";
    this._gcred = null;
    this._livetm = 0;  // msec
    
  }

  userLogout() {
    this._usr = "guest";
    this._gcred = null;
    this._livetm = 0;
  }

  userNav() {
    this._livetm = 0;
  }


  get username() {
    return this._usr;
  }
  set username(val) {
    this._usr = val;
  }

  get gcred() {
    return this._gcred;
  }
  set gcred(val) {
    this._gcred = val;
  }

  get now() {
    // msec
    return this._livetm;
  }
  set now(val) {
    //console.log(`DBG: Global now set to [${val}]`);
    this._livetm = val;
  }
}


export { Model, ModelKwargs, LLMParams, ModelList, LLMParamsSnap, LLMParamsHistory, CodeFile, CodeFileCache, User, GlobalData, FileTree }