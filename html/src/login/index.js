import { LoginService } from "../js/services.js";
import { UIUtils, AppGlobals } from "../js/utils.js";

setLayout();

function resdestroy() {

}

function setLayout() {
    document.getElementById("loginBtn").addEventListener("click", async (event) => {
        event.preventDefault();
        // TODO do something here to show user that form is being submitted
        let response = null;
        try {
            response = await new LoginService().login(new FormData(document.forms['loginForm']));
            AppGlobals.instance.saveToken(await response);
            AppGlobals.instance.redirectToHome();
        } catch (err) {
            document.getElementById("password").value = "";
            UIUtils.showAlert('erroralert', `HTTP error! Status: ${err}`);
        }
    });
}
