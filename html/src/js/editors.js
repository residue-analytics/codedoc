import { FilesService } from "./services.js";
import { UIUtils } from "./utils.js";
import { CodeFile, CodeFileCache, FileTree } from "./models.js";
import esprima from "https://unpkg.com/esprima-next@6.0.2/dist/esprima.js";
import  "https://cdn.jsdelivr.net/npm/ace-builds@1.32.2/src-min-noconflict/ace.min.js";
import  "https://cdn.jsdelivr.net/npm/ace-builds@1.32.2/src-min-noconflict/ext-beautify.js";

class VanillaEditor {
  constructor(editorID) {
    // Live Element
    this.editorHandle = document.getElementById(editorID);
    this.treeHandle = null;
    this.codepanelHandle = null;
    this.dirHandles = null;
    this.fileHandles = null;
    //this.refreshHandles();
  }

  static initialize(editorID, filepathList, editable=false) {
    const editor = document.getElementById(editorID);
    if (editor.querySelector(".vtv")) {
      console.log(`VanillaEditor is already initialized on ${editorID}!!`);
      throw new Error(`${editorID} VanillaEditor is already initialized!!`);
    }

    const editorlist = editor.appendChild(document.createElement("ol"));

    editorlist.setAttribute("class", "vtv");
    editorlist.setAttribute("data-language", "javascript");

    filepathList.forEach(file => {
      let li = document.createElement("li");
      li.setAttribute("data-path", file);
      // raw to make server handle form post, editable is for loading from output folder
      li.setAttribute("data-url", "/files/" + file + "?raw=true&editable=" + editable);
      editorlist.appendChild(li);
    });

    let scriptAlreadyPresent = false;
    for (const scriptElem of document.getElementsByTagName("script")) {
      if (scriptElem.src.indexOf("vanilla-tree-viewer") != -1) {
        scriptAlreadyPresent = true;
        break;
      }
    }

    if (scriptAlreadyPresent) {
      VanillaTreeViewer.renderAll();
    } else {
      // Load the Vanilla Editor component and call the renderAll(). This component modifies the
      //   DOM and add various classes to it only once at onload(). renderAll() works only one
      //   time, the first time, on one node ignores all subsequent calls if it finds vtv-wrapper 
      //   class on a child element.
      let script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/gh/abhchand/vanilla-tree-viewer@2.1.1/dist/index.min.js";
      script.type = "text/javascript";
      script.onload = (event) => { VanillaTreeViewer.renderAll(); };
      document.body.appendChild(script);
    }
  }

  refreshHandles() {
    // Elements
    this.treeHandle = this.editorHandle.querySelector(".vtv__tree");
    this.codepanelHandle = this.editorHandle.querySelector(".vtv__code-panel");

    // Static NodeLists
    this.dirHandles = this.treeHandle.querySelectorAll(".vtv__tree-node.vtv__tree-node--directory");
    this.fileHandles = this.treeHandle.querySelectorAll(".vtv__tree-node.vtv__tree-node--file");
  }

  setupListenerOnRoot(callback) {
    // callback gets the file/directory name and file type ('dir'|'file')
    // callback(name, type)
    this.editorHandle.addEventListener('click', event => {
      let nodeFound = this.findTreeNode(event.target, event.currentTarget);
      if (nodeFound) {
        if (nodeFound.classList.contains('vtv__tree-node--directory')) {
          callback(nodeFound.getAttribute('data-path'), 'dir');
        } else if (nodeFound.classList.contains('vtv__tree-node--file')) {
          callback(nodeFound.getAttribute('data-path'), 'file');
        } else {
          console.log(`Unknown Node found within Vanilla Editor search [${nodeFound}]`);
        }
      }
    });
  }

  findTreeNode(clickedOnNode, rootNode) {  // event.target, event.currentTarget
    // User clicks may happen on a span or svg, we need to walk up and find the parent node
    //   having the CSS class set as vtv__tree-node, which should be a child of node with vtv__tree class
    let currentNode = clickedOnNode;

    while (currentNode !== rootNode) {
      if (currentNode.classList.contains('vtv__tree-node')) {
        //console.log('Found vtv__tree-node');
        return currentNode;
      }

      if (currentNode.classList.contains('vtv__tree') || currentNode.classList.contains('vtv-wrapper')) {
        //console.log('Reached vtv__tree or vtv-wrapper');
        return null;
      }

      currentNode = currentNode.parentNode;
    }

    return null;
  }

