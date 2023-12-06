import { Model, ModelKwargs, LLMParams, ModelList } from "./models.js";
import { WebError, ModelService, FilesService, LLMService } from "./services.js";
import { VanillaEditor, AceEditor } from "./editors.js";
import { UIUtils } from "./utils.js";

class LLMParamUIPair {
  constructor(btnID, elemID, type, updateBadge=true, dualParent=false) {
    this.btnID = btnID;
    this.elemID = elemID;
    this.type = type;      // select, textarea, range, number
    this.btn  = document.getElementById(btnID);
    this.elem = document.getElementById(elemID);
    this.disabled = false;
    this.dualParent = dualParent;

    this.setShowHide();
    if (updateBadge) {
      this.setValueUpdates();
    }
  }

  setShowHide() {
    this.btn.addEventListener('click', () => {
      if (this.dualParent) {
        this.elem.parentElement.parentElement.classList.toggle('visually-hidden');
      } else {
        this.elem.parentElement.classList.toggle('visually-hidden');
      }
    });
  }

  setValueUpdates() {
    this.elem.addEventListener('input', (event) => {
      this.btn.querySelector(".badge").innerHTML = event.target.value;
    });
  }

  getValue() {
    console.log(`Elem [${this.elemID}] Value[${this.elem.value}]`);
    return this.elem.value;
  }

  setValue(value) {
    this.elem.value = value;
  }

  disable() {
    // console.log(`Disabling [${this.btnID}]`);
    this.btn.disabled = true;
    this.disabled = true;
    if (this.dualParent) {
      if (!this.elem.parentElement.parentElement.classList.contains('visually-hidden')) {
        this.elem.parentElement.parentElement.classList.toggle('visually-hidden');
        this.btn.classList.toggle("active");
      }
    } else {
      if (!this.elem.parentElement.classList.contains('visually-hidden')) {
        this.elem.parentElement.classList.toggle('visually-hidden');
        this.btn.classList.toggle("active");
      }
    }
  }

  enable() {
    // console.log(`Enabling [${this.btnID}]`);
    this.btn.disabled = false;
    this.disabled = false;
  }

  enabled() {
    return !this.disabled;
  }
}

class LLMParamsUI {
  constructor() {
    this.modelLLMParam = null;
    this.sysPromParam = null;
    this.usrPromParam = null;
    this.ctxParam = null;
    this.tempLLMParam = null;
    this.toppLLMParam = null;
    this.maxTokenParam = null;
    this.reppenLLMParam = null;
    this.prspenLLMParam = null;
    this.topkLLMParam = null;
  }

  getLLMParams() {
    return new LLMParams(
      globals.models.findByCode(this.modelLLMParam.getValue()).id, 
      this.tempLLMParam.enabled()   ? parseFloat(this.tempLLMParam.getValue()) : null, 
      this.maxTokenParam.enabled()  ? parseInt(this.maxTokenParam.getValue()) : null, 
      this.toppLLMParam.enabled()   ? parseFloat(this.toppLLMParam.getValue()) : null, 
      this.topkLLMParam.enabled()   ? parseInt(this.topkLLMParam.getValue()) : null,
      this.reppenLLMParam.enabled() ? parseFloat(this.reppenLLMParam.getValue()) : null, 
      this.prspenLLMParam.enabled() ? parseFloat(this.prspenLLMParam.getValue()) : null, 
      this.sysPromParam.enabled()   ? this.sysPromParam.getValue() : null, 
      this.ctxParam.enabled()       ? this.ctxParam.getValue() : null,
      null, // Code Snippet
      this.usrPromParam.enabled()   ? this.usrPromParam.getValue() : null
    );
  }

  updateLLMParams(params) {
    this.updateKWArgs(params.model_kwargs);
    if (params.user_prompt == null) {
      this.usrPromParam.disable();
    } else {
      this.usrPromParam.enable();
      this.usrPromParam.setValue(params.user_prompt);
    }
  }

  updateKWArgs(kwargs) {
    if (kwargs.temperature == null) {
      this.tempLLMParam.disable();
    } else {
      this.tempLLMParam.enable();
      this.tempLLMParam.setValue(kwargs.temperature);
    }

    if (kwargs.max_new_tokens == null) {
      this.maxTokenParam.disable();
    } else {
      this.maxTokenParam.enable();
      this.maxTokenParam.setValue(kwargs.max_new_tokens);
    }

    if (kwargs.topp_nucleus_sampling == null) {
      this.toppLLMParam.disable();
    } else {
      this.toppLLMParam.enable();
      this.toppLLMParam.setValue(kwargs.topp_nucleus_sampling);
    }

    if (kwargs.repetition_penalty == null) {
      this.reppenLLMParam.disable();
    } else {
      this.reppenLLMParam.enable();
      this.reppenLLMParam.setValue(kwargs.repetition_penalty);
    }

    if (kwargs.presence_penalty == null) {
      this.prspenLLMParam.disable();
    } else {
      this.prspenLLMParam.enable();
      this.prspenLLMParam.setValue(kwargs.presence_penalty);
    }
    
    if (kwargs.system_prompt == null) {
      this.sysPromParam.disable();
    } else {
      this.sysPromParam.enable();
      this.sysPromParam.setValue(kwargs.system_prompt);
    }

    if (kwargs.topk == null) {
      this.topkLLMParam.disable();
    } else {
      this.topkLLMParam.enable();
      this.topkLLMParam.setValue(kwargs.topk);
    }
  }
}

