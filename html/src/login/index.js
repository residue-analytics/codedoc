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

import { LoginService } from "../js/services.js";
import { UIUtils, AppGlobals } from "../js/utils.js";

//setLayout();

function resdestroy() {
  //console.log("Destroying Login");
}

function setLayout() {
    //console.log("Layout setup for login");
    AppGlobals.instance.pageDestroy = resdestroy;

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

export default { resdestroy, setLayout };