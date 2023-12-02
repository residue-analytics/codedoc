import { FilesService } from "./services.js";
import { UIUtils } from "./utils.js";

class VanillaEditor {
  constructor(editorID) {
    // Live Element
    this.editorHandle = document.getElementById(editorID);
    //this.refreshHandles();
  }

  static initialize(editorID, filepathList) {
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
      li.setAttribute("data-url", "/files/" + file + "?raw=true");
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

class AceEditor {
  constructor(editorID) {
    this.editor = ace.edit(editorID);
    this.editor.setTheme("ace/theme/monokai");
    this.curFilename = null;
  }

  async editFile(filepath) {
    if (this.curFilename == null) {
      let content = null;
      try {
        content = await new FilesService().getFileContent(filepath, true);
      } catch (err) {
        if (err.code == 404) {
          UIUtils.showAlert("erroralert", "First version of the file being created");
          content = await new FilesService().getFileContent(filepath, false);  // Get the original file
        } else {
          throw err;
        }
      }

      this.editor.session.setValue(content);
      this.setEditMode(filepath);
      this.curFilename = filepath;    // We are missing the version number
      this.editor.session.selection.on('changeSelection', function (e) { console.log("Selection changed") });
    } else {
      // save session and then create new session for new file?
      console.log(`Already editing [${this.curFilename}]. Overwriting...`);
      this.curFilename = null;
      this.editFile(filepath);
    }
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

  getCode() {
    return this.editor.session.getValue();
  }

  getSelectedCode() {
    return this.editor.getSelectedText();
  }
}

export { VanillaEditor, AceEditor }