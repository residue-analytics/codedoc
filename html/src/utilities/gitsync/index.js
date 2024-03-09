import { AceEditorWithMenuTree } from "../../js/editors.js";
import { AppGlobals, UIUtils } from "../../js/utils.js";
import { FetchAPI, FilesService } from "../../js/services.js";
import { CodeFile } from "../../js/models.js";

import markdownIt from 'https://cdn.jsdelivr.net/npm/markdown-it@14.0.0/+esm';

class PageGlobals {
  constructor() {
    this.gitEditor = null;
    this.outputEditor = null;
  }

  destroy() {
    this.gitEditor.destroy();
    this.gitEditor = null;

    this.outputEditor.destroy();
    this.outputEditor = null;
  }

  async setEditors(gitTreeID, gitCodeID, opTreeID, opCodeID) {
    AppGlobals.instance.startProgress();

    this.gitEditor = new AceEditorWithMenuTree(gitTreeID, gitCodeID, null, false, {  // Not editable files
      text: 'Select a file from the github dir tree on the left',
      buttons: {
        ToggleTree: true,
        Beautify: true,
        WordWrap: true,
        ToggleFolding: true,
        filename: true,
      }
    });
    AppGlobals.instance.incrProgress(10);

    this.outputEditor = new AceEditorWithMenuTree(opTreeID, opCodeID, null, true, {
      text: 'Select a file from the server dir tree on the left',
      buttons: {
        ToggleTree: true,
        NewFile: { title: "Create a new file on Server and Git", icon: 'bi bi-file-earmark-plus', handler: () => {
          const filenameModal = new bootstrap.Modal("#NewFilenameModal");
          filenameModal.show();
        } },
        UndoFile: true,
        RedoFile: true,
        Beautify: true,
        WordWrap: true,
        ToggleFolding: true,
        Discard: true,
        SaveOPFile: { title: "Save the changed file as a new Version on server and Git", icon: "bi bi-floppy", handler: () => {
          try {
            UIUtils.addSpinnerToIconButton('SaveOPFile');
            new FilesService().saveFile(this.outputEditor.getCurFile())
              .then((codeFile) => {
                UIUtils.rmSpinnerFromIconButton('SaveOPFile');
                codeFile.content = this.outputEditor.getCode();
                this.outputEditor.curFileSavedSuccessfully(codeFile);
                this.loadOutputEditor(true);
                UIUtils.showAlert('erroralert', `File [${codeFile.name}] saved with version [${codeFile.version}] and commit [${codeFile.commit}]`);
              })
              .catch((err) => {
                UIUtils.rmSpinnerFromIconButton('SaveOPFile');
                UIUtils.showAlert("erroralert", err);
              });
          } catch (err) {
              UIUtils.rmSpinnerFromIconButton('SaveOPFile');
              UIUtils.showAlert("erroralert", err);
          }
        } },
        fileLock: true,
        readOnly: true,
        empty: true,
        filename: true,
      }
    });
    AppGlobals.instance.incrProgress(10);

    await this.loadOutputEditor();
    AppGlobals.instance.setProgress(50);

    await this.loadGitEditor();
    AppGlobals.instance.setProgress(100);
    AppGlobals.instance.setProgress(0);
  }

  async loadGitEditor(reload=false) {
    // Populate the Git directory tree in the editor
    try {
      await new FilesService().getGitFiles().then(
          fileList => {
              if (reload) {
                this.gitEditor.reloadTree(fileList);
              } else {
                AppGlobals.instance.incrProgress(20);
                this.gitEditor.initialize(fileList, null, true);  // fetching files from Git!!
              }
          }
      );
    } catch (err) {
      console.log(err);
    }
  }

  async loadOutputEditor(reload=false) {
    // Populate the output directory tree in the editor
    try {
      await new FilesService().getFiles(null, true).then(
        fileList => {
            if (reload) {
              this.outputEditor.reloadTree(fileList);
            } else {
              this.outputEditor.initialize(fileList);
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

function setLayout() {
  globals = new PageGlobals();

  AppGlobals.instance.pageDestroy = resdestroy;

  try {
    globals.setEditors("gitTree", "gitEditor", "outputTree", "outputEditor");
  } catch (exp) {
    UIUtils.showAlert('erroralert', exp);
  }

  $("#NewFilenameModal .modal-footer .btn").on('click', function() {
    const filename = $("#NewFilenameModalText").val();
    try {
      globals.outputEditor.setNewFile(new CodeFile(filename, 0, ""));  // Set new CodeFile in the Editor, don't save yet
    } catch (err) {
      UIUtils.showAlert("erroralert", err);
      return;
    }

    UIUtils.showAlert("erroralert", `Update the contents of [${filename}] and then save to create the first version.`);
  });

  document.getElementById("showDiff").addEventListener("click", (e) => {
    e.preventDefault();
    try {
      const git = globals.gitEditor.getCode();
      const out = globals.outputEditor.getCode();

      let span = null;

      const diff = Diff.diffChars(git, out),
          fragment = document.createDocumentFragment();
      
      let display = document.getElementById('preContent');
      display.replaceChildren();
      display = display.appendChild(document.createElement('pre'));

      let buttonColorSet = false;
      diff.forEach((part) => {
        // green for additions, red for deletions
        // grey for common parts
        let color;
        if (part.removed) { 
          color = 'red';
        } else if (part.added) {
          color = 'blue';
        } else {
          color = 'grey';
        }

        span = document.createElement('span');
        span.style.color = color;
        if (!buttonColorSet && color == 'grey') {
          e.currentTarget.style.color = 'white';
        } else {
          buttonColorSet = true;
          e.currentTarget.style.color = color;
        }

        span.appendChild(document.createTextNode(part.value));
        fragment.appendChild(span);
      });

      display.appendChild(fragment);
    } catch (exp) {
      console.log(exp);
      UIUtils.showAlert("erroralert", exp);
    }
  });

  document.getElementById('watchMarkdown').addEventListener("click", (e) => {
    e.preventDefault();
    //if (e.currentTarget.checked) {
      const md = new markdownIt();
      const display = document.getElementById('preContent');
      display.replaceChildren();
      display.innerHTML = md.render(globals.outputEditor.getCode());
    //} else {
    //  console.log("check off");
    //}
  });
}

export default { resdestroy, setLayout };