class Globals {
  constructor() {
    this.readOnlyEditor = null;
    this.editor = null;
    this.llmSelector = null;
    this.models = null;
    this.llmParamsUI = new LLMParamsUI();
  }

  setEditor(editorID) {
    this.editor = new AceEditor(editorID);
  }

  setReadOnlyEditor(editorID) {
    this.readOnlyEditor = new VanillaEditor(editorID);
    this.readOnlyEditor.setupListenerOnRoot((name, type) => {
      if (type == 'file') {
        this.editor.editFile(name).catch(err => {
          UIUtils.showAlert("erroralert", err);
        });
      }
      console.log(`Clicked on [${name}] of type [${type}]`);
    });
  }

  setLLModels(selectorID) {
    new ModelService().getModels().then((models) => {
      this.models = models;
      let dropdownOpts = this.models.map((model) => {
        return { value: model.code, text: `${model.name} (${model.code})` }
      });

      UIUtils.updSelectDropdown(selectorID, dropdownOpts);
    });
  }

  getToken() {
    let token = sessionStorage.getItem('token');
    if (token) return JSON.parse(token);
    return null;
  }

  saveToken(tokenJSON) {
    sessionStorage.setItem('token', JSON.stringify(tokenJSON));
  }

  clearToken() {
    sessionStorage.removeItem('token');
  }

  saveLLMParams() {
    let params = this.llmParamsUI.getLLMParams();
    params.context = "";       // We are not going to save context
    params.code_snippet = "";  //   and code snippet
    sessionStorage.setItem(params.llmID, JSON.stringify(params.toJSON()));
    console.log(`Saved Param for [${params.llmID}]`);
  }

  getSavedLLMParams(modelID) {
    let item = sessionStorage.getItem(modelID);
    if (item) {
      console.log(`Found saved params for [${modelID}]`);
      return LLMParams.fromJSON(JSON.parse(item));
    }

    return null;
  }

  restoreLLMParamsFromSession(modelCode=null) {
    let params = null;

    if (!modelCode) {
      modelCode = this.llmParamsUI.modelLLMParam.getValue();
    }

    let model = globals.models.findByCode(modelCode);
    params = this.getSavedLLMParams(model.id);
    if (params) {
      this.llmParamsUI.updateLLMParams(params);
    } else {
      this.llmParamsUI.updateKWArgs(model.model_kwargs);
    }
  }
}

function showOneDiv(divID) {
  // Manages the "Logout", "LoginDiv", "MainDiv"
  if (divID == "LoginDiv") {
    // We have just logged out, show and hide appropriate divs
    document.getElementById("LoginDiv").classList.remove("visually-hidden");
    document.getElementById("MainDiv").classList.add("visually-hidden");
    document.getElementById("Logout").parentElement.classList.add("visually-hidden");
  } else if (divID == "MainDiv") {
    document.getElementById("LoginDiv").classList.add("visually-hidden");
    document.getElementById("MainDiv").classList.remove("visually-hidden");
    document.getElementById("Logout").parentElement.classList.remove("visually-hidden");
  }
}

const globals = new Globals();

