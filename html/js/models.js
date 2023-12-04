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
    this.system_prompt = system_prompt || null;
    this.topk = topk || null;
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

  findByNmae(name) {
    // return undefined if not found
    return this.modelList.find((model) => model.name == name);
  }
}

class LLMParams {
  constructor(llmID = '', temp = 0.0, maxTokens = 0, topp = 0.0, topk = null,
    repeat_penalty = null, presence_penalty = null, sys_prompt = null, context = null,
    code_snippet = null, user_prompt = '') {
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

class CodeFile {
  constructor(name, version = 0, content = null) {
    this.name = name;
    this.version = version == null ? 0 : version;
    this.content = content;
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

export { Model, ModelKwargs, LLMParams, ModelList, CodeFile, CodeFileCache }