  strikeThroughTreeNode(dataPathValue, type) {

    if (type == "file") {
      let treeHandle = this.editorHandle.querySelector(".vtv__tree");
      let fileHandles = treeHandle.querySelectorAll(".vtv__tree-node.vtv__tree-node--file");
      fileHandles.forEach(fileHandle => {
        if (fileHandle.getAttribute('data-path') == dataPathValue) {
          fileHandle.classList.add('text-decoration-line-through');
          return;
        }
      });
    } else if (type == "dir") {
      let treeHandle = this.editorHandle.querySelector(".vtv__tree");
      let dirHandles = treeHandle.querySelectorAll(".vtv__tree-node.vtv__tree-node--directory");
      dirHandles.forEach(dirHandle => {
        if (dirHandle.getAttribute('data-path') == dataPathValue) {
          dirHandle.classList.add('text-decoration-line-through');
          return;
        }
      });
    } else {
      throw new Error("Inavlid node type");
    }
  }

  setupListenersOnTree(callback) {
    // Sets-up click event handlers on directory and file nodes in the editor directory tree.
    // The "callback" is called with the clicked directory or file names available through the "data-path"
    //   attribute of the nodes.
    this.refreshHandles();
    this.dirHandles.forEach(dirHandle => {
      dirHandle.addEventListener('click', () => {
        callback(dirHandle.getAttribute('data-path'), 'dir');
      });
    });

    this.fileHandles.forEach(fileHandle => {
      fileHandle.addEventListener('click', () => {
        callback(fileHandle.getAttribute('data-path'), 'file');
      });
    });
  }

  getFilepathInCodePanel() {
    //this.refreshHandles();
    return this.codepanelHandle.querySelector('.vtv__code-path').innerText;
  }
}

/**
 * Global variable to store the ids of the status of the current dragged ace editor.
 */
window.draggingAceEditor = {};

class AceEditor {
  // Keyboard shortcuts - https://github.com/ajaxorg/ace/wiki/Default-Keyboard-Shortcuts
  constructor(editorID) {
    this.editorID = editorID;
    this.editor = ace.edit(this.editorID);
    ace.config.set("basePath", "https://cdn.jsdelivr.net/npm/ace-builds@1.32.2/src-min-noconflict/");
    this.editor.setTheme("ace/theme/monokai");
    this.curFile = null;
    this.fileCache = new CodeFileCache();
    this.makeAceEditorResizable(this.editor);
    this.beautifier = ace.require("ace/ext/beautify");

    this.codeFolding = false;
    this.hiddenContent = null;  // Just a placeholder to cache some data, like chat completion input data
    this.fileLocked = false;
  }

  _fileLockedChk() {
    if (this.fileLocked) {
      throw new Error(`Editor is locked with [${this.curFile.name}] file changes.`)
    }
  }

  destroy() {
    this.editor.destroy();
    this.editor.container.remove();
  }

  makeAceEditorResizable(editor) {
    const id_editor = editor.container.id;
    const baseKey = id_editor.split("_")[0];
    const id_dragbar = '#' + baseKey + '_dragbar';
    const id_wrapper = '#' + baseKey + '_wrapper';
    const id_toolbar = '#' + baseKey + '_toolbar';
    
    let toolbar_height = 0;
    if ($(id_toolbar).length) {
      toolbar_height = $(id_toolbar).height();
    }

    window.draggingAceEditor[id_editor] = false;

    $(id_dragbar).mousedown(function (e) {
      e.preventDefault();

      window.draggingAceEditor[id_editor] = true;

      const _editor = $('#' + id_editor);
      const top_offset = _editor.offset().top;

      // Set editor opacity to 0 to make transparent so our wrapper div shows
      _editor.css('opacity', 0);

      // handle mouse movement
      $(document).mousemove(function (e) {
        const actualY = e.pageY;
        
        // editor height
        const eheight = actualY - top_offset;

        // Set wrapper height
        $(id_wrapper).css('height', eheight + toolbar_height);

        // Set dragbar opacity while dragging (set to 0 to not show)
        $(id_dragbar).css('opacity', 0.15);
      });
    });

    $(document).mouseup(function (e) {
      if (window.draggingAceEditor[id_editor]) {
        const ctx_editor = $('#' + id_editor);

        const actualY = e.pageY;
        const top_offset = ctx_editor.offset().top;
        const eheight = actualY - top_offset;

        $(document).unbind('mousemove');

        // Set dragbar opacity back to 1
        $(id_dragbar).css('opacity', 1);

        // Set height on actual editor element, and opacity back to 1
        ctx_editor.css('height', eheight).css('opacity', 1);

        // Trigger ace editor resize()
        editor.resize();

        window.draggingAceEditor[id_editor] = false;
      }
    });
  }

