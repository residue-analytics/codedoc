import { AceEditor } from "../../js/editors.js";
import { AppGlobals, UIUtils } from "../../js/utils.js";
import { FetchAPI } from "../../js/services.js";
import plantumlEncoder from 'https://cdn.jsdelivr.net/npm/plantuml-encoder@1.4.0/+esm'

class PageGlobals {
  constructor() {
    this.inputEditor = null;
    this.jsonEditor = null;
    this.pumlEditor = null;
  }

  destroy() {
    this.inputEditor.destroy();
    this.inputEditor = null;

    this.jsonEditor.destroy();
    this.jsonEditor = null;

    this.pumlEditor.destroy();
    this.pumlEditor = null;
  }

  async setEditors(inputID, jsonID, pumlID) {
    this.inputEditor = new AceEditor(inputID);
    this.inputEditor.setEditMode(".txt");
    this.jsonEditor = new AceEditor(jsonID);
    this.jsonEditor.setEditMode(".json");
    this.jsonEditor.useWordWrap();

    this.pumlEditor = new AceEditor(pumlID);
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

  globals.setEditors("inputEditor", "jsonEditor", "pumlEditor");

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

  document.getElementById("generateDiagram").addEventListener("click", async () => {
    try {
      let encoded = plantumlEncoder.encode(globals.pumlEditor.getCode());
      let image = await new FetchAPI().getImage("/plantuml/img/" + encoded);

      const imageUrl = URL.createObjectURL(image);
      const imageElement = document.createElement("img");
      imageElement.src = imageUrl;
      const container = document.getElementById("pumlImage");
      container.appendChild(imageElement);
    } catch (exp) {
      console.log(exp);
      UIUtils.showAlert("erroralert", exp)
    }
  });
}

export default { resdestroy, setLayout };