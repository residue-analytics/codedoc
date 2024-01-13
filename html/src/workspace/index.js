
import { LLMParams, LLMParamsSnap, FileTree } from "../js/models.js";
import { ModelService, FilesService, LLMService, LLMParamsService } from "../js/services.js";
import { VanillaEditor, AceEditor } from "../js/editors.js";
import { UIUtils, UsersManager, AppGlobals } from "../js/utils.js";

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
    //console.log(`Elem [${this.elemID}] Value[${this.elem.value}]`);
    return this.elem.value;
  }

  setValue(value) {
    this.elem.value = value;
  }

  addToValue(value) {
    this.elem.value += value;
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
    const model = globals.models.findByCode(this.modelLLMParam.getValue());
    if (!model) {
      UIUtils.showAlert('erroralert', `Model [${this.modelLLMParam.getValue()}] not found.`);
      return null;
    }

    return new LLMParams(
      model.id, 
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

  addToContextParam(text) {
    this.ctxParam.enabled() ? this.ctxParam.addToValue(text) : null;
  }
}

class PageGlobals {
  constructor() {
    this.readOnlyEditor = null;
    this.editor = null;
    this.outputEditor = null;
    this.llmSelector = null;
    this.models = null;
    this.llmParamsUI = new LLMParamsUI();
  }

  destroy() {
    this.readOnlyEditor = null;
    this.editor = null;
    this.outputEditor = null;
    this.llmSelector = null;
    this.models = null;
    this.llmParamsUI = null;
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

  setModelOutputEditor(editorID) {
    this.outputEditor = new AceEditor(editorID);
    this.outputEditor.useWordWrap(true);
  }

  setLLModels(selectorID) {
    new ModelService().getModels().then((models) => {
      this.models = models;
      let dropdownOpts = this.models.map((model) => {
        return { value: model.code, text: `${model.name} (${model.code})` }
      });

      dropdownOpts.splice(0, 0, {value:"None", text:"None"});
      UIUtils.updSelectDropdown(selectorID, dropdownOpts);
    });
  }

  setSysPromptList(nodeID) {

  }

  async loadReadOnlyEditor() {
    // Populate the input directory tree in the read only editor
    try {
      await new FilesService().getFiles().then(fileList => { 
        VanillaEditor.initialize("editor1", fileList);
        let tree = new FileTree(fileList);
        console.log(tree.getFormattedTreejs());
      });
    } catch (err) {
      console.log(err);
    }
  }

  loadDataOnMain() {
    this.loadReadOnlyEditor();
    this.setLLModels("ModelSelector");
  }

  async saveLLMParams() {
    let params = this.llmParamsUI.getLLMParams();
    if (!params) {
      UIUtils.showAlert("erroralert", `Unable to save Params for [${params}]`);
      return;
    }

    params.context = "";       // We are not going to save context
    params.code_snippet = "";  //   and code snippet
    let oldParams = sessionStorage.getItem(params.llmID);
    let newParams = JSON.stringify(params.toJSON());
    if (oldParams != newParams) {
      let purpose=$("#ParamsPurposeModalText").val();  // Get purpose from the modal textarea
      new LLMParamsService().saveParams(
        new LLMParamsSnap(Date.now(), (await UsersManager.getLoggedInUser()).fullname, purpose, "", params)
      )
      .then(resp => {
          UIUtils.showAlert("erroralert", `Saved [${resp.llmID}] with count [${resp.count}] on server`);
          sessionStorage.setItem(params.llmID, newParams);
          $("#ParamsPurposeModalText").val("");
          console.log(`Params for [${params.llmID}] saved locally`);
      })
      .catch(
        err => UIUtils.showAlert("erroralert", `Unable to save [${params.llmID}], err [${err}]`)
      );
    } else {
      UIUtils.showAlert("erroralert", `Nothing new to save for [${params.llmID}]`);
    }
  }

  showLLMParamsHistory() {
    new LLMParamsService().getAllParamsHistory()
    .then(history => {
      //console.log(history);
      UIUtils.showAlert("erroralert", `Received [${history.records.length}] reocrds from server`);

      $("#ParamsHistoryModal .modal-body").append('<table id="ParamsHistoryTable" class="table table-sm table-bordered" style="width:100%"></table>');
      
      const histModal = new bootstrap.Modal("#ParamsHistoryModal");
      histModal.show();

      const dataTable = $("#ParamsHistoryTable").DataTable({
        dom: 'Bfrtip',
        destroy: true,
        data: history.records,   // Array of JSON flat objects, not LLMParams Model objects
        scrollX: true,
        fixedHeader: true,
        select: {
          items: 'row',
          style: 'single',
          toggleable: true
        },
        columns: [
          { data: "tm", title: 'Timestamp' },
          { data: "user", title: 'User Name' },
          { data: "params.llmID", title: 'LLM ID' },
          { data: "purpose", title: 'Purpose' },
          { data: "params.system_prompt", title: 'System Prompt' },
          { data: "params.user_prompt", title: 'User Prompt' },
          { data: "params.temperature", title: 'T' },
          { data: "params.topp_nucleus_sampling", title: 'Top P' },
          { data: "params.repetition_penalty", title: 'Rep Pen' },
          { data: "params.presence_penalty", title: 'Prsnc Pen' },
          { data: "params.max_new_tokens", title: 'Max Toks' },
          //{ data: null, defaultContent: '<a href="#/" title="Copy Params" class="text-danger bi bi-box-arrow-in-left"></a> <a href="#/" title="Delete" class="text-danger bi bi-trash"></a>' },
        ],
        columnDefs: [
          { targets: 0, render: DataTable.render.datetime() },
          { targets: 2, render: function (data, type, row, meta) { 
              //console.log(data + " " + type + " " + row.params.llmID);
              return globals.models.findByID(data).name;
            }
          }
        ],
        language: {
          select: {
            rows: {
              _: "Selected %d rows",
              0: "Click a row to select it",
              1: "Selected 1 row"
            }
          }
        },
        buttons: [
          {
            extend: 'selectedSingle',
            text: 'Delete Selected Params',
            action: async function ( e, dt, node, config ) {
              e.preventDefault();
              try {
                //console.log(event.currentTarget);
                //console.log(dataTable.row(event.currentTarget));
                let user = await UsersManager.getLoggedInUser();
                let data = dt.row( { selected: true } ).data();
                //console.log(data);
                if (user.fullname != data.user) {
                  UIUtils.showAlert('erroralert', "You don't have permissions to delete this record");
                  return;
                }

                //if (confirm('Delete ' + data.user + "'s params for [" + data.params.llmID + "]") == true) {
                  console.log(`Deleting Record [${data.hash}]!!`);
                  let resp = await new LLMParamsService().deleteParam(data);
                  UIUtils.showAlert('erroralert', `Deleted [${resp.deleted}] records from the DB`);
                  let updatedHist = await new LLMParamsService().getAllParamsHistory();
                  dt.clear();
                  dt.rows.add(updatedHist.records); // Add new data
                  dt.columns.adjust().draw(); // Redraw the DataTable
                //}
              } catch (err) {
                console.log(err);
                UIUtils.showAlert('erroralert', "Unable to delete the prompt record");
              }
            }
          },
          {
            extend: 'selectedSingle',
            text: 'Load Selected Params',
            action: function ( e, dt, node, config ) {
              e.preventDefault();
              try {
                let data = dt.row({ selected: true }).data();
                
                //if (confirm('Applying ' + data.user + "'s params for [" + data.params.llmID +
                //  "] on workspace LLM [" + globals.llmParamsUI.modelLLMParam.getValue() + "]") == true) {
                    console.log("Approved application!!");
                    globals.llmParamsUI.updateLLMParams(LLMParams.fromJSON(data.params));
                //}
              } catch(err) {
                console.log(err);
                UIUtils.showAlert('erroralert', "Unable to load the prompt record");
              }
            }
          },
          //'selectNone'  // Button to deselect all selected rows
        ]
      });

      dataTable.on('init.dt', () => {
        console.log("Table inited");
      });

      /**
      dataTable.on('click', 'tbody a.bi-box-arrow-in-left', (event) => {
        event.preventDefault();
        //console.log(event.currentTarget);
        //console.log(dataTable.row(event.currentTarget));
        let data = dataTable.row(event.currentTarget.parentElement.parentElement).data();
        //console.log(data);
        if (confirm('Applying ' + data.user + "'s params for [" + data.params.llmID + 
                    "] on workspace LLM [" + globals.llmParamsUI.modelLLMParam.getValue() + "]") == true) {
          console.log("Approved application!!");
          
          globals.llmParamsUI.updateLLMParams(LLMParams.fromJSON(data.params));
        }
      });

      dataTable.on('click', 'tbody a.bi-trash', async (event) => {
        try {
          event.preventDefault();
          //console.log(event.currentTarget);
          //console.log(dataTable.row(event.currentTarget));
          let user = await UsersManager.getLoggedInUser();
          let data = dataTable.row(event.currentTarget.parentElement.parentElement).data();
          //console.log(data);
          if (user.fullname != data.user) {
            UIUtils.showAlert('erroralert', "You don't have permissions to delete this record");
            return;
          }

          if (confirm('Delete ' + data.user + "'s params for [" + data.params.llmID + "]") == true) {
            console.log(`Deleting Record [${data.hash}]!!`);
            let resp = await new LLMParamsService().deleteParam(data);
            UIUtils.showAlert('erroralert', `Deleted [${resp.deleted}] records from the DB`);
          }
        } catch (err) {
          console.log(err);
          UIUtils.showAlert('erroralert', "Unable to delete the prompt record");
        }
      });
      */
    })
    .catch(err => UIUtils.showAlert('erroralert', `Unable to get Params [${err}]`));
  }

  async getSavedLLMParams(modelID) {
    let item = sessionStorage.getItem(modelID);  // Get the latest one from session storage
    if (item) {
      return LLMParams.fromJSON(JSON.parse(item));
    } else {
      return await new LLMParamsService().getParams(modelID)
    }
  }

  async restoreLLMParamsFromSession(modelCode=null) {
    let params = null;

    if (!modelCode) {
      modelCode = this.llmParamsUI.modelLLMParam.getValue();
    }

    let model = globals.models.findByCode(modelCode);
    if (!model) {
      UIUtils.showAlert('erroralert', `Model [${modelCode}] not found.`);
      return;
    }

    try {
      params = await this.getSavedLLMParams(model.id);
    } catch (err) {
    }
    
    if (params) {
      this.llmParamsUI.updateLLMParams(params);
    } else {
      this.llmParamsUI.updateKWArgs(model.model_kwargs);
    }
  }
}

let globals = null;

//setLayout();

function resdestroy() {
  //console.log("Destroying Workspace");
  if (globals) globals.destroy();
  globals = null;
}

async function setLayout() {
  globals = new PageGlobals();

  //console.log("Layout setup for workspace");
  AppGlobals.instance.pageDestroy = resdestroy;

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

    document.getElementById('SaveParams').addEventListener('click', function () {
      const histModal = new bootstrap.Modal("#ParamsPurposeModal");
      histModal.show();
    });

    $("#ParamsPurposeModal .modal-footer .btn").on('click', function() {
      globals.saveLLMParams();
    });

    document.getElementById('ShowParamsHistory').addEventListener('click', function () {
        globals.showLLMParamsHistory();
    });

    document.getElementById('ModelSelector').addEventListener('input', function (event) {
        globals.restoreLLMParamsFromSession(event.target.value);
    });

    document.getElementById('Discard').addEventListener('click', function () {
        globals.editor.discardChanges();
    });

    document.getElementById('Beautify').addEventListener('click', function () {
      globals.editor.beautify();
    });

    document.getElementById('WordWrap').addEventListener('click', function () {
      globals.editor.toggleWordWrap();
    });

    document.getElementById('UndoFile').addEventListener('click', function () {
      globals.editor.undo();
    });

    document.getElementById('RedoFile').addEventListener('click', function () {
      globals.editor.redo();
    });
    
    document.getElementById('FileToCtx').addEventListener('click', function (event) {
      globals.llmParamsUI.addToContextParam(globals.editor.getCode());
    });

    document.getElementById('SelectionToCtx').addEventListener('click', function (event) {
      globals.llmParamsUI.addToContextParam(globals.editor.getSelectedCode());
    });

    document.getElementById('SaveFile').addEventListener('click', function () {
        try {
            UIUtils.addSpinnerToIconButton('SaveFile');
            new FilesService().saveFile(globals.editor.getCurFile())
              .then((codeFile) => {
                UIUtils.rmSpinnerFromIconButton('SaveFile');
                codeFile.content = globals.editor.getCode();
                globals.editor.curFileSavedSuccessfully(codeFile);
                UIUtils.showAlert('erroralert', `File [${codeFile.name}] saved with version [${codeFile.version}]`);
              })
              .catch((err) => {
                UIUtils.rmSpinnerFromIconButton('SaveFile');
                UIUtils.showAlert("erroralert", err);
              });
        } catch (err) {
            UIUtils.rmSpinnerFromIconButton('SaveFile');
            UIUtils.showAlert("erroralert", err);
        }
    });

    document.getElementById('SendToLLM').addEventListener('click', function () {
        let params = globals.llmParamsUI.getLLMParams();
        if (!params || !params.llmID) {
            UIUtils.showAlert("erroralert", `Unable to send to [${params}] LLM`);
            return;
        }

        globals.outputEditor.setText("");
        //document.getElementById('ModelOutput').value = "";
        UIUtils.addSpinnerToIconButton('SendToLLM');
        new LLMService().callLLM(params)
            .then(resp => {
                UIUtils.rmSpinnerFromIconButton('SendToLLM');
                globals.outputEditor.setText(resp);
                //document.getElementById('ModelOutput').value = resp;
            }).catch(err => {
                UIUtils.rmSpinnerFromIconButton('SendToLLM');
                globals.outputEditor.setText(err);
                //document.getElementById('ModelOutput').value = err;
            });
    });

    document.getElementById('SendFileToLLM').addEventListener('click', function () {
        let params = globals.llmParamsUI.getLLMParams();
        if (!params || !params.llmID) {
            UIUtils.showAlert("erroralert", `Unable to send to [${params}] LLM`);
            return;
        }

        params.code_snippet = globals.editor.getCode();

        globals.outputEditor.setText("");
        //document.getElementById('ModelOutput').value = "";
        UIUtils.addSpinnerToIconButton('SendFileToLLM');
        new LLMService().callLLM(params)
            .then(resp => {
                UIUtils.rmSpinnerFromIconButton('SendFileToLLM');
                globals.outputEditor.setText(resp);
                //document.getElementById('ModelOutput').value = resp;
            }).catch(err => {
                UIUtils.rmSpinnerFromIconButton('SendFileToLLM');
                globals.outputEditor.setText(err);
                //document.getElementById('ModelOutput').value = err;
            });
    });

    document.getElementById('SendSelectionToLLM').addEventListener('click', function () {
        let params = globals.llmParamsUI.getLLMParams();
        if (!params || !params.llmID) {
            UIUtils.showAlert("erroralert", `Unable to send to [${params}] LLM`);
            return;
        }

        params.code_snippet = globals.editor.getSelectedCode();
        if (!params.code_snippet || params.code_snippet.length == 0) {
            UIUtils.showAlert("erroralert", "Nothing to send, no Code Selected in the Editor");
            return;
        }
        globals.outputEditor.setText("");
        //document.getElementById('ModelOutput').value = "";
        UIUtils.addSpinnerToIconButton('SendSelectionToLLM');
        new LLMService().callLLM(params)
            .then(resp => {
                UIUtils.rmSpinnerFromIconButton('SendSelectionToLLM');
                globals.outputEditor.setText(resp);
                //document.getElementById('ModelOutput').value = resp;
            }).catch(err => {
                UIUtils.rmSpinnerFromIconButton('SendSelectionToLLM');
                globals.outputEditor.setText(err);
                //document.getElementById('ModelOutput').value = err;
            });
    });

    $("#PromptsListModal").on('show.bs.modal', async (event) => {
        const modal = event.target;
        const button = event.relatedTarget;
        const type = button.getAttribute("data-bs-prompt");

        modal.querySelector('.modal-title').textContent = `All saved ${type} Prompts`

        const modalBody = modal.querySelector('.modal-body');

        try {
            const prompt_set = new Set();
            (await new LLMParamsService().getAllParams()).forEach(param => {
                if (type == "System") {
                    prompt_set.add(param.model_kwargs.system_prompt);
                } else if (type == "User") {
                    prompt_set.add(param.user_prompt);
                }
            });

            if (prompt_set.size == 0) {
                modalBody.innerHTML = "<h1> No Params Saved </h1>";
            } else {
                let allPrompts = "<ol>";
                prompt_set.forEach(prompt => {
                    allPrompts += `<li> ${prompt} </li>`;
                });
                allPrompts += "</ol>";
                modalBody.innerHTML = allPrompts;
            }
        } catch (err) {
            console.log(err);
        }
    });

    $("#ParamsHistoryModal").on("hidden.bs.modal", (event)=> {
      $("#ParamsHistoryTable").DataTable().destroy(true);
    });

    $("#ParamsHistoryModal").on("shown.bs.modal", (event)=> {
      $("#ParamsHistoryTable").DataTable().columns.adjust().draw();
    });

    let mainDiv = document.getElementById("MainDiv");
    
    //<!-- Vanilla Tree Viewer -->
    let edtScript = document.createElement("script");
    edtScript.src = "https://cdn.jsdelivr.net/gh/abhchand/vanilla-tree-viewer@2.1.1/dist/index.min.js";
    edtScript.onload = editor1setup;
    mainDiv.appendChild(edtScript);

    //<!-- Ace Code Editor Script -->
    //let edtScript = document.createElement("script");
    //edtScript.src = "https://cdn.jsdelivr.net/npm/ace-builds@1.31.2/src-min-noconflict/ace.min.js";
    //edtScript.onload = editor2setup;
    //mainDiv.appendChild(edtScript);
    editor2setup();

    //document.getElementById("evalinput").addEventListener("click", function(event) { UIUtils.addSpinnerToIconButton("SendFileToLLM");  });
}

function editor1setup() {
  console.log("editor1 setup");
  VanillaTreeViewer.renderAll();
  globals.setReadOnlyEditor("editor1");
  globals.loadDataOnMain();
}

function editor2setup() {
  console.log("editor2 setup");
  globals.setEditor("editor2");
  globals.setModelOutputEditor("ModelOutput");
}

export default { resdestroy, setLayout };