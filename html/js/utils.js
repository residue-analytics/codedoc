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
        const bsAlert = bootstrap.Alert.getOrCreateInstance(`#${alert.id}`);
        bsAlert.close();
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

export { UIUtils };