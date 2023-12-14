import { FilesService } from "./services.js";
import { UIUtils } from "./utils.js";
import { CodeFile, CodeFileCache } from "./models.js";
import  "https://cdn.jsdelivr.net/npm/ace-builds@1.31.2/src-min-noconflict/ace.min.js";

class VanillaEditor {
  constructor(editorID) {
    // Live Element
    this.editorHandle = document.getElementById(editorID);
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
  constructor(editorID) {
    this.editor = ace.edit(editorID);
    ace.config.set("basePath", "https://cdn.jsdelivr.net/npm/ace-builds@1.31.2/src-min-noconflict/");
    this.editor.setTheme("ace/theme/monokai");
    this.curFile = null;
    this.fileCache = new CodeFileCache();
    this.makeAceEditorResizable(this.editor);
  }

  makeAceEditorResizable(editor) {
    const id_editor = editor.container.id;
    const id_dragbar = '#' + id_editor + '_dragbar';
    const id_wrapper = '#' + id_editor + '_wrapper';
    let wpoffset = 0;
    window.draggingAceEditor[id_editor] = false;

    $(id_dragbar).mousedown(function (e) {
      e.preventDefault();

      window.draggingAceEditor[id_editor] = true;

      const _editor = $('#' + id_editor);
      const top_offset = _editor.offset().top - wpoffset;

      // Set editor opacity to 0 to make transparent so our wrapper div shows
      _editor.css('opacity', 0);

      // handle mouse movement
      $(document).mousemove(function (e) {
        const actualY = e.pageY - wpoffset;
        // editor height
        const eheight = actualY - top_offset;

        // Set wrapper height
        $(id_wrapper).css('height', eheight);

        // Set dragbar opacity while dragging (set to 0 to not show)
        $(id_dragbar).css('opacity', 0.15);
      });
    });

    $(document).mouseup(function (e) {
      if (window.draggingAceEditor[id_editor]) {
        const ctx_editor = $('#' + id_editor);

        const actualY = e.pageY - wpoffset;
        const top_offset = ctx_editor.offset().top - wpoffset;
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

  async editFile(filepath) {
    let file = null;
    if (this.curFile == null) {
      try {
        file = await new FilesService().getFileContent(filepath, true);
      } catch (err) {
        if (err.code == 404) {
          file = await new FilesService().getFileContent(filepath, false);  // Get the original file
        } else {
          throw err;
        }
      }

      UIUtils.showAlert("erroralert", `Version [${file.version}] of file [${file.name}] is in the Editor`);
      this.editor.session.setValue(file.content);
      this.setEditMode(file.name);
      this.curFile = file;
      this.fileCache.put(this.curFile);
      this.editor.session.selection.on('changeSelection', function (e) { });
    } else {
      // save session and then create new session for new file?
      console.log(`Already editing [${this.curFile.name}]`);
      // We already have code of the current file in cache. Check if there were any modifications done.
      if (this.curFile.content != this.getCode()) {
        UIUtils.showAlert("erroralert", "File in editor has been modified, please save or discard the contents first");
        return;
      } else {
        this.fileCache.put(this.curFile);
        this.curFile = null;
      }
      this.editFile(filepath);
    }
  }

  discardChanges() {
    this.editor.session.setValue(this.curFile.content);
  }

  curFileSavedSuccessfully(file) {
    this.curFile = file;
    this.fileCache.put(file);
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
    } else if (filepath.endsWith(".txt")) {
      this.editor.session.setMode("");
    } else if (filepath.endsWith(".py")) {
      this.editor.session.setMode("ace/mode/python");
    }
  }

  setText(content) {
    this.editor.session.setValue(content);
  }

  getCode() {
    return this.editor.session.getValue();
  }

  getSelectedCode() {
    return this.editor.getSelectedText();
  }

  getCurFile() {
    return new CodeFile(this.curFile.name, this.curFile.version, this.getCode());
  }
}

export { VanillaEditor, AceEditor }