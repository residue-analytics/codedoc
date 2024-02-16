import { AceEditor, AceEditorWithMenuTree } from "../../js/editors.js";
import { AppGlobals, UIUtils } from "../../js/utils.js";
import { FetchAPI, FilesService } from "../../js/services.js";
import { CodeFile } from "../../js/models.js";

import plantumlEncoder from 'https://cdn.jsdelivr.net/npm/plantuml-encoder@1.4.0/+esm'
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs'

class PageGlobals {
  constructor() {
    this.inputEditor = null;
    this.jsonEditor = null;
    this.diagEditor = null;
  }

  destroy() {
    this.inputEditor.destroy();
    this.inputEditor = null;

    this.jsonEditor.destroy();
    this.jsonEditor = null;

    this.diagEditor.destroy();
    this.diagEditor = null;
  }

  async setEditors(inputID, jsonID, treeID, pumlID) {
    this.inputEditor = new AceEditor(inputID);
    this.inputEditor.setEditMode(".txt");
    this.jsonEditor = new AceEditor(jsonID);
    this.jsonEditor.setEditMode(".json");
    this.jsonEditor.useWordWrap();

    this.diagEditor = new AceEditorWithMenuTree(treeID, pumlID, null, true, {
      text: 'Write your Plant UML diagram script (@startuml) or mermaidJS markdown here and click "Generate Diagram"',
      buttons: {
        NewFile: { title: "Create a new file on the server", icon: 'bi bi-file-earmark-plus', handler: () => {
          const filenameModal = new bootstrap.Modal("#NewFilenameModal");
          filenameModal.show();
        } },
        UndoFile: true,
        RedoFile: true,
        Beautify: true,
        WordWrap: true,
        ToggleFolding: true,
        Discard: true,
        SaveFile: { title: "Save the changed file as a new Version on server", icon: "bi bi-floppy", handler: () => {
          try {
            UIUtils.addSpinnerToIconButton('SaveFile');
            new FilesService().saveFile(globals.diagEditor.getCurFile())
              .then((codeFile) => {
                UIUtils.rmSpinnerFromIconButton('SaveFile');
                codeFile.content = globals.diagEditor.getCode();
                globals.diagEditor.curFileSavedSuccessfully(codeFile);
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
        } },
        empty: true,
      }
    });
    
    await this.loadDiagramEditor();
  }

  async loadDiagramEditor(reload=false) {
    // Populate the input directory tree in the editor
    try {
      await new FilesService().getFiles(null, true).then(
          fileList => {
              if (reload) {
                this.diagEditor.reloadTree(fileList);
              } else {
                this.diagEditor.initialize(fileList);
              }
          }
      );
    } catch (err) {
      console.log(err);
    }
  }
}

let globals = null;

function resdestroy() {
  //console.log("Destroying cleanup");
  if (globals) globals.destroy();
  globals = null;
}

function csvJSON(text, quoteChar = '"', delimiter = ',') {
  var rows = text.split("\n");
  var headers = rows[0].split(",");

  const regex = new RegExp(`\\s*(${quoteChar})?(.*?)\\1\\s*(?:${delimiter}|$)`, 'gs');

  const match = line => [...line.matchAll(regex)]
    .map(m => m[2])
    .slice(0, -1);

  var lines = text.split('\n');
  const heads = headers ?? match(lines.shift());
  lines = lines.slice(1);

  return lines.map(line => {
    return match(line).reduce((acc, cur, i) => {
      // replace blank matches with `null`
      const val = cur.length <= 0 ? null : Number(cur) || cur;
      const key = heads[i] ?? `{i}`;
      return { ...acc, [key]: val };
    }, {});
  });
}

function setLayout() {
  globals = new PageGlobals();

  AppGlobals.instance.pageDestroy = resdestroy;

  globals.setEditors("inputEditor", "jsonEditor", "pumlTree", "pumlEditor");
  mermaid.initialize({ startOnLoad: false });

  document.getElementById("convertToJSON").addEventListener("click", () => {
    try {
      const json = csvJSON(globals.inputEditor.getCode(), '"', ',');
      //console.log(json);
      globals.jsonEditor.setText(JSON.stringify(json));
      globals.jsonEditor.beautify();
    } catch (exp) {
      console.log(exp);
      UIUtils.showAlert("erroralert", exp);
    }
  });

  document.getElementById("generateDiagram").addEventListener("click", async (event) => {
    event.preventDefault();
    try {
      const code = globals.diagEditor.getCode().trimStart();
      const container = document.getElementById("pumlImage");
      while (container.firstChild) {
        container.removeChild(container.lastChild);
      }

      if (code.startsWith("@start")) {
        let img = "svg";
        if (document.getElementById("pngForPUML").checked) {
          img = "png";
        }
        // Plant UML Diagram
        let image = await new FetchAPI().getImage(`/plantuml/${img}/` + plantumlEncoder.encode(code));
        const imageElement = document.createElement("img");
        imageElement.src = URL.createObjectURL(image);
        
        container.appendChild(imageElement);
      } else {
        // Mermaid JS Diagram
        if (await mermaid.parse(code)) {
          const { svg } = await mermaid.render('mermaidImage', code);
          const blob = new Blob([svg], { type: "image/svg+xml" });

          const imageElement = document.createElement("img");
          // create an URI pointing to that blob
          imageElement.src = URL.createObjectURL(blob);

          container.appendChild(imageElement);
        }
      }
    } catch (exp) {
      console.log(exp);
      UIUtils.showAlert("erroralert", exp)
    }
  });

  $("#NewFilenameModal .modal-footer .btn").on('click', function() {
    const filename = $("#NewFilenameModalText").val();
    try {
      globals.diagEditor.setNewFile(new CodeFile(filename, 0, ""));  // Set new CodeFile in the Editor, don't save yet
    } catch (err) {
      UIUtils.showAlert("erroralert", err);
    }

    UIUtils.showAlert("erroralert", `Update the contents of [${filename}] and then save to create the first version.`);
  });
}

export default { resdestroy, setLayout };