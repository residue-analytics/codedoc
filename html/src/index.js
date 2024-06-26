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

import { UIUtils, UsersManager, AppGlobals } from "./js/utils.js";

var router = null;

var routes = [
  ["/", async (match) => {
    //console.log("Nav: / home");
    renderURL('home');
  }],
  ["home", async (match) => {
    //console.log("Nav: home home");
    renderURL('home');
    activateNavLink(match.url);
  }],
  ["utils/chat", (match) => {
    renderURL("utilities/chat");
    activateNavLink(match.url);
  }],
  ["utils/playground", (match) => {
    renderURL("utilities/playground");
    activateNavLink(match.url);
  }],
  ["utils/gitsync", (match) => {
    renderURL("utilities/gitsync");
    activateNavLink(match.url);
  }],
  ["workspace", (match) => {
    renderURL("workspace");
    activateNavLink(match.url);
  }, authBeforeHook],
  ["about", (match) => {
    renderURL("about");
    activateNavLink(match.url);
  }],
  ["terms", (match) => {
    renderURL("terms");
    activateNavLink(match.url);
  }],
  ["disclaimer", (match) => {
    renderURL("disclaimer");
    activateNavLink(match.url);
  }],
  ["privacy", (match) => {
    renderURL("privacy");
    activateNavLink(match.url);
  }],
  ["diagrams/class", async (match) => {
    renderURL("diagrams/class");
    activateNavLink(match.url);
  }, authBeforeHook],
  ["diagrams/sequence", async (match) => {
    renderURL("diagrams/sequence");
    activateNavLink(match.url);
  }, authBeforeHook],
  //["diagrams/dataflow", async (match) => {
  //  renderURL("diagrams/dataflow");
  //  activateNavLink(match.url);
  //}, authBeforeHook],
  ["agent/config", async (match) => {
    renderURL("agent/config");
    activateNavLink(match.url);
  }, authBeforeHook],
  ["agent/control", async (match) => {
    renderURL("agent/control");
    activateNavLink(match.url);
  }, authBeforeHook],
  ["agent/batch", async (match) => {
    renderURL("agent/batch");
    activateNavLink(match.url);
  }, authBeforeHook],
  ["cleanup", async (match) => {
    renderURL("cleanup");
    activateNavLink(match.url);
  }, authBeforeHook],
  //removeIf(production)
  ["api", async (match) => {
    renderURL("api");
    activateNavLink(match.url);
  }],
  //endRemoveIf(production)
  ["login", (match) => {
    renderURL("login");
  }],
  ["logout", async (match) => {
    UsersManager.logoutUser();   // Clears the storage
    Login.classList.remove("visually-hidden");
    
    //menuLogout.classList.add("visually-hidden");
    renderURL("logout");
    
    setTimeout(function () { AppGlobals.instance.redirectToHome(); }, 3000);
  }]
];
var menuItems = new Map();
var menuMap = null;

$(document).ready(setupNavigation);

async function setupNavigation() {

  let menuDiv = document.getElementById("navbarSupportedContent");
  let menuLinks = [].slice.call(menuDiv.querySelectorAll("li a"));
  menuLinks.map((anchor) => {
    //console.log(anchor.hash + ":" + anchor.id);
    if (anchor.hash && anchor.hash.length > 0) {
      menuItems.set(anchor.hash, anchor.parentNode);
    } else {
      menuItems.set(anchor.id, anchor.parentNode);
    }

    anchor.parentNode.classList.add("visually-hidden");
  });

  router = new Navigo("/", {hash: true});
  AppGlobals.instance.router = router;

  await checkLogin(false);
  await updateMenuRoutes(router, routes);

  //console.log("First Navigation");
  router.navigate("home");
}

async function updateMenuRoutes(router, routeList) {
  if (!menuMap) {
    let response = await fetch("menu.json");
    menuMap = await response.json();
  }

  let allowedMenu = null;
  if (UsersManager.userIsPresent()) {
    allowedMenu = menuMap.auth;
  } else {
    allowedMenu = menuMap.unauth;
  }

  //console.log("DBUG: Allowed hash [" + allowedMenu.hash + "]");
  disableAllRoutes(router);
  router
    .on((match) => {
      console.log("Nav: Fallback");
      console.log(match);
      renderURL("home");
      activateNavLink(match.url);
    });
  
  routeList.map((route) => {
    if (allowedMenu.hash.includes(route[0])) {
      let menuitem = menuItems.get("#"+route[0]);
      if (menuitem) {
        //console.log("DBUG: Enabled menu item 1 [" + route[0] + "]");
        menuitem.classList.remove("visually-hidden");
      }

      //console.log("Route Added [" + route[0] + "]");
      (route.length == 2)
        ? router.on(route[0], route[1])
        : router.on(route[0], route[1], route[2]);
    }
  });

  if (allowedMenu.id) {
    allowedMenu.id.map((item) => { 
      let node = menuItems.get(item);
      if (node) {
        //console.log("DBUG: Enabled menu item 2 [" + item + "]");
        node.classList.remove("visually-hidden");
      }
    });
  }

  router.resolve();
  //router.routes.forEach((route) => console.log(route.name + ":" + route.path));
}

function disableAllRoutes(router) {
  router.routes.map((route) => router.off(route.path));
  menuItems.forEach(function(value, key) {
    //console.log("DBUG: Disabling menu item [" + key + "]");
    value.classList.add("visually-hidden")
  });
}

function authBeforeHook(done, match) {
  if (UsersManager.userIsPresent()) {
    done();
  } else {
    done(false);
    UIUtils.showAlert("erroralert", "Members Only Feature");
    window.history.back();
/*     let lastArr = router.lastResolved();
    if (lastArr && lastArr.length > 0) {
      router.navigate(lastArr[0].url);
    } else {
      router.navigate("home");
    } */
  }
}

function render(uri, content) {
  if (typeof resdestroy !== "undefined") {
    // destroy the previous page resources
    //console.log("Destroying from main index");
    resdestroy();
  } else if (AppGlobals.instance.pageDestroy) {
    //console.log("Destroying from main index using AppGlobals");
    AppGlobals.instance.pageDestroy();
    AppGlobals.instance.pageDestroy = null;
  }

  let element = document.querySelector("#content");
  element.innerHTML = content;
  loadModuleAndCallLayout(nodeScriptReplace(element))
    .catch((err) => console.log(err));
  //console.log("Script replace done");
}

function renderURL(uri) {
  fetch(uri + "/index.html")
    .then(response => response.text())
    .then(data => render(uri, data))
    .catch((error) => {
      console.log(error);
      UIUtils.showAlert("erroralert", "Unable to fetch page [" + error + "]");
    });
}

function activateNavLink(currentUrl) {
  console.log("activate link [" + currentUrl + "]");
  let navbarEl = document.querySelector("header .navbar-nav");
  let activeNavlink = navbarEl.getElementsByClassName("active");
  if (activeNavlink && activeNavlink.length > 0) {
    activeNavlink[0].classList.remove("active");
  }
  
  let navLinks = navbarEl.getElementsByTagName("a");
  let hashUrl = "#" + currentUrl;
  for (let i = 0; i < navLinks.length; i++) {
    if (navLinks[i].getAttribute("href") === hashUrl) {
      navLinks[i].classList.add("active");
    }
  }
}

function showLogin() {
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";

  document.getElementById("LoginDiv").classList.remove("visually-hidden");
  document.getElementById("Logout").parentElement.classList.add("visually-hidden");

  document.getElementById("MainDiv").classList.add("visually-hidden");
}

function showMainContent() {
  document.getElementById("username").value = "";
  document.getElementById("password").value = "";

  document.getElementById("LoginDiv").classList.add("visually-hidden");
  document.getElementById("Logout").parentElement.classList.remove("visually-hidden");

  document.getElementById("MainDiv").classList.remove("visually-hidden");

  globals.loadDataOnMain();
}

async function checkLogin(warn=true, user=null) {
  //console.log("Check User Session");
  try {
    if (!user) {
      user = await UsersManager.getLoggedInUser();
    }
    
    if (user) {
      login.classList.add("visually-hidden");
      UIUtils.showAlert("erroralert", "Successfully Logged In");
      //console.log(user);
	
      //menuLogout.classList.remove("visually-hidden");
    } else {
      console.log("Could not retrieve user details");
      return false;
    }
  } catch(ex) {
    if (warn) {
      UIUtils.showAlert("erroralert", "Please Log In");
    }
    return false;
  }

  return true;
}

function nodeScriptReplace(node) {
  if ( nodeScriptIs(node) === true ) {
    //console.log("Script tag created");
    node.parentNode.replaceChild( nodeScriptClone(node) , node );
  } else {
    var i = -1, children = node.childNodes;
    while ( ++i < children.length ) {
      nodeScriptReplace( children[i] );
    }
  }

  return node;
}

function nodeScriptClone(node){
  var script  = document.createElement("script");
  script.text = node.innerHTML;

  var i = -1, attrs = node.attributes, attr;
  while ( ++i < attrs.length ) {                                    
        script.setAttribute( (attr = attrs[i]).name, attr.value );
  }
  //console.log(`Replacing script tag for [${script.src}]`);
  return script;
}

function nodeScriptIs(node) {
  return node.tagName === 'SCRIPT';
}

async function loadModuleAndCallLayout(node) {
  let i = -1, children = node.childNodes;
  while (++i < children.length) {
    if (nodeScriptIs(children[i]) === true) {
      if (children[i].type == "module") {
        //console.log(children[i]);
        let moduleSrc = children[i].src;
        try {
          let mod = await import(moduleSrc);
          console.log("Loaded module [" + moduleSrc + "]");
          //console.log(mod);
          mod.default.setLayout();
        } catch (err) {
          console.log(err);
          console.log("Unable to Load module [" + moduleSrc + "]");
        }
      } else {
        //console.log("Skipping loading [" + children[i].src + "] with type [" + children[i].type + "]");
      }
    } else {
      //console.log("Found tag [" + children[i].tagName + "]");
    }
  }
}