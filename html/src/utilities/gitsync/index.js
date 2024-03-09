import { AceEditorWithMenuTree } from "../../js/editors.js";
import { AppGlobals, UIUtils } from "../../js/utils.js";
import { FetchAPI, FilesService } from "../../js/services.js";
import { CodeFile } from "../../js/models.js";

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
    
    this.loadGitEditor();
    await this.loadOutputEditor();
  }

  async loadGitEditor(reload=false) {
    // Populate the Git directory tree in the editor
    try {
      await new FilesService().getGitFiles().then(
          fileList => {
              if (reload) {
                this.gitEditor.reloadTree(fileList);
              } else {
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
}

export default { resdestroy, setLayout };