// ==UserScript==
// @name        Asana Helpers - Markdown, Expand Comments, Theme Switch
// @description Adds 3 helper buttons, plus paste in markdown format.
// @namespace   Violentmonkey Scripts
// @match       https://app.asana.com/*
// @grant       none
// @version     1.2.3
// @author      Nick Goossens, JP Bochi
// @require     https://cdn.jsdelivr.net/npm/marked@4.3.0/lib/marked.umd.min.js
// @downloadURL https://raw.githubusercontent.com/duckduckgo/user-scripts/main/asana-helpers-markdown.js
// @updateURL   https://raw.githubusercontent.com/duckduckgo/user-scripts/main/asana-helpers-markdown.js
// ==/UserScript==

(function(){
  'use strict'

  // Setup the UI
  let buttonDiv;

  const button = (content, onClick) => {
    var btn = document.createElement('button');
    btn.innerHTML = content;
    btn.onclick = onClick;
    return btn;
  };

  const separator = () => {
    var sep = document.createElement('div');
    sep.innerHTML = '&nbsp;|&nbsp;';
    sep.style.setProperty("display", "inline-block");
    return sep;
  };

  window.addEventListener('load', () => {
    var cssObj = {
      'position': 'absolute',
      'top': '15px',
      'left': '170px',
      'padding': '3px',
      'border-radius': '3px',
      'z-index': 1,
    };
    buttonDiv = document.createElement('div');
    Object.keys(cssObj).forEach(key => { buttonDiv.style[key] = cssObj[key]; });
    updateButtonsTheme(buttonDiv);

    buttonDiv.appendChild(button('Theme', switchTheme));
    buttonDiv.appendChild(separator());
    buttonDiv.appendChild(button('Expand', showAllComments));
    buttonDiv.appendChild(separator());
    buttonDiv.appendChild(button('MD', getMDLink));

    document.body.appendChild(buttonDiv);
  })

  // Handle Markdown paste. If the content it already text/html it is pasted as it to allow
  // copy/paste from other tasks. On macOS you can paste as text using Cmd+Alt+Shift+V.
  const marked = global.marked;
  marked.setOptions({
    gfm:true,
    breaks: true
  });

  document.addEventListener("paste", (event) => {
    var editor = getEditor(event.target.parentElement);

    if (editor && !event.isMarkdownFormatEvent && !event.clipboardData.types.contains('text/html')) {
      event.stopImmediatePropagation();
      event.stopPropagation();
      event.preventDefault();

      var pastedText = event.clipboardData.getData('text/plain');

      var parsedMarkdown = marked.parse(pastedText);

      var clipboardData = new DataTransfer();
      var clipboardEvent = new ClipboardEvent('paste', {clipboardData: clipboardData});
      clipboardEvent.clipboardData.setData('text/html', parsedMarkdown);
      clipboardEvent.isMarkdownFormatEvent = true;

      editor.dispatchEvent(clipboardEvent);

      return false;
    }
  }, {capture: true});

  // Find the parent editor associated with this element
  function getEditor(element) {
    var isEditor = false;

    var iterator = element.classList.values();

    for (const cls of iterator) {
      if (cls.startsWith("ProsemirrorEditor")) {
        isEditor = true;
        break;
      }
    }

    if (isEditor) {
      var editor = element;
        while (editor && !editor.classList.contains("ProsemirrorEditor")) {
            editor = editor.parentElement;
        }

        return editor;
    }

    return null;
  }

  // Get a Markdown link for the current task formatted as [Task Title](Link)
  function getMDLink() {
    var text = document.getElementsByClassName('TaskPaneToolbarAnimation-title')[0].innerText;
    var location = window.location;

    var markdown = `[${text}](${location})`;

    navigator.clipboard.writeText(markdown);
  }

  // Switch between dark and light themes
  function switchTheme() {
    if (document.body.classList.contains("DesignTokenThemeSelectors-theme--darkMode")) {
      document.body.classList.remove("DesignTokenThemeSelectors-theme--darkMode")
    } else {
      document.body.classList.add("DesignTokenThemeSelectors-theme--darkMode")
    }
    updateButtonsTheme(buttonDiv);
  }

  function updateButtonsTheme(buttonDiv) {
    if (document.body.classList.contains("DesignTokenThemeSelectors-theme--darkMode")) {
      buttonDiv.style.setProperty('color', 'palegoldenrod', 'important');
      buttonDiv.style.setProperty('background-color', 'darkgreen', 'important');
    } else {
      buttonDiv.style.setProperty('color', 'darkgreen', 'important');
      buttonDiv.style.setProperty('background-color', 'palegoldenrod', 'important');
    }
  }

  // Expand all comments and show all their details
  function showAllComments() {
    var elements = document.getElementsByClassName('TaskStoryFeed-expandLink');

    for (var index = 0; index < elements.length; ++index) {
        const element = elements[index];
        if (element && !element.innerText.includes('Hide')) {
          element.click();
        }
    }

    // Hack to get all comments to show
    for (var i=1; i<=5; i++) {
      setTimeout(showComments, i * 100);
    }
  }

  function showComments() {
    var elements = document.getElementsByClassName('TruncatedRichText-expand');

    for (var index = 0; index < elements.length; ++index) {
      const element = elements[index];
      if (element) {
        element.click();
      }
    }
  }
}());
