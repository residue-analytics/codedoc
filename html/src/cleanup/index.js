import { VanillaEditor } from "../js/editors.js";
import { FilesService } from "../js/services.js";
import { AppGlobals } from "../js/utils.js";

class PageGlobals {
    constructor() {
      this.cleanupEditor = null;
    }

    destroy() {
        this.cleanupEditor = null;
    }

    setCleanupEditor(editorID) {
        this.cleanupEditor = new VanillaEditor(editorID);
        this.cleanupEditor.setupListenerOnRoot((name, type) => {
            if (type == 'file') {
                confirm("Pseudo-Delete this File [" + name + "]");
            }
            console.log(`Clicked on [${name}] of type [${type}]`);
        });
    }
    
    async loadCleanupEditor() {
        // Populate the input directory tree in the editor
        try {
            new FilesService().getFiles(null, true).then(
                fileList => VanillaEditor.initialize("cleanupEditor", fileList, true)
            );
        } catch (err) {
            console.log(err);
        }
    }
}

let globals = null;

//setLayout();

function resdestroy() {
    //console.log("Destroying cleanup");
    if (globals) globals.destroy();
    globals = null;
}

function setLayout() {
    globals = new PageGlobals();

    //console.log("Layout setup for cleanup");
    AppGlobals.instance.pageDestroy = resdestroy;

    let mainDiv = document.getElementById("MainDiv");
    
    //<!-- Vanilla Tree Viewer -->
    let edtScript = document.createElement("script");
    edtScript.src = "https://cdn.jsdelivr.net/gh/abhchand/vanilla-tree-viewer@2.1.1/dist/index.min.js";
    edtScript.onload = editor1setup;
    mainDiv.appendChild(edtScript);
}

function editor1setup() {
    //console.log("cleanup editor setup");
    VanillaTreeViewer.renderAll();
    globals.setCleanupEditor("cleanupEditor");
    globals.loadCleanupEditor();
}

export default { resdestroy, setLayout };