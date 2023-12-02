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
}

export { UIUtils };