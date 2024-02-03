
import { LLMParams, LLMParamsSnap, CodeFile, ChatMessage, ChatExchange } from "../js/models.js";
import { ModelService, FilesService, LLMService, LLMParamsService, ChatService } from "../js/services.js";
import { AceEditor, AceEditorWithMenu, AceEditorWithTree } from "../js/editors.js";
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

  show() {
    let isVisible = false;
    if (this.dualParent) {
      isVisible = !this.elem.parentElement.parentElement.classList.contains('visually-hidden');
    } else {
      isVisible = !this.elem.parentElement.classList.contains('visually-hidden');
    }
    if (!isVisible) {
      this.btn.dispatchEvent(new Event('click'));
    }
  }

  hide() {
    let isVisible = false;
    if (this.dualParent) {
      isVisible = !this.elem.parentElement.parentElement.classList.contains('visually-hidden');
    } else {
      isVisible = !this.elem.parentElement.classList.contains('visually-hidden');
    }
    if (isVisible) {
      this.btn.dispatchEvent(new Event('click'));
    }
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
    this.elem.dispatchEvent(new InputEvent("input"));
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

  readonly(on=true) {
    if (on) {
      this.elem.setAttribute("readonly", true);
      this.elem.setAttribute("disabled", true);
    } else {
      this.elem.removeAttribute("readonly");
      this.elem.removeAttribute("disabled");
    }
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

    this.locked = false;
  }

  isLocked() {
    return this.locked;
  }

  lockParams(locked=true) {
    this.locked = locked;
    this.sysPromParam.readonly(this.locked);
    this.usrPromParam.readonly(this.locked);
    this.tempLLMParam.readonly(this.locked);
    this.toppLLMParam.readonly(this.locked);
    this.maxTokenParam.readonly(this.locked);
    this.reppenLLMParam.readonly(this.locked);
    this.prspenLLMParam.readonly(this.locked);
    this.topkLLMParam.readonly(this.locked);
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
    if (this.isLocked()) {
      throw new Error("Params are Locked");
    }

    let modelCode = this.modelLLMParam.getValue();
    console.log("From params [" + params.llmID + "] From selctor [" + modelCode + "]");
    if (modelCode == "" || modelCode == "None" || modelCode == null) {
      const model = globals.models.findByID(params.llmID);
      this.modelLLMParam.setValue(model.code);
    }

    this.updateKWArgs(params.model_kwargs);
    if (params.user_prompt == null) {
      this.usrPromParam.disable();
    } else {
      this.usrPromParam.enable();
      this.usrPromParam.setValue(params.user_prompt);
    }
  }

  updateKWArgs(kwargs) {
    if (this.isLocked()) {
      throw new Error("Params are Locked");
    }

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
    this.showingEditableTree = false;
    this.editor = null;
    this.outputEditor = null;
    this.llmSelector = null;
    this.models = null;
    this.llmParamsUI = new LLMParamsUI();
    this.chatMode = false;
    this.chatHistory = null;
    this.resetChatHistory();
  }

  destroy() {
    $('#scrollable-dropdown-menu .typeahead').typeahead('destroy');
    if (this.readOnlyEditor) {
      this.readOnlyEditor.destroy();
      this.readOnlyEditor = null;
    }
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
    if (this.outputEditor) {
      this.outputEditor.destroy();
      this.outputEditor = null;
    }

    this.llmSelector = null;
    this.models = null;
    this.llmParamsUI = null;
  }

  setEditor(editorID) {
    this.editor = new AceEditor(editorID);
  }

  async setReadOnlyEditor(treeID, editorID) {
    this.readOnlyEditor = new AceEditorWithTree(treeID, editorID, false);  // Non-editable File / Read Only
    await this.loadReadOnlyEditor();

    this.readOnlyEditor.setupSelectListener((name, type) => {
      if (type == AceEditorWithTree.FILE) {
        this.editor.editFile(name).catch(err => {  // Load an editable version in the editable editor
          UIUtils.showAlert("erroralert", err);
        });
      }
      console.log(`Clicked on [${name}] of type [${type}]`);
    });

    this.setupFileSearch();
  }

  setupFileSearch() {
    // Setup the File Search
    $('#scrollable-dropdown-menu .typeahead').typeahead({
      hint: true,
      highlight: true,
      minLength: 1
    }, {
      name: 'File-Paths',
      limit: 10,
      source: substringMatcher(this.readOnlyEditor.tree.getPathList())
    });
  }

  setModelOutputEditor(editorID) {
    this.outputEditor = new AceEditorWithMenu(editorID, null, {
      text: 'LLM Output comes here, when you use the "Send **" buttons!!',
      buttons: {
        UndoFile: true,
        RedoFile: true,
        Beautify: true,
        WordWrap: true,
        ToggleFolding: true,
        ShowHidden: true
      }
    });
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
    // Populate the input directory tree in the editor
    try {
        await new FilesService().getFiles().then(
            fileList => {
                  this.readOnlyEditor.initialize(fileList);
            }
        );
      } catch (err) {
        console.log(err);
      }
  }

  async toggleReadOnlyEditorTree() {
    try {
      await new FilesService().getFiles(null, !this.showingEditableTree).then(
        fileList => {
              this.readOnlyEditor.reloadTree(fileList);
              this.showingEditableTree = !this.showingEditableTree;

              // Reinitialize typeahead, File Search
              $('#scrollable-dropdown-menu .typeahead').typeahead('destroy');

              this.setupFileSearch();
        }
      );
    } catch (err) {
      UIUtils.showAlert("Unable to toggle the tree");
      console.log(err);
    }
  }

  loadDataOnMain() {
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

      $("#ParamsHistoryModal .modal-body").append('<table id="ParamsHistoryTable" class="table table-sm table-bordered table-hover" style="width:100%"></table>');
      
      const histModal = new bootstrap.Modal("#ParamsHistoryModal");
      histModal.show();

      const dataTable = $("#ParamsHistoryTable").DataTable({
        //dom: 'Bfrtip',
        dom: 'B' + "<'row'<'col-md-6'i><'col-md-6'f>>" + 'tr' + "<'row'<'col-md-5'l><'col-md-7'p>>",
        destroy: true,
        data: history.records,   // Array of JSON flat objects, not LLMParams Model objects
        scrollX: true,
        scrollY: 450,
        scrollCollapse: true,
        paging: false,
        //fixedHeader: {          // Fixed Header won't work in Bootstrap Modal
        //  header: true,         // https://datatables.net/forums/discussion/41126/how-can-fixedheader-work-for-bootstrap-modal
        //  headerOffset: 200 
        //},
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
          },
          { targets: 4, render: function (data, type, row, meta) { 
              //console.log(data + " " + type + " " + row.params.llmID);
              if (type === 'display') {
                return '<p style="white-space: pre-line;">' + data + '</p>';
              }
              return data;
            }
          },
          { targets: 5, render: function (data, type, row, meta) { 
              //console.log(data + " " + type + " " + row.params.llmID);
              if (type === 'display') {
                return '<p style="white-space: pre-line;">' + data + '</p>';
              }
              return data;
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

                if (confirm('Delete ' + data.user + "'s params for [" + data.params.llmID + "]") == true) {
                  console.log(`Deleting Record [${data.hash}]!!`);
                  let resp = await new LLMParamsService().deleteParam(data);
                  UIUtils.showAlert('erroralert', `Deleted [${resp.deleted}] records from the DB`);
                  let updatedHist = await new LLMParamsService().getAllParamsHistory();
                  dt.clear();
                  dt.rows.add(updatedHist.records); // Add new data
                  dt.columns.adjust().draw(); // Redraw the DataTable
                }
              } catch (err) {
                console.log(err);
                UIUtils.showAlert('erroralert', "Unable to delete the prompt record [" + err + "]");
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
                    UIUtils.showAlert('erroralert', "Loaded " + data.user + "'s Params");
                //}
              } catch(err) {
                console.log(err);
                UIUtils.showAlert('erroralert', "Unable to load the prompt record [" + err + "]");
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
      if (params) {
        this.llmParamsUI.updateLLMParams(params);
      } else {
        this.llmParamsUI.updateKWArgs(model.model_kwargs);
      }
    } catch (err) {
      UIUtils.showAlert("erroralert", err);
      console.log(err);
    }
  }

  resetChatHistory() {
    this.chatHistory = {
      chatMsg: new ChatMessage()
    }
  }

  updateChatHistory(user, ai) {
    this.chatHistory.chatMsg.append(user, ai);
  }
}

let globals = null;

//setLayout();

function resdestroy() {
  //console.log("Destroying Workspace");
  if (globals) globals.destroy();
  globals = null;
}

var substringMatcher= function(strs) {
  return function findMatches(q, cb) {
    var matches, substrRegex;

    // an array that will be populated with substring matches
    matches = [];

    // regex used to determine if a string contains the substring `q`
    substrRegex = new RegExp(q, 'i');

    // iterate through the pool of strings and for any string that
    // contains the substring `q`, add it to the `matches` array
    $.each(strs, function(i, str) {
      if (substrRegex.test(str)) {
        matches.push(str);
      }
    });

    cb(matches);
  };
};


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

    document.getElementById('ContextInputClear').addEventListener('click', function (e) {
      e.preventDefault();
      document.getElementById('ContextInput').value = '';
    });

    document.getElementById('SaveParams').addEventListener('click', function (e) {
      const purpModal = new bootstrap.Modal("#ParamsPurposeModal");
      purpModal.show();
    });

    document.getElementById('LockParams').addEventListener('click', function(e) {
      if (globals.llmParamsUI.isLocked()) {
        globals.llmParamsUI.lockParams(false);
      } else {
        globals.llmParamsUI.lockParams(true);
      }
    });

    $("#ParamsPurposeModal .modal-footer .btn").on('click', function() {
      globals.saveLLMParams();
    });

    document.getElementById('ToggleTreeReadOnly').addEventListener('click', function () {
      let dirTree = document.getElementById('editor1Tree');
      if (dirTree.classList.contains('treeCollapsed')) {
        dirTree.classList.remove('treeCollapsed');
      } else {
        dirTree.classList.add('treeCollapsed');
      }
    });

    document.getElementById('WordWrapReadOnly').addEventListener('click', function () {
      globals.readOnlyEditor.toggleWordWrap();
    });

    document.getElementById('SwitchReadOnlyTree').addEventListener('click', function () {
      globals.toggleReadOnlyEditorTree();
    });

    $('#scrollable-dropdown-menu .typeahead').bind('typeahead:select', function(ev, suggestion) {
      console.log('Selection: ' + suggestion);
      globals.readOnlyEditor.showFile(suggestion);
      window.setTimeout(() => {$('#scrollable-dropdown-menu .typeahead').typeahead('val','');}, 2000);
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

    document.getElementById('ToggleFolding').addEventListener('click', function () {
      globals.editor.toggleCodeFolding();
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

    document.getElementById('NewFile').addEventListener('click', function (e) {
      const filenameModal = new bootstrap.Modal("#NewFilenameModal");
      filenameModal.show();
    });

    $("#NewFilenameModal .modal-footer .btn").on('click', function() {
      const filename = $("#NewFilenameModalText").val();
      try {
        globals.editor.setNewFile(new CodeFile(filename, 0, ""));  // Set new CodeFile in the Editor, don't save yet
      } catch (err) {
        UIUtils.showAlert("erroralert", err);
      }

      UIUtils.showAlert("erroralert", `Update the contents of [${filename}] and then save to create the first version.`);
    });

    document.getElementById('SaveFile').addEventListener('click', function () {
        try {
            UIUtils.addSpinnerToIconButton('SaveFile');
            new FilesService().saveFile(globals.editor.getCurFile())
              .then((codeFile) => {
                UIUtils.rmSpinnerFromIconButton('SaveFile');
                codeFile.content = globals.editor.getCode();
                globals.editor.curFileSavedSuccessfully(codeFile);
                UIUtils.showAlert('erroralert', `File [${codeFile.name}] saved with version [${codeFile.version}] and commit [${codeFile.commit}]`);
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

    document.getElementById('ParseFile').addEventListener('click', function () {
      const funcs = globals.editor.getTopLevelFunctionsFromCode(true);
      UIUtils.showAlert("erroralert", `Found [${funcs.length}] functions in [${globals.editor.getFilename()}] file`);
      for (const found_function of funcs) {
        //let code_snippet = globals.editor.getFunctionCode(found_function);
        console.log(found_function.name);
        //console.log(code_snippet);
      }
      //console.log(funcs);
    });

    document.getElementById('SendToLLM').addEventListener('click', function () {
        let params = globals.llmParamsUI.getLLMParams();
        if (!params || !params.llmID) {
            UIUtils.showAlert("erroralert", `Unable to send to [${params}] LLM`);
            return;
        }

        //document.getElementById('ModelOutput').value = "";
        UIUtils.addSpinnerToIconButton('SendToLLM');

        if (globals.chatMode) {
          globals.chatHistory.chatMsg.params = params;
          globals.outputEditor.appendText("\n------------- User Message -------------\n");
          globals.outputEditor.appendText(params.user_prompt);
          globals.llmParamsUI.usrPromParam.setValue("");
          new ChatService().callLLM(globals.chatHistory.chatMsg)
          .then(resp => {
            UIUtils.rmSpinnerFromIconButton('SendToLLM');
            globals.outputEditor.appendText("\n-------------- AI Message --------------\n");
            globals.outputEditor.appendText(resp);
            globals.outputEditor.appendText("\n\n");
            globals.outputEditor.hiddenContent = null;
            globals.chatHistory.chatMsg.append(params.user_prompt, resp);
            //document.getElementById('ModelOutput').value = resp;
          }).catch(err => {
            UIUtils.rmSpinnerFromIconButton('SendToLLM');
            globals.outputEditor.appendText("\n-------------- Error --------------\n");
            globals.outputEditor.appendText(JSON.stringify(err));
            globals.outputEditor.appendText("\n\n");
            globals.outputEditor.hiddenContent = null;
            //document.getElementById('ModelOutput').value = err;
          });
        } else {
          globals.outputEditor.setText("");
          new LLMService().callLLM(params)
              .then(resp => {
                UIUtils.rmSpinnerFromIconButton('SendToLLM');
                globals.outputEditor.setText(resp);
                globals.outputEditor.hiddenContent = { llmParams: params, iterations: [ {model_resp: resp} ] };
                //document.getElementById('ModelOutput').value = resp;
              }).catch(err => {
                UIUtils.rmSpinnerFromIconButton('SendToLLM');
                globals.outputEditor.setText(JSON.stringify(err));
                globals.outputEditor.hiddenContent = { llmParams: params, iterations: [ {model_resp: err} ] };
                //document.getElementById('ModelOutput').value = err;
              });
        }
        
    });

    document.getElementById('SendFileToLLM').addEventListener('click', function () {
        let params = globals.llmParamsUI.getLLMParams();
        if (!params || !params.llmID) {
            UIUtils.showAlert("erroralert", `Unable to send to [${params}] LLM`);
            return;
        }
        
        UIUtils.addSpinnerToIconButton('SendFileToLLM');

        if (globals.chatMode) {
          let prompt = globals.editor.getCode() + "\n" + params.user_prompt;
          params.code_snippet = null;
          globals.chatHistory.chatMsg.params = params;
          globals.outputEditor.appendText("\n------------ Sent Code File -------------\n");
          globals.outputEditor.appendText("\n------------- User Message --------------\n");
          globals.outputEditor.appendText(params.user_prompt);
          params.user_prompt = prompt;
          globals.llmParamsUI.usrPromParam.setValue("");
          new ChatService().callLLM(globals.chatHistory.chatMsg)
          .then(resp => {
            UIUtils.rmSpinnerFromIconButton('SendFileToLLM');
            globals.outputEditor.appendText("\n--------------- AI Message ---------------\n");
            globals.outputEditor.appendText(resp);
            globals.outputEditor.appendText("\n\n");
            globals.outputEditor.hiddenContent = null;
            globals.chatHistory.chatMsg.append(params.user_prompt, resp);
            //document.getElementById('ModelOutput').value = resp;
          }).catch(err => {
            UIUtils.rmSpinnerFromIconButton('SendFileToLLM');
            globals.outputEditor.appendText("\n--------------- Error ---------------\n");
            globals.outputEditor.appendText(JSON.stringify(err));
            globals.outputEditor.appendText("\n\n");
            globals.outputEditor.hiddenContent = null;
            //document.getElementById('ModelOutput').value = err;
          });
        } else {
          params.code_snippet = globals.editor.getCode();
          globals.outputEditor.setText("");
          //document.getElementById('ModelOutput').value = "";
          
          new LLMService().callLLM(params)
              .then(resp => {
                  UIUtils.rmSpinnerFromIconButton('SendFileToLLM');
                  globals.outputEditor.setText(resp);
                  globals.outputEditor.hiddenContent = { llmParams: params, filename: globals.editor.getFilename(), iterations: [ {model_resp: resp} ] };
                  //document.getElementById('ModelOutput').value = resp;
              }).catch(err => {
                  UIUtils.rmSpinnerFromIconButton('SendFileToLLM');
                  globals.outputEditor.setText(JSON.stringify(err));
                  globals.outputEditor.hiddenContent = { llmParams: params, filename: globals.editor.getFilename(), iterations: [ {model_err: err} ] };
                  //document.getElementById('ModelOutput').value = err;
              });
        }
    });

    document.getElementById('SendFuncsToLLM').addEventListener('click', async function () {
      let params = globals.llmParamsUI.getLLMParams();
      if (!params || !params.llmID) {
          UIUtils.showAlert("erroralert", `Unable to send to [${params}] LLM`);
          return;
      }

      globals.outputEditor.setText("");

      const funcs = globals.editor.getTopLevelFunctionsFromCode(true);
      if (funcs.length === 0) {
        UIUtils.showAlert("erroralert", "No functions found in the code");
      } else {
        UIUtils.addSpinnerToIconButton('SendFuncsToLLM');
        let all_resps = [];
        globals.outputEditor.hiddenContent = { llmParams: params, filename: globals.editor.getFilename(), iterations: [] };
        // iterations - [{funcname: .., code: .., model_resp: ..}]
        // this_resp = { funcname: .., model_resp: .. }
        for (const found_function of funcs) {
          let this_resp = { funcname: found_function.name };
          all_resps.push(this_resp);
          globals.outputEditor.appendText(`===== ${globals.editor.getFilename()} / ${found_function.name} =====`);

          params.code_snippet = globals.editor.getFunctionCode(found_function);
          //console.log(params.code_snippet);
          if (!params.code_snippet || params.code_snippet.length == 0) {
              UIUtils.showAlert("erroralert", "Nothing to send from [" + found_function.name + "()] function");
              this_resp.model_resp = "";
              console.log(found_function);
              globals.outputEditor.appendText("No code available for this function");
              globals.outputEditor.appendText(`===== Processing Complete for [${found_function.name}] =====\n`);
              globals.outputEditor.hiddenContent.iterations.push({ funcname: found_function.name, code: "", model_resp: "" });
              continue;
          }
          
          try {
            let resp = await new LLMService().callLLM(params);
            this_resp.model_resp = resp;
            globals.outputEditor.appendText(resp);
            globals.outputEditor.hiddenContent.iterations.push({ funcname: found_function.name, code: params.code_snippet, model_resp: resp });
            //document.getElementById('ModelOutput').value = resp;
          } catch (err) {
            this_resp.model_err = err;
            globals.outputEditor.appendText(JSON.stringify(err));
            globals.outputEditor.hiddenContent.iterations.push({ funcname: found_function.name, code: params.code_snippet, model_err: err });
            //document.getElementById('ModelOutput').value = err;
          }

          globals.outputEditor.appendText(`===== Processing Complete for [${found_function.name}] =====\n`);
        }

        globals.outputEditor.appendText(JSON.stringify(all_resps));
        globals.outputEditor.hiddenContent.llmParams.code_snippet = "";  // To nullify the code that is lingering in the params object
        UIUtils.rmSpinnerFromIconButton('SendFuncsToLLM');
      }
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

        UIUtils.addSpinnerToIconButton('SendSelectionToLLM');

        if (globals.chatMode) {
          let prompt = params.code_snippet + "\n" + params.user_prompt;
          params.code_snippet = null;
          globals.chatHistory.chatMsg.params = params;
          globals.outputEditor.appendText("\n------------- Sent Selected Code -------------\n");
          globals.outputEditor.appendText("\n---------------- User Message ----------------\n");
          globals.outputEditor.appendText(params.user_prompt);
          params.user_prompt = prompt;
          globals.llmParamsUI.usrPromParam.setValue("");
          new ChatService().callLLM(globals.chatHistory.chatMsg)
          .then(resp => {
            UIUtils.rmSpinnerFromIconButton('SendSelectionToLLM');
            globals.outputEditor.appendText("\n--------------- AI Message ---------------\n");
            globals.outputEditor.appendText(resp);
            globals.outputEditor.appendText("\n\n");
            globals.outputEditor.hiddenContent = null;
            globals.chatHistory.chatMsg.append(params.user_prompt, resp);
            //document.getElementById('ModelOutput').value = resp;
          }).catch(err => {
            UIUtils.rmSpinnerFromIconButton('SendSelectionToLLM');
            globals.outputEditor.appendText("\n--------------- Error ---------------\n");
            globals.outputEditor.appendText(JSON.stringify(err));
            globals.outputEditor.appendText("\n\n");
            globals.outputEditor.hiddenContent = null;
            //document.getElementById('ModelOutput').value = err;
          });
        } else {
          globals.outputEditor.setText("");
          //document.getElementById('ModelOutput').value = "";
          
          new LLMService().callLLM(params)
              .then(resp => {
                  UIUtils.rmSpinnerFromIconButton('SendSelectionToLLM');
                  globals.outputEditor.setText(resp);
                  globals.outputEditor.hiddenContent = { llmParams: params, filename: globals.editor.getFilename(), iterations: [ {model_resp: resp} ] };
                  //document.getElementById('ModelOutput').value = resp;
              }).catch(err => {
                  UIUtils.rmSpinnerFromIconButton('SendSelectionToLLM');
                  globals.outputEditor.setText(JSON.stringify(err));
                  globals.outputEditor.hiddenContent = { llmParams: params, filename: globals.editor.getFilename(), iterations: [ {model_err: JSON.stringify(err)} ] };
                  //document.getElementById('ModelOutput').value = err;
              });
        }
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
                    allPrompts += `<li style="white-space: pre-line;"> ${prompt} </li>`;
                });
                allPrompts += "</ol>";
                modalBody.innerHTML = allPrompts;
            }
        } catch (err) {
            console.log(err);
            UIUtils.showAlert('erroralert', err);
        }
    });

    $("#ParamsHistoryModal").on("hidden.bs.modal", (event)=> {
      $("#ParamsHistoryTable").DataTable().destroy(true);
    });

    $("#ParamsHistoryModal").on("shown.bs.modal", (event)=> {
      const dataTable = $("#ParamsHistoryTable").DataTable();
      dataTable.columns.adjust().draw();
      // dataTable.fixedHeader.adjust();  // Fixed Header won't work in Bootstrap Modal
    });

    document.getElementById('EnableChatMode').addEventListener('click', function () {
      if (this.checked) {
        globals.chatMode = true;
        globals.resetChatHistory();
        globals.llmParamsUI.usrPromParam.show();
        document.getElementById('SendFuncsToLLM').disabled = true;
        globals.outputEditor.setText("");
      } else {
        globals.chatMode = false;
        globals.llmParamsUI.usrPromParam.hide();
        document.getElementById('SendFuncsToLLM').disabled = false;
      }
    });

    editor1setup();
    editor2setup();

    //document.getElementById("evalinput").addEventListener("click", function(event) { UIUtils.addSpinnerToIconButton("SendFileToLLM");  });
}

function editor1setup() {
  console.log("editor1 setup");
  globals.setReadOnlyEditor("editor1Tree", "editor1");
  globals.loadDataOnMain();
}

function editor2setup() {
  console.log("editor2 setup");
  globals.setEditor("editor2_editor");
  globals.setModelOutputEditor("ModelOutput");
}

export default { resdestroy, setLayout };