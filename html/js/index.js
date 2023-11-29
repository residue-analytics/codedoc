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
    constructor(temperature, max_new_tokens, topp_nucleus_sampling, repetition_penalty, system_prompt, topk) {
        this.temperature = temperature;
        this.max_new_tokens = max_new_tokens;
        this.topp_nucleus_sampling = topp_nucleus_sampling;
        this.repetition_penalty = repetition_penalty;
        this.system_prompt = system_prompt || null;
        this.topk = topk || null;
    }

    toJSON() {
        return {
            temperature: this.temperature,
            max_new_tokens: this.max_new_tokens,
            topp_nucleus_sampling: this.topp_nucleus_sampling,
            repetition_penalty: this.repetition_penalty,
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
            json.system_prompt,
            json.topk
        );
    }
}

class LLMParams {
    constructor(llmID = '', temp = 0.0, maxTokens = 0, topp = 0.0, topk = null, 
    repeat_penalty = null, sys_prompt = "You are a helpful assistant", context = null, 
    code_snippet = null, user_prompt = '') {
        this.llmID = llmID;
        this.model_kwargs = new ModelKwargs(temp, maxTokens, topp, repeat_penalty, sys_prompt, topk);
        this.context = context;
        this.code_snippet = code_snippet;
        this.user_prompt = user_prompt;
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
            system_prompt, topk, context, code_snippet, user_prompt } = json;
        return new LLMParams(llmID, temperature, max_new_tokens, topp_nucleus_sampling, topk, 
            repetition_penalty, system_prompt, context, code_snippet, user_prompt);
    }
}

class FetchAPI {
    async get(url) {
        const response = await fetch(url);
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

    async put(url, data) {
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
            let data = await response.text();
            try {
                data = JSON.parse(data);
            } catch(err) {
                // Response is not valid JSON
                console.log(`Code: ${code}, Response: [${data}]`);
                throw new Error(`Code: ${code}, Response: [${data}]`);
            }

            const code = response.status;
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

            throw new Error(`Code: ${code}, Reason: [${msg}]`);
        }
    }
}

class ModelService {
    constructor() {
    }

    async getModels() {
        const response = await new FetchAPI().get('/models');
        console.log(response);
        return Object.keys(response).map(id => Model.fromJSON({ 'id': id, ...response[id] }));
    }
}

class FilesService {
    constructor() {
    }

    async getFiles(dirName = null) {
        const response = await new FetchAPI().get('/files/' + (dirName ? dirName : ""));
        if ((dirName && response.dirname == dirName) || (dirName == null && response.dirname == "")) {
            return response.files;
        } else {
            throw new Error(`Unable to fetch Directory Listing for [${dirName}]`);
        }
    }

    async getFileContent(filepath) {
        if (!filepath || filepath.length == 0) {
            throw new Error("Cannot get file content without filename.");
        }

        const response = await new FetchAPI().get('/files/' + filepath);
        if (filepath && response.file == filepath) {
            return response.data;
        } else {
            throw new Error(`Unable to fetch File [${filepath}]`);
        }
    }
}



(function() {
  var editor2 = ace.edit("editor2");
  editor2.setTheme("ace/theme/monokai");
  editor2.session.setMode("ace/mode/javascript");

  // Attach Event Handlers
  document.getElementById('ModelSelectorBtn').addEventListener('click', function() {
    document.getElementById('ModelSelector').parentElement.classList.toggle('visually-hidden');
  });
  document.getElementById('ModelSelector').addEventListener('input', function(event) {
    document.getElementById('ModelSelectorBtn').querySelector(".badge").innerHTML = this.value;
  });

  document.getElementById('SysPromptBtn').addEventListener('click', function() {
    document.getElementById('SysPromptInput').parentElement.classList.toggle('visually-hidden');
  });

  document.getElementById('UsrPromptBtn').addEventListener('click', function() {
    document.getElementById('UsrPromptInput').parentElement.classList.toggle('visually-hidden');
  });

  document.getElementById('TemperatureBtn').addEventListener('click', function() {
    document.getElementById('TemperatureInput').parentElement.classList.toggle('visually-hidden');
  });
  document.getElementById('TemperatureInput').addEventListener('input', function(event) {
    document.getElementById('TemperatureBtn').querySelector(".badge").innerHTML = this.value;
  });

  document.getElementById('ToppBtn').addEventListener('click', function() {
    document.getElementById('ToppInput').parentElement.classList.toggle('visually-hidden');
  });
  document.getElementById('ToppInput').addEventListener('input', function(event) {
    document.getElementById('ToppBtn').querySelector(".badge").innerHTML = this.value;
  });

  document.getElementById('MaxTokensBtn').addEventListener('click', function() {
    document.getElementById('MaxTokensInput').parentElement.parentElement.classList.toggle('visually-hidden');
  });

  document.getElementById('RepeatPenaltyBtn').addEventListener('click', function() {
    document.getElementById('RepeatPenaltyInput').parentElement.classList.toggle('visually-hidden');
  });
  document.getElementById('RepeatPenaltyInput').addEventListener('input', function(event) {
    document.getElementById('RepeatPenaltyBtn').querySelector(".badge").innerHTML = this.value;
  });

  document.getElementById('TopkBtn').addEventListener('click', function() {
    document.getElementById('TopkInput').parentElement.parentElement.classList.toggle('visually-hidden');
  });
  document.getElementById('TopkInput').addEventListener('input', function(event) {
    document.getElementById('TopkBtn').querySelector(".badge").innerHTML = this.value;
  });
}
)()

