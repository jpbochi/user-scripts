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

(function () {
  'use strict';

  // Setup the UI
  let buttonDiv = null; // Setting a default state, even if its null

  const button = (content, onClick) => {
    var btn = document.createElement('button');
    btn.innerHTML = content;
    btn.onclick = onClick;
    return btn;
  };

  const separator = () => {
    var sep = document.createElement('div');
    sep.innerHTML = '&nbsp;|&nbsp;';
    sep.style.setProperty('display', 'inline-block');
    sep.style.setProperty('opacity', '0.5');
    sep.style.setProperty('margin', '0 4px');
    return sep;
  };

  window.addEventListener('load', () => {
    var cssObj = {
      position: 'absolute',
      top: '7px',
      left: '172px',
      padding: '8px 12px',
      'border-radius': '999px',
      'z-index': 50, // Setting to 50 just in case there are other elements with z-index 1
      fontSize: '14px',
    };
    buttonDiv = document.createElement('div');
    Object.keys(cssObj).forEach((key) => {
      buttonDiv.style[key] = cssObj[key];
    });
    updateButtonsTheme(buttonDiv);

    buttonDiv.appendChild(button('Theme', switchTheme));
    buttonDiv.appendChild(separator());
    buttonDiv.appendChild(button('Expand', showAllComments));
    buttonDiv.appendChild(separator());
    buttonDiv.appendChild(button('MD', getMDLink));

    document.body.appendChild(buttonDiv);
  });

  // Handle Markdown paste. If the content it already text/html it is pasted as it to allow
  // copy/paste from other tasks. On macOS you can paste as text using Cmd+Alt+Shift+V.
  const marked = global.marked;
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  document.addEventListener(
    'paste',
    (event) => {
      var editor = getEditor(event.target.parentElement);

      if (editor && !event.isMarkdownFormatEvent && !event.clipboardData.types.contains('text/html')) {
        event.stopImmediatePropagation();
        event.stopPropagation();
        event.preventDefault();

        var pastedText = event.clipboardData.getData('text/plain');

        var parsedMarkdown = marked.parse(pastedText);

        var clipboardData = new DataTransfer();
        var clipboardEvent = new ClipboardEvent('paste', { clipboardData: clipboardData });
        clipboardEvent.clipboardData.setData('text/html', parsedMarkdown);
        clipboardEvent.isMarkdownFormatEvent = true;

        editor.dispatchEvent(clipboardEvent);

        return false;
      }
    },
    { capture: true }
  );

  // Find the parent editor associated with this element
  function getEditor(element) {
    var isEditor = false;

    var iterator = element.classList.values();

    for (const cls of iterator) {
      if (cls.startsWith('ProsemirrorEditor')) {
        isEditor = true;
        break;
      }
    }

    if (isEditor) {
      var editor = element;
      while (editor && !editor.classList.contains('ProsemirrorEditor')) {
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
    const currentTheme = document.body.classList;
    updateButtonsTheme(buttonDiv);

    if (currentTheme.contains('DesignTokenThemeSelectors-theme--systemDarkMode')) {
      document.body.classList.remove('DesignTokenThemeSelectors-theme--systemDarkMode');
      document.body.classList.add('DesignTokenThemeSelectors-theme--lightMode');
    } else if (currentTheme.contains('DesignTokenThemeSelectors-theme--systemLightMode')) {
      document.body.classList.remove('DesignTokenThemeSelectors-theme--systemLightMode');
      document.body.classList.add('DesignTokenThemeSelectors-theme--darkMode');
    } else if (currentTheme.contains('DesignTokenThemeSelectors-theme--darkMode')) {
      document.body.classList.remove('DesignTokenThemeSelectors-theme--darkMode');
      document.body.classList.add('DesignTokenThemeSelectors-theme--lightMode');
    } else {
      document.body.classList.remove('DesignTokenThemeSelectors-theme--lightMode');
      document.body.classList.add('DesignTokenThemeSelectors-theme--darkMode');
    }
  }

  function updateButtonsTheme(buttonDiv) {
    const currentTheme = document.body.classList;
    if (currentTheme.contains('DesignTokenThemeSelectors-theme--darkMode' || 'DesignTokenThemeSelectors-theme--systemDarkMode')) {
      buttonDiv.style.setProperty('color', '#F5F4F3', 'important');
      buttonDiv.style.setProperty('background-color', '#2E2E30', 'important');
      buttonDiv.style.setProperty('border', '1px solid #565557', 'important');
    } else {
      buttonDiv.style.setProperty('color', '#2E2E30', 'important');
      buttonDiv.style.setProperty('background-color', '#F5F4F3', 'important');
      buttonDiv.style.setProperty('border', '1px solid #56555720', 'important');
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
    for (var i = 1; i <= 5; i++) {
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
})();