(function () {

  // Attach Event Handlers
  globals.llmParamsUI.modelLLMParam = new LLMParamUIPair('ModelSelectorBtn', 'ModelSelector', 'select');
  globals.llmParamsUI.sysPromParam = new LLMParamUIPair('SysPromptBtn', 'SysPromptInput', 'textarea', false);
  globals.llmParamsUI.ctxParam = new LLMParamUIPair('ContextBtn', 'ContextInput', 'textarea', false);
  globals.llmParamsUI.usrPromParam = new LLMParamUIPair('UsrPromptBtn', 'UsrPromptInput', 'textarea', false);
  globals.llmParamsUI.tempLLMParam = new LLMParamUIPair('TemperatureBtn', 'TemperatureInput', 'range');
  globals.llmParamsUI.toppLLMParam = new LLMParamUIPair('ToppBtn', 'ToppInput', 'range');
  globals.llmParamsUI.maxTokenParam = new LLMParamUIPair('MaxTokensBtn', 'MaxTokensInput', 'number', false, true);
  globals.llmParamsUI.reppenLLMParam = new LLMParamUIPair('RepeatPenaltyBtn', 'RepeatPenaltyInput', 'range');
  globals.llmParamsUI.prspenLLMParam = new LLMParamUIPair('PresencePenaltyBtn', 'PresencePenaltyInput', 'range');
  globals.llmParamsUI.topkLLMParam = new LLMParamUIPair('TopkBtn', 'TopkInput', 'number', true, true);

  document.getElementById("Logout").addEventListener("click", () => {
    globals.clearToken();
    showOneDiv("LoginDiv");
  });

  document.getElementById("loginBtn").addEventListener("click", async (event) => {
    event.preventDefault();
    // TODO do something here to show user that form is being submitted
    let response = await fetch("/token", {
        method: 'POST',
        body: new URLSearchParams(new FormData(document.forms['loginForm']))
    });
    document.getElementById("password").value = "";
    if (!response.ok) {
      UIUtils.showAlert('erroralert', `HTTP error! Status: ${response.status}`);
    } else {
        globals.saveToken(await response.json());
        showOneDiv("MainDiv");
    }
  });
  
  document.getElementById('SaveParams').addEventListener('click', function () {
    globals.saveLLMParams();
  });

  document.getElementById('ModelSelector').addEventListener('input', function(event) {
    globals.restoreLLMParamsFromSession(event.target.value);
  });

  document.getElementById('Discard').addEventListener('click', function () {
      globals.editor.discardChanges();
  });

  document.getElementById('SaveFile').addEventListener('click', function () {
    try {
      UIUtils.addSpinnerToIconButton('SaveFile');
      new FilesService().saveFile(globals.editor.getCurFile()).then((codeFile) => {
        UIUtils.rmSpinnerFromIconButton('SaveFile');
        codeFile.content = globals.editor.getCode();
        globals.editor.curFileSavedSuccessfully(codeFile);
        UIUtils.showAlert('erroralert', `File [${codeFile.name}] saved with version [${codeFile.version}]`);
      });
    } catch (err) {
      UIUtils.rmSpinnerFromIconButton('SaveFile');
      UIUtils.showAlert("erroralert", err);
    }
  });

  document.getElementById('SendToLLM').addEventListener('click', function () {
    let params = globals.llmParamsUI.getLLMParams();
    
    document.getElementById('ModelOutput').value = "";
    UIUtils.addSpinnerToIconButton('SendToLLM');
    new LLMService().callLLM(params)
    .then( resp => {
      UIUtils.rmSpinnerFromIconButton('SendToLLM');
      document.getElementById('ModelOutput').value = resp;
    }).catch( err => {
      UIUtils.rmSpinnerFromIconButton('SendToLLM');
      document.getElementById('ModelOutput').value = err;
    });
  });
  
  document.getElementById('SendFileToLLM').addEventListener('click', function () {
    let params = globals.llmParamsUI.getLLMParams();
    params.code_snippet = globals.editor.getCode();
    
    document.getElementById('ModelOutput').value = "";
    UIUtils.addSpinnerToIconButton('SendFileToLLM');
    new LLMService().callLLM(params)
    .then( resp => {
      UIUtils.rmSpinnerFromIconButton('SendFileToLLM');
      document.getElementById('ModelOutput').value = resp;
    }).catch( err => {
      UIUtils.rmSpinnerFromIconButton('SendFileToLLM');
      document.getElementById('ModelOutput').value = err;
    });
  });

  document.getElementById('SendSelectionToLLM').addEventListener('click', function () {
    let params = globals.llmParamsUI.getLLMParams();
    params.code_snippet = globals.editor.getSelectedCode();
    if (!params.code_snippet || params.code_snippet.length == 0) {
      UIUtils.showAlert("erroralert", "Nothing to send, no Code Selected in the Editor");
      return;
    }

    document.getElementById('ModelOutput').value = "";
    UIUtils.addSpinnerToIconButton('SendSelectionToLLM');
    new LLMService().callLLM(params)
    .then( resp => {
      UIUtils.rmSpinnerFromIconButton('SendSelectionToLLM');
      document.getElementById('ModelOutput').value = resp;
    }).catch( err => {
      UIUtils.rmSpinnerFromIconButton('SendSelectionToLLM');
      document.getElementById('ModelOutput').value = err;
    });
  });

  window.addEventListener("load", (event) => {
    //console.log("page is fully loaded");
    globals.setEditor("editor2");
    globals.setReadOnlyEditor("editor1");
    globals.setLLModels("ModelSelector");

    // Populate the input directory tree in the read only editor
    try {
      new FilesService().getFiles().then(fileList => VanillaEditor.initialize("editor1", fileList));
    } catch (err) {
      console.log(err);
    }
  });

  //document.getElementById("evalinput").addEventListener("click", function(event) { UIUtils.addSpinnerToIconButton("SendFileToLLM");  });
}
)()