import { LoginService } from "./services.js";

class UIUtils {
  static showAlert(alertNodeID, message, durSecs = 5) {
    const parentDiv = document.getElementById(alertNodeID);
    const alert = document.createElement('div');
    alert.id = alertNodeID + "-child";
    alert.className = 'row alert alert-warning alert-dismissible fade show';
    alert.role = 'alert';

    alert.innerHTML = message.toString() +
      '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';

    parentDiv.appendChild(alert);

    if (durSecs > 0) {
      setTimeout(function () {
        try {
          const bsAlert = bootstrap.Alert.getOrCreateInstance(`#${alert.id}`);
          bsAlert && bsAlert.close();
        } catch (err) {
        }

        //let atNode = document.querySelector(`#${alertNodeID} > .alert`);
        //if (atNode) {
        //  atNode.classList.remove('show');
        //}
      }, durSecs * 1000);
    }
  }

  static updSelectDropdown(nodeID, iterOarr) {  // array of objects -> [{value:.., text:..}]
    let select = document.getElementById(nodeID);
    let valArr = iterOarr;
    if (!Array.isArray(iterOarr)) {
      valArr = Array.from(iterOarr);
    }

    select.options.length = 0;   // Remove all child option nodes
    for (let i = 0; i < valArr.length; i++) {
      let optNode = document.createElement("option");
      optNode.value = valArr[i].value;
      optNode.text = valArr[i].text;
      select.appendChild(optNode);
    }
  }

  static addSpinnerToIconButton(nodeID) {
    const btn = document.getElementById(nodeID);
    if (!btn) {
      return;
    }

    let count = 0;
    if (btn.hasAttribute("data-rescnt")) {
      count = parseInt(btn.getAttribute("data-rescnt"));
      if (count > 0) {
        btn.setAttribute("data-rescnt", ++count);  // count automatically converted to string
        // console.log(`Add Spinner Count [${nodeID}][${count}]`);
        return;
      }
    }

    btn.disabled = true;
    btn.setAttribute("data-rescnt", ++count);

    const icon = btn.querySelector("span");  // Icon span, having class name as bi-
    if (!icon) {
      const spinner = document.createElement('span');
      spinner.className = 'spinner-border spinner-border-sm';
      spinner.role = 'status';
      spinner.innerHTML = " ";
      btn.appendChild(spinner);
      return;
    }

    btn.setAttribute("data-resname", icon.className);

    icon.className = 'spinner-border spinner-border-sm';
    icon.role = 'status';
  }

  static rmSpinnerFromIconButton(nodeID) {
    const btn = document.getElementById(nodeID);
    if (!btn) {
      //console.log("Invalid Element ID for rmSpinner [%s]" % nodeID);
      return;
    }

    let count = 0;
    if (btn.hasAttribute("data-rescnt")) {
      count = parseInt(btn.getAttribute("data-rescnt"));
      if (count > 1) {
        btn.setAttribute("data-rescnt", --count);  // count automatically converted to string
        // console.log(`Add Spinner Count [${nodeID}][${count}]`);
        return;
      }
    }

    btn.setAttribute("data-rescnt", 0);
    const icon = btn.querySelector("span");
    if (!icon) {
      btn.disabled = false;
      return;
    } else {
      let iconClass = btn.getAttribute("data-resname");
      if (iconClass) {
        icon.className = iconClass;
        icon.role = null;
      } else {
        btn.removeChild(icon);
      }
    }

    btn.disabled = false;
  }
}

class UsersManager {
  static sessOwner = null;    // username of session owner
  static userMap = new Map()  // username -> User Entity

  constructor() {
  }

  static userIsPresent() {
    try {
      if (this.sessOwner) {
        return true;
      }
    } catch (ex) {
    }

    return false;
  }

  static async getLoggedInUser() {
    if (!this.sessOwner) {
      let userdata = await new LoginService().me();
      this.userMap.set(userdata.username, userdata);
      this.sessOwner = userdata.username;
      console.log("Logged in User " + this.sessOwner);
    }

    return this.userMap.get(this.sessOwner);
  }

  static async logoutUser() {
    //globals.userLogout();
    console.log("Calling logout service");
    AppGlobals.instance.clearStorage();
    UsersManager.sessOwner = null;
    UsersManager.userMap = new Map();
    return await new LoginService().logout();
  }
}

class AppGlobals {
  static instance = new this();

  constructor() {
    this.router = null;
    this._errNodeID = null;
  }

  clearStorage() {
    sessionStorage.clear();
  }

  getToken() {
    let token = sessionStorage.getItem('token');
    if (token) return JSON.parse(token);
    return null;
  }

  saveToken(tokenJSON) {
    sessionStorage.setItem('token', JSON.stringify(tokenJSON));
  }

  set alertMessage(message) {
    UIUtils.showAlert(this.errorAlertNodeID, message);
  }

  showAlertMessage(message) {
    this.alertMessage = message;
  }

  startProgress() {
    globalProgress.pctValue = 0;
  }

  incrProgress(value, max = 100) {
    let cur = globalProgress.pctValue;
    if (cur >= 100) {
      // We are already at full, we restart from 0 in place of incrementing it
      this.setProgress(value, max);
    } else {
      globalProgress.pctValue = cur + ((value / max) * 100) | 0;
    }
  }

  setProgress(value, max = 100) {
    globalProgress.pctValue = ((value / max) * 100) | 0;  // bitwise OR to truncate the float
  }

  get errorAlertNodeID() {
    return this._errNodeID;
  }
  set errorAlertNodeID(val) {
    this._errNodeID = val;
  }

  redirectToHome() {
    window.location.href = "/html";
  }
}

export { UIUtils, UsersManager, AppGlobals };