import { Model, ModelKwargs, LLMParams, ModelList } from "./models.js";
import { WebError, ModelService, FilesService, LLMService } from "./services.js";
import { VanillaEditor, AceEditor } from "./editors.js";
import { UIUtils } from "./utils.js";

class LLMParamUIPair {
  constructor(btnID, elemID, updateBadge=true, dualParent=false) {
    this.btnID = btnID;
    this.elemID = elemID;
    this.btn  = document.getElementById(btnID);
    this.elem = document.getElementById(elemID);

    this.setShowHide(dualParent);
    if (updateBadge) {
      this.setValueUpdates();
    }
  }

  setShowHide(dualParent) {
    this.btn.addEventListener('click', () => {
      if (dualParent) {
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
}

class Globals {
  constructor() {
    this.readOnlyEditor = null;
    this.editor = null;
    this.llmSelector = null;
    this.models = null;

    this.modelLLMParam = null;
    this.sysPromParam = null;
    this.usrPromParam = null;
    this.tempLLMParam = null;
    this.toppLLMParam = null;
    this.maxTokenParam = null;
    this.reppenLLMParam = null;
    this.topkLLMParam = null;
  }

  setTempLLMParam(btnID, elemID) {
    this.tempLLMParam = new LLMParamUIPair(btnID, elemID, 'input');
  }

  setEditor(editorID) {
    this.editor = new AceEditor(editorID);
  }

  setReadOnlyEditor(editorID) {
    this.readOnlyEditor = new VanillaEditor(editorID);
    this.readOnlyEditor.setupListenerOnRoot((name, type) => {
      if (type == 'file') {
        this.editor.editFile(name).catch(err => {
          if (err.code == 404) {

            UIUtils.showAlert("erroralert", "First version of the file being created");
          } else {
            UIUtils.showAlert("erroralert", err);
          }
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
}

const globals = new Globals();

(function () {

  // Attach Event Handlers
  globals.modelLLMParam = new LLMParamUIPair('ModelSelectorBtn', 'ModelSelector');
//  document.getElementById('ModelSelectorBtn').addEventListener('click', function () {
//    document.getElementById('ModelSelector').parentElement.classList.toggle('visually-hidden');
//  });
//  document.getElementById('ModelSelector').addEventListener('input', function (event) {
//    document.getElementById('ModelSelectorBtn').querySelector(".badge").innerHTML = this.value;
//  });

  globals.sysPromParam = new LLMParamUIPair('SysPromptBtn', 'SysPromptInput', false);
//  document.getElementById('SysPromptBtn').addEventListener('click', function () {
//    document.getElementById('SysPromptInput').parentElement.classList.toggle('visually-hidden');
//  });

  globals.usrPromParam = new LLMParamUIPair('UsrPromptBtn', 'UsrPromptInput', false);
//  document.getElementById('UsrPromptBtn').addEventListener('click', function () {
//    document.getElementById('UsrPromptInput').parentElement.classList.toggle('visually-hidden');
//  });

  globals.tempLLMParam = new LLMParamUIPair('TemperatureBtn', 'TemperatureInput');
//  document.getElementById('TemperatureBtn').addEventListener('click', function () {
//    document.getElementById('TemperatureInput').parentElement.classList.toggle('visually-hidden');
//  });
//  document.getElementById('TemperatureInput').addEventListener('input', function (event) {
//    document.getElementById('TemperatureBtn').querySelector(".badge").innerHTML = this.value;
//  });

  globals.toppLLMParam = new LLMParamUIPair('ToppBtn', 'ToppInput');
//  document.getElementById('ToppBtn').addEventListener('click', function () {
//    document.getElementById('ToppInput').parentElement.classList.toggle('visually-hidden');
//  });
//  document.getElementById('ToppInput').addEventListener('input', function (event) {
//    document.getElementById('ToppBtn').querySelector(".badge").innerHTML = this.value;
//  });

  globals.maxTokenParam = new LLMParamUIPair('MaxTokensBtn', 'MaxTokensInput', false, true);
//  document.getElementById('MaxTokensBtn').addEventListener('click', function () {
//    document.getElementById('MaxTokensInput').parentElement.parentElement.classList.toggle('visually-hidden');
//  });

  globals.reppenLLMParam = new LLMParamUIPair('RepeatPenaltyBtn', 'RepeatPenaltyInput');
//  document.getElementById('RepeatPenaltyBtn').addEventListener('click', function () {
//    document.getElementById('RepeatPenaltyInput').parentElement.classList.toggle('visually-hidden');
//  });
//  document.getElementById('RepeatPenaltyInput').addEventListener('input', function (event) {
//    document.getElementById('RepeatPenaltyBtn').querySelector(".badge").innerHTML = this.value;
//  });

  globals.topkLLMParam = new LLMParamUIPair('TopkBtn', 'TopkInput', true, true);
//  document.getElementById('TopkBtn').addEventListener('click', function () {
//    document.getElementById('TopkInput').parentElement.parentElement.classList.toggle('visually-hidden');
//  });
//  document.getElementById('TopkInput').addEventListener('input', function (event) {
//    document.getElementById('TopkBtn').querySelector(".badge").innerHTML = this.value;
//  });

  document.getElementById('SendToLLM').addEventListener('click', function () {
    let params = new LLMParams(
      llmID = document.getElementById('ModelSelector').value, 
      temp = 0.0, 
      maxTokens = 0, 
      topp = 0.0, 
      topk = null,
      repeat_penalty = null, 
      sys_prompt = null, 
      context = null,
      code_snippet = null, 
      user_prompt = ''
    );
    new LLMService().callLLM(params)
    .then( resp => {
      document.getElementById('ModelOutput').value = resp;
    }).catch( err => {
      document.getElementById('ModelOutput').value = err;
    });
    
  });

  // Create the Read-only/Input Files Editor
  try {
    new FilesService().getFiles().then(fileList => VanillaEditor.initialize("editor1", fileList));
  } catch (err) {
    console.log(err);
  }

  window.addEventListener("load", (event) => {
    //console.log("page is fully loaded");
    globals.setEditor("editor2");
    globals.setReadOnlyEditor("editor1");
    globals.setLLModels("ModelSelector");
  });
}
)()

