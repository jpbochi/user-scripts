// ==UserScript==
// @name         Asana: Load More Subtasks
// @namespace    http://tampermonkey.net/
// @version      0.0.1
// @description  Automatically expands the "Load more subtasks" section.
// @author       tbarri
// @match        *://app.asana.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=asana.com
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/jpbochi/user-scripts/master/asana-auto-expand-subtasks.js
// @updateURL    https://raw.githubusercontent.com/jpbochi/user-scripts/master/asana-auto-expand-subtasks.js
// ==/UserScript==

(function() {
    'use strict';

    function install() {
        const observer = new MutationObserver((_mutations) => {
            const buttons = document.getElementsByClassName('HighlightSol HighlightSol--core SubtaskGrid-loadMore PrimaryLinkButton');

            if (buttons.length == 1 && buttons[0].textContent.match(/^load more subtasks$/i)) {
                console.log("Auto expanding subtasks!")
                buttons[0].click()
            }
        });

        observer.observe(document.body, { subtree: true, childList: true });
    }

    document.addEventListener("DOMContentLoaded", install)
})();

