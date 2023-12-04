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

  getValue() {
    return this.elem.value;
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
      parseFloat(this.tempLLMParam.getValue()), 
      parseInt(this.maxTokenParam.getValue()), 
      parseFloat(this.toppLLMParam.getValue()), 
      parseInt(this.topkLLMParam.getValue()),
      parseFloat(this.reppenLLMParam.getValue()), 
      parseFloat(this.prspenLLMParam.getValue()), 
      this.sysPromParam.getValue(), 
      this.ctxParam.getValue(),
      null, 
      this.usrPromParam.getValue()
    );
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
}

const globals = new Globals();

(function () {

  // Attach Event Handlers
  globals.llmParamsUI.modelLLMParam = new LLMParamUIPair('ModelSelectorBtn', 'ModelSelector');
  globals.llmParamsUI.sysPromParam = new LLMParamUIPair('SysPromptBtn', 'SysPromptInput', false);
  globals.llmParamsUI.ctxParam = new LLMParamUIPair('ContextBtn', 'ContextInput', false);
  globals.llmParamsUI.usrPromParam = new LLMParamUIPair('UsrPromptBtn', 'UsrPromptInput', false);
  globals.llmParamsUI.tempLLMParam = new LLMParamUIPair('TemperatureBtn', 'TemperatureInput');
  globals.llmParamsUI.toppLLMParam = new LLMParamUIPair('ToppBtn', 'ToppInput');
  globals.llmParamsUI.maxTokenParam = new LLMParamUIPair('MaxTokensBtn', 'MaxTokensInput', false, true);
  globals.llmParamsUI.reppenLLMParam = new LLMParamUIPair('RepeatPenaltyBtn', 'RepeatPenaltyInput');
  globals.llmParamsUI.prspenLLMParam = new LLMParamUIPair('PresencePenaltyBtn', 'PresencePenaltyInput');
  globals.llmParamsUI.topkLLMParam = new LLMParamUIPair('TopkBtn', 'TopkInput', true, true);

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