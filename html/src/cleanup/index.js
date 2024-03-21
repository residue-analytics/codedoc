/*##################################################################################################
#
# Copyright 2024, Shalin Garg
#
# This file is part of CodeDoc Gen AI Tool.
#
# CodeDoc is free software: you can redistribute it and/or modify it under the terms of the 
# GNU General Public License as published by the Free Software Foundation, either version 3 
# of the License, or (at your option) any later version.
#
# CodeDoc is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without 
# even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU 
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with CodeDoc. 
# If not, see <https://www.gnu.org/licenses/>.
#
##################################################################################################*/

import { AceEditorWithTree } from "../js/editors.js";
import { FilesService } from "../js/services.js";
import { AppGlobals, UIUtils } from "../js/utils.js";

class PageGlobals {
    constructor() {
        this.cleanupEditor = null;
    }

    destroy() {
        this.cleanupEditor.destroy();
        this.cleanupEditor = null;
    }

    async setCleanupEditor(treeID, editorID) {
      this.cleanupEditor = new AceEditorWithTree(treeID, editorID);
      await this.loadCleanupEditor();

      this.cleanupEditor.setupSelectListener((name, type) => {
        if (type == AceEditorWithTree.FILE) {
            if (confirm("Delete this File [" + name + "]")) {
                new FilesService().deleteFile(name, true)
                .then(resp => {
                    if (resp) {
                        UIUtils.showAlert('erroralert', `Deleted [${resp.name}]`); 
                        this.cleanupEditor.removeCurActive();
                    }
                })
                .catch(err => {
                   UIUtils.showAlert('erroralert', `Unable to delete file [${name}] due to [${err}]`);
                });
            }
        }
        //console.log(`Clicked on [${name}] of type [${type}]`);
      });
    }

    async loadCleanupEditor(reload=false) {
        // Populate the input directory tree in the editor
        try {
            await new FilesService().getFiles(null, true).then(
                fileList => {
                    if (reload) {
                      this.cleanupEditor.reloadTree(fileList);
                    } else {
                      this.cleanupEditor.initialize(fileList);
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

    globals.setCleanupEditor("cleanupTree", "cleanupEditor");

    //<!-- Vanilla Tree Viewer -->
    //let edtScript = document.createElement("script");
    //edtScript.src = "https://cdn.jsdelivr.net/gh/abhchand/vanilla-tree-viewer@2.1.1/dist/index.min.js";
    //edtScript.onload = editor1setup;
    //mainDiv.appendChild(edtScript);
}

    /* setCleanupEditor(editorID) {
        this.cleanupEditor = new VanillaEditor(editorID);
        this.cleanupEditor.setupListenerOnRoot((name, type) => {
            if (type == 'file') {
                if (confirm("Delete this File [" + name + "]")) {
                    new FilesService().deleteFile(name, true)
                    .then(resp => {
                        if (resp) {
                            UIUtils.showAlert('erroralert', `Deleted [${resp.name}]`); 
                            this.cleanupEditor.strikeThroughTreeNode(name, type);
                        }
                    })
                    .catch(err => {
                       UIUtils.showAlert('erroralert', `Unable to delete file [${name}] due to [${err}]`);
                    });
                }
            }
            //console.log(`Clicked on [${name}] of type [${type}]`);
        });
    } */
    
//function editor1setup() {
    //console.log("cleanup editor setup");
//    VanillaTreeViewer.renderAll();
//    globals.setCleanupEditor("cleanupEditor1");
//    globals.loadCleanupEditor();
//}

export default { resdestroy, setLayout };