  getFilename() {
    if (this.curFile) {
      return this.curFile.name;
    }
    return "";
  }

  getNumLines() {
    return this.editor.session.getLength();
  }

  async editFile(filepath, editable=true, showVersion=true) {
    this._fileLockedChk();

    let file = null;
    if (this.curFile == null) {
      try {
        file = await new FilesService().getFileContent(filepath, editable);
      } catch (err) {
        if (err.code == 404 && editable) {
          file = await new FilesService().getFileContent(filepath, false);  // Get the original file
        } else {
          UIUtils.showAlert("erroralert", err);
          throw err;
        }
      }

      if (showVersion) {
        UIUtils.showAlert("erroralert", `Version [${file.version}] of file [${file.name}] is in the Editor`);
      }

      this.editor.session.setValue(file.content);
      this.setEditMode(file.name);
      this.curFile = file;
      this.codeFolding = false;
      this.fileCache.put(this.curFile);
      this.editor.session.selection.on('changeSelection', function (e) { });
    } else {
      // save session and then create new session for new file?
      //console.log(`Currently editing [${this.curFile.name}]`);
      // We already have code of the current file in cache. Check if there were any modifications done.
      if (this.curFile.content != this.getCode()) {
        UIUtils.showAlert("erroralert", "File in editor has been modified, please save or discard the contents first");
        return;
      } else {
        this.fileCache.put(this.curFile);
        this.curFile = null;
        this.codeFolding = false;
      }
      await this.editFile(filepath, editable, showVersion);  // We don't have any file now, call myself again
    }
  }

  discardChanges() {
    this.editor.session.setValue(this.curFile.content);
  }

  hasWordWrap() {
    return this.editor.session.getUseWrapMode();
  }

  useWordWrap(on=true) {
    this.editor.session.setUseWrapMode(on);
  }

  toggleWordWrap() {
    this.useWordWrap(!this.hasWordWrap());
  }

  undo() {
    this.editor.undo();
  }

  redo() {
    this.editor.redo();
  }

  curFileSavedSuccessfully(file) {
    this.curFile = file;
    this.fileCache.put(file);
  }

  setReadOnly(flag=true) {  // false to edit code
    this.editor.setReadOnly(flag);
  }

  toggleReadOnly() {
    this.setReadOnly(!this.editor.getReadOnly());
  }

  setEditMode(filepath) {
    if (filepath.endsWith(".html")) {
      this.editor.session.setMode("ace/mode/html");
    } else if (filepath.endsWith(".js")) {
      this.editor.session.setMode("ace/mode/javascript");
    } else if (filepath.endsWith(".css")) {
      this.editor.session.setMode("ace/mode/css");
    } else if (filepath.endsWith(".json")) {
      this.editor.session.setMode("ace/mode/json");
    } else if (filepath.endsWith(".ejs")) {
      this.editor.session.setMode("ace/mode/html");
    } else if (filepath.endsWith(".py")) {
      this.editor.session.setMode("ace/mode/python");
    } else if (filepath.endsWith(".md")) {
      this.editor.session.setMode("ace/mode/yaml");
    } else {
      this.editor.session.setMode("");
    }
  }

  setText(content) {
    this._fileLockedChk();
    this.editor.session.setValue(content);
  }

  appendText(content) {  // content can be an String[] or String
    // Add content at the end of the Document
    const curDoc = this.editor.session.doc;
    if (Array.isArray(content)) {
      curDoc.insertFullLines(curDoc.getLength(), content);
    } else {
      curDoc.insertFullLines(curDoc.getLength(), content.split("\n"));
    }
  }

  beautify() {
    this.beautifier.beautify(this.editor.session);
  }

  getCode() {
    return this.editor.session.getValue();
  }

  getSelectedCode() {
    return this.editor.getSelectedText();
  }

  getCodeRange(firstRow, lastRow) {
    // returns Array of lines, inclusive of both the rows. First row is 1, not 0 (array index)
    if (firstRow == lastRow) {
      return [this.editor.session.getLine(firstRow-1)];
    }
    return this.editor.session.getLines(firstRow-1, lastRow);
  }

  getFunctionCode(parsedFunc) {  // parsedFunc object returned from getTopLevelFunctionsFromCode()
    return this.getCodeRange(parsedFunc.loc.start.line + parsedFunc.lineOffset, parsedFunc.loc.end.line + parsedFunc.lineOffset).join("\n");
  }

  getCurFile() {
    return new CodeFile(this.curFile.name, this.curFile.version, this.getCode());
  }

  setNewFile(codeFile) {
    this._fileLockedChk();
    if (this.curFile !== null && this.curFile.content != this.getCode()) {
      UIUtils.showAlert("erroralert", "File in editor has been modified, please save or discard the contents first");
      return;
    }
    if (codeFile.name === null || codeFile.name.length === 0 || codeFile.name.includes(" ")) {
      throw new Error("Invalid Filename, null or has spaces");
    }

    this.curFile = new CodeFile(codeFile.name, codeFile.version, codeFile.content);
    this.editor.session.setValue(this.curFile.content);
    this.setEditMode(this.curFile.name);    
    this.fileCache.put(this.curFile);
    this.codeFolding = false;
  }

  hasCodeFolded() {
    return this.codeFolding;
  }

  toggleCodeFolding() {
    if (this.hasCodeFolded()) {
      this.unfoldAll();
    } else {
      this.foldAll();
    }
  }

  foldAll() {
    console.log("folding all");
    this.editor.getSession().foldAll(0, this.getNumLines(), 0);
    this.codeFolding = true;
  }

  unfoldAll() {
    this.editor.getSession().unfold();
    this.codeFolding = false;
  }

  toggleHiddenContent() {
    let hidden = this.hiddenContent;
    this.hiddenContent = this.getCode();
    if (hidden instanceof Object) {
      this.setText(JSON.stringify(hidden));
    } else {
      this.setText(hidden);
    }
  }

  getTopLevelFunctionsFromCode(useSelectedIf=false, withComments=false) {  // Parse the whole file or just the selected part
    if (!this.curFile) {
      UIUtils.showAlert("erroralert", "No File Loaded in Editor");
      return;
    }

    if (!this.curFile.name.endsWith(".js")) {
      UIUtils.showAlert("erroralert", "Cannot parse a non-JS file [" + this.curFile.name + "]");
      return;
    }

    let funcDecls = [];
    let codeToParse = null, lineOffset = 0;
    try {
      if (useSelectedIf) {
        let selectedRange = this.editor.getSelectionRange();
        //console.log(selectedRange);
        if (selectedRange.start.row == selectedRange.end.row && selectedRange.start.column == selectedRange.end.column) {
          // Nothing is selected
          console.log("Nothing selected");
          codeToParse = this.getCode();
        } else {
          codeToParse = this.getSelectedCode();
          lineOffset = selectedRange.start.row; // starts at 0 index
        }
      } else {
        codeToParse = this.getCode();
      }
      
      //console.log(codeToParse, lineOffset);
      const parsedCode = esprima.parseModule(codeToParse, { range: false, loc: true, tolerant: true, comment: withComments });  // esprima loc starts at 1 unlike an array

      if (parsedCode.body && parsedCode.body.length > 0) {
        parsedCode.body.forEach(node => {
          if (node.type.includes("FunctionDeclaration")) {
            // function() { }
            funcDecls.push({name: node.id.name, loc: node.loc, lineOffset: lineOffset});
          } else if (node.type === "ExpressionStatement" && 
                     node.expression.type === "AssignmentExpression" &&
                     node.expression.right.type.includes("FunctionExpression")) {
            // obj.prop = function() { }
            const funcObj = { name: "", loc: node.loc, lineOffset: lineOffset };
            if (node.expression.left.object) {
              funcObj.name += node.expression.left.object.name;
            }
            if (node.expression.left.property) {
              funcObj.name += "." + node.expression.left.property.name;
            }
            funcDecls.push(funcObj);
          } else if (node.type === "VariableDeclaration") {
            // var variable = function () { }
            for (const decl of node.declarations) {
              if (decl.init && decl.init.type.includes("FunctionExpression")) {
                funcDecls.push({ name: decl.id.name, loc: node.loc, lineOffset: lineOffset });
              }
            }
          }
        });

        if (withComments) {
          funcDecls = this.mergeComments(funcDecls, parsedCode.comments);
        }
      } else {
        UIUtils.showAlert("erroralert", "No Functions found.");
        return null;
      }

      //console.log(parsedCode);
    } catch (exp) {
      console.log(exp);
      UIUtils.showAlert("erroralert", "Unable to parse the file, check console log");
    }

    return funcDecls;
  }

  mergeComments(funcDecls, comments) {
    // Realign comments using the lineOffset and then merge them into code or maybe strip code from comments
    //console.log(funcDecls);
    //console.log(comments);

    return funcDecls;
  }

  getTopLevelFunctionCode(function_name, withcomments=false) {
    const funcDecls = this.getTopLevelFunctionsFromCode(false, withcomments);
    if (funcDecls) {
      for (const found_function of funcDecls) {
        if (found_function.name == function_name || found_function.name == "exports."+function_name) {
          return this.getFunctionCode(found_function);
        }
      }
    }

    return null;
  }

  isFileLocked() {
    return this.fileLocked;
  }

  toggleFileLocked() {
    this.fileLocked = !this.fileLocked;
  }
}

class TreeView {
  // https://github.com/lunu-bounir/tree.js/
  constructor(treeID) {
    this.treeID = treeID;
    this.tree = null;
    this.jsonTree = null;
  }

  destroy() {
    if (this.tree) {
      const treeElem = document.getElementById(this.treeID);
      const new_element = treeElem.cloneNode(true);
      // Remove all event listeners set on the parent by Tree JS
      treeElem.parentNode.replaceChild(new_element, treeElem);

      $("#" + this.treeID).empty();

      this.tree = null;
      this.jsonTree = null;
    }
  }

  initialize(fileList, actionCallback) {
    this.tree = new Tree(document.getElementById(this.treeID), {
      navigate: true // allow navigate with ArrowUp and ArrowDown
    });

    this.tree.on('select', e => { 
      actionCallback(this.tree.getPath(e), e.dataset.type ? e.dataset.type : Tree.FOLDER); 
    });

    // keep track of the original node objects (need the names for browse to a specific file)
    this.tree.on('created', (e, node) => {
      e.node = node;
    });

    this.jsonTree = new FileTree(fileList);
    //console.log(this.jsonTree.getFormattedTreejs());
    this.tree.json(this.jsonTree.getFormattedTreejs());
  }

  removeCurActive() {
    this.tree.remove(this.tree.active());
  }

  setupSelectListener(callback) {
    this.tree.on('select', e => callback(this.tree.getPath(e), e.dataset.type ? e.dataset.type : Tree.FOLDER));
  }

  getPath(element) {
    return this.tree.getPath(element);
  }

  getPathList() {
    return this.jsonTree.getFilePathList();
  }

  browseToFile(filepath) {
    let elems = filepath.split('/');
    if (elems.length) {
      let cur = null;
      let curElem = null;
      while(cur = elems.shift()) {
        this.tree.browse(a => {
          if (a.textContent === cur) {
            curElem = a;
            return true;
          }
          return false;
        }, this.tree.siblings(curElem ? curElem.nextElementSibling : undefined));
      }
    }
  }

  isTreeCollapsed() {
    return document.getElementById(this.treeID).classList.contains('treeCollapsed');
  }

  toggleTreeCollapse() {
    /**  Following CSS classes are attached on the tree node for collapsing to work
     *  .dirtree { overflow: auto; transition: width 0.3s ease-in; }
        .treeCollapsed { width: 0%; overflow: hidden; }
     */
    let treeElem = document.getElementById(this.treeID);
    if (treeElem.classList.contains('treeCollapsed')) {
      treeElem.classList.remove('treeCollapsed');
    } else {
      treeElem.classList.add('treeCollapsed');
    }
  }
}

class AceEditorWithTree extends AceEditor {
  static FILE = Tree.FILE;
  static FOLDER = Tree.FOLDER;

  constructor(treeID, editorID, editableFiles=true) {
    super(editorID);

    this.treeID = treeID;
    this.editableFiles = editableFiles;

    this.tree = new TreeView(this.treeID);
    this.setReadOnly(!this.editableFiles);
    this.treeCallback = null;
    this.filelist = null;
  }

  destroy() {  // TODO: Remove the Event Listeners on the parent
    if (this.tree) {
      this.tree.destroy();
      this.tree = null;
      super.destroy();
    }
  }

  initialize(fileList, selectActionCB=null) {
    if (!selectActionCB) {
      selectActionCB = (filepath, type) => {
        if (type == AceEditorWithTree.FILE) {
          //console.log("Editable [" + this.editableFiles + "] File set from TreeEditor [" + filepath + "]");
          this.editFile(filepath, this.editableFiles, false); // Editable files with no version alert
        }
      };
    }

    this.tree.initialize(fileList, selectActionCB);
  }

  removeCurActive() {
    this.tree.removeCurActive();
  }

  reloadTree(fileList, editableFiles=false) {  // TODO: Remove the Event Listeners on the parent
    if (this.tree) {
      this.tree.destroy();
      this.tree = null;
    }
    this.tree = new TreeView(this.treeID);
    this.editableFiles = editableFiles;
    this.initialize(fileList);
    this.setupSelectListener(this.treeCallback);
  }

  setupSelectListener(callback) {
    this.treeCallback = callback;
    this.tree.setupSelectListener(callback);
  }

  showFile(filepath) {
    this.tree.browseToFile(filepath);
  }
}

class AceEditorWithMenu extends AceEditor {
  constructor(baseKey, parent=null, options={}) {
    const [toolbarElem, editorElem, dragbarElem] = 
      AceEditorWithMenu.createEditorWithDynamicIds(baseKey, parent ? parent : document.getElementById(baseKey), options);

    super(editorElem.id);

    this.baseKey = baseKey;
    this.parent = parent;
    this.options = options;

    this.toolbarElem = toolbarElem;
    this.editorElem = editorElem;
    this.dragbarElem = dragbarElem;

    this.createButtonsInToolbar(this.baseKey, this.toolbarElem, this.options);
  }

  createButtonsInToolbar(baseKey, toolbar, options) {
    // Button group
    const btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group';
    btnGroup.setAttribute('role', 'group');

    // Button definitions
    const buttonDefs = {
      ToggleTree: { title: "Show/Hide Directory Tree", icon: 'bi bi-arrow-left-right', handler: function() {console.log("TreeToggling!!")} },
      SwitchTree: { title: "Switch Read/Write Directory Trees", icon: 'bi bi-signpost-split', handler: function() {console.log("Switching Tree")} },
      UndoFile: { title: 'Undo the last change', icon: 'bi-arrow-counterclockwise', handler: () => this.undo() },
      RedoFile: { title: 'Redo the last Undo', icon: 'bi-arrow-clockwise', handler: () => this.redo() },
      Beautify: { title: 'Beautify / Format the code', icon: 'bi-text-indent-left' , handler: () => this.beautify()},
      WordWrap: { title: 'Use Word Wrap', icon: 'bi-text-wrap', toggle: true, handler: () => this.toggleWordWrap() },
      ToggleFolding: { title: 'Toggle Code Folding', icon: 'bi-arrows-collapse', toggle: true, handler: () => this.toggleCodeFolding() },
      Discard:  { title: 'Reload last version of the file discarding all the unsaved changes', icon: 'bi-file-earmark-arrow-up', handler: () => this.discardChanges() },
      NewFile: { title: 'Create a new file on the server', icon: 'bi-file-earmark-plus', handler: function() {console.log("NewFile")} },
      SaveFile: { title: 'Save the changed file as a new Version on server', icon: 'bi-floppy', handler: null },
      ParseFile: { title: 'Extract functions from the file', icon: 'bi-braces', handler: null },
      ShowHidden: { title: 'Toggle between completion JSON and Model output', icon: 'bi-filetype-json', toggle: true, handler: () => this.toggleHiddenContent() },
      fileLock: { title: 'Keep the file in this Editor', icon: 'bi-file-lock', toggle: true, handler: () => this.toggleFileLocked() },
      readOnly: { title: 'Toggle Read Only Mode', icon: 'bi-book', toggle: true, handler: () => this.toggleReadOnly() },
      empty: { title: 'Truncate Content / File', icon: 'bi-x', handler: () => this.setText("") },
      memorize: { title: 'Add the highlighted Text to Memory', icon: 'bi-cart-plus', toggle: false, handler: null }
    };
  
    // Create and append buttons to the group
    if (options.buttons) {
      Object.entries(options.buttons).forEach( ([key, value]) => {
        if (typeof(value) == 'boolean') {
          value && btnGroup.appendChild(this.createButton(baseKey, key, buttonDefs[key].title, buttonDefs[key].icon, buttonDefs[key].toggle, buttonDefs[key].handler));
        } else {
          btnGroup.appendChild(this.createButton(baseKey, key, value.title, value.icon, value.toggle, value.handler));
        }
      });
    }
  
    // Append the button group to the toolbar
    toolbar.appendChild(btnGroup);
  }

  // Helper function to create a button
  createButton(baseKey, idSuffix, title, iconClass, toggle, handler) {
    const button = document.createElement('button');
    button.id = `${baseKey}_${idSuffix}`;
    button.type = 'button';
    button.className = 'btn btn-sm text-light';
    button.title = title;
    if (toggle) {
      button.setAttribute('data-bs-toggle', 'button');
    }
    if (handler) {
      button.addEventListener('click', handler);
    }
    const icon = document.createElement('span');
    icon.className = `bi ${iconClass}`;
    button.appendChild(icon);
    return button;
  }

  static createEditorWithDynamicIds(baseKey, parent, options) {
    // Wrapper div
    const wrapper = document.createElement('div');
    wrapper.id = `${baseKey}_wrapper`;
  
    // Toolbar div
    const toolbar = document.createElement('div');
    toolbar.id = `${baseKey}_toolbar`;
    toolbar.className = 'btn-toolbar justify-content-between aceeditor_cmdbar';
    toolbar.setAttribute('role', 'toolbar');
    toolbar.setAttribute('aria-label', 'Editor toolbar with button groups');
  
    // Editor div
    const editor = document.createElement('div');
    editor.id = `${baseKey}_editor`;
    editor.className = 'app_editor';
    editor.textContent = options.text ? options.text : "";
  
    // Dragbar div
    const dragbarContainer = document.createElement('div');
    dragbarContainer.className = 'd-flex justify-content-center';
    
    const dragbar = document.createElement('div');
    dragbar.id = `${baseKey}_dragbar`;
    dragbar.className = 'app_editor_dragbar';
    dragbarContainer.appendChild(dragbar);
  
    // Append everything to the wrapper
    wrapper.appendChild(toolbar);
    wrapper.appendChild(editor);
    wrapper.appendChild(dragbarContainer);
  
    // Finally, append the wrapper to the document body or any other container element
    parent.appendChild(wrapper);

    return [toolbar, editor, dragbar];
  }
}

class AceEditorWithMenuTree extends AceEditorWithMenu {

  static FILE = Tree.FILE;
  static FOLDER = Tree.FOLDER;

  constructor(treeID, editorID, parent=null, editableFiles=true, menuOptions={}) {
    super(editorID, parent, menuOptions);

    this.treeID = treeID;
    this.editableFiles = editableFiles;

    this.tree = new TreeView(this.treeID);
    this.setReadOnly(!this.editableFiles);
    this.treeCallback = null;
    this.filelist = null;
  }

  destroy() {  // TODO: Remove the Event Listeners on the parent
    if (this.tree) {
      this.tree.destroy();
      this.tree = null;
      super.destroy();
    }
  }

  initialize(fileList, selectActionCB=null) {
    if (!selectActionCB) {
      selectActionCB = (filepath, type) => {
        if (type == AceEditorWithMenuTree.FILE) {
          //console.log("Editable [" + this.editableFiles + "] File set from TreeEditor [" + filepath + "]");
          this.editFile(filepath, this.editableFiles, false); // Editable files with no version alert
        }
      };
    }

    this.tree.initialize(fileList, selectActionCB);
  }

  removeCurActive() {
    this.tree.removeCurActive();
  }

  reloadTree(fileList) {  // TODO: Remove the Event Listeners on the parent
    if (this.tree) {
      this.tree.destroy();
      this.tree = null;
    }

    this.tree = new TreeView(this.treeID);
    this.initialize(fileList);
    this.setupSelectListener(this.treeCallback);
  }

  setupSelectListener(callback) {
    this.treeCallback = callback;
    this.tree.setupSelectListener(callback);
  }

  showFile(filepath) {
    this.tree.browseToFile(filepath);
  }
}

export { VanillaEditor, AceEditor, AceEditorWithTree, AceEditorWithMenu, AceEditorWithMenuTree }