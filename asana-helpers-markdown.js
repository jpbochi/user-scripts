// ==UserScript==
// @name         Asana Helpers - Markdown, Expand Comments, Theme Switch
// @namespace    https://github.com/jpbochi/user-scripts
// @version      1.3.2
// @description  Adds 3 helper buttons, plus paste in markdown format.
// @author       Nick Goossens, JP Bochi, Karl K
// @match        *://app.asana.com/*
// @grant        none
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/marked@4.3.0/lib/marked.umd.min.js
// @icon         https://external-content.duckduckgo.com/i/asana.com.ico
// @downloadURL  https://raw.githubusercontent.com/jpbochi/user-scripts/master/asana-helpers-markdown.js
// @updateURL    https://raw.githubusercontent.com/jpbochi/user-scripts/master/asana-helpers-markdown.js
// ==/UserScript==

(function () {
  'use strict';

  const buttonDivId = '__helpers_div__';

  const button = (content, onClick, title) => {
    var btn = document.createElement('button');
    btn.innerHTML = content;
    btn.setAttribute('title', title || '');
    btn.onclick = onClick;
    btn.onauxclick = onClick;
    return btn;
  };

  const separator = () => {
    var sep = document.createElement('div');
    sep.innerHTML = '&nbsp;&nbsp;';
    sep.style.setProperty('display', 'inline-block');
    sep.style.setProperty('opacity', '0.5');
    sep.style.setProperty('margin', '0 4px');
    return sep;
  };

  // Helper functions for https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver
  const getAddedNodes = (mutations) =>
    Array.from(mutations)
      .filter((mutation) => mutation.type === 'childList')
      .map((mutation) => mutation.addedNodes)
      .flatMap((nodes) => Array.from(nodes || []));

  const queryAll = (nodes, query) => [
    ...nodes.filter((node) => node.matches && node.matches(query)),
    ...nodes.flatMap((node) => Array.from(node.querySelectorAll ? node.querySelectorAll(query) : [])),
  ];

  const animateButton = (button) => {
    button.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 250, iterations: 1 });
  };

  window.addEventListener('load', () => {
    var cssObj = {
      position: 'absolute',
      top: '0.44rem',
      left: '12rem',
      padding: '0.52rem 0.75rem',
      'border-radius': '999px',
      'z-index': 50, // Setting to 50 just in case there are other elements with z-index 1
      fontSize: '1rem',
    };
    const buttonDiv = document.createElement('div');
    buttonDiv.id = buttonDivId;
    setButtonsTheme(buttonDiv);
    Object.keys(cssObj).forEach((key) => {
      buttonDiv.style[key] = cssObj[key];
    });

    buttonDiv.appendChild(button('\u262F', switchTheme, 'Switch dark/light themes.'));
    buttonDiv.appendChild(separator());
    buttonDiv.appendChild(button('\u2195', showAllComments, 'Expand all comments.'));
    buttonDiv.appendChild(separator());
    buttonDiv.appendChild(button('\u29C9', getMDLink, 'Copy task/message link as Markdown. With Meta/Ctrl, opens it on a new tab.'));
    buttonDiv.appendChild(separator());
    buttonDiv.appendChild(button('\u{1F4DD}', toggleReadOnly, 'Toggles task\'s contenteditable on/off.'));

    document.body.appendChild(buttonDiv);
  });

  // Handle Markdown paste. If the content it already text/html it is pasted as it to allow
  // copy/paste from other tasks. On macOS you can paste as text using Cmd+Alt+Shift+V.
  const marked = window.marked;
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

  const waitForSuccessNotification = () =>
    new Promise((resolve, _reject) => {
      const observer = new MutationObserver((mutations) => {
        const addedNodes = getAddedNodes(mutations);

        const [notification] = queryAll(addedNodes, '.ToastNotificationContent');
        if (notification) {
          observer.disconnect();
          console.debug('=>> Found notification.', { notification });
          return resolve(notification);
        }
        console.debug('=>> Mutation, but notification?', { mutations });
      });

      const notificationsDiv = document.querySelector('.ToastManager');
      console.debug('=>> Observing…', notificationsDiv);
      observer.observe(notificationsDiv, { subtree: true, childList: true });
    });

  const getCurrentTaskUrlFromCopyLinkButton = async () => {
    const observerWaiting = waitForSuccessNotification();
    document.querySelector('.TaskPaneToolbar-copyLinkButton,.ConversationToolbar-copyLinkButton').click();

    console.info('=>> Waiting for copied link…');
    await observerWaiting;
    console.info('=>> Reading copied link…');
    const href = await navigator.clipboard.readText();
    console.debug('=>> Read:', { href }); // TODO: should we verify that the href is actually an URL pointing to app.asana.com?
    return href;
  };

  const getCurrentTaskUrlFromPage = async () => {
    const taskPane = document.querySelector('.TaskPane[data-task-id]');
    if (taskPane) {
      const taskId = taskPane.getAttribute('data-task-id');
      return `https://app.asana.com/0/0/${taskId}/f`;
    }

    const conversationLink = document.querySelector('.ConversationPane .ConversationTitleAndContext-title a[href]');
    if (conversationLink) return conversationLink.href;

    // Fallback to Asana's "Copy Link" button.
    return await getCurrentTaskUrlFromCopyLinkButton();
  };

  // Get a Markdown link for the current task formatted as [Task Title](Link)
  const getMDLink = async (ev) => {
    console.debug('=>> Click:', ev);
    const href = await getCurrentTaskUrlFromPage();

    if (ev.metaKey || ev.ctrlKey || ev.altKey || ev.button === 1) {
      // meta for MacOS, ctrl for Windows, middle click, or alt for good measure
      console.info('=>> Opening tab…', { href });
      return window.open(href, '_blank').focus();
    }

    var title = document.querySelector('.TaskPaneToolbarAnimation-title,.ConversationTitleAndContext-title').innerText;
    var markdown = `[${title}](${href})`;
    console.info('=>> Pasting…', markdown);
    await navigator.clipboard.writeText(markdown);

    animateButton(ev.srcElement);
  };

  const toggleReadOnly = async (ev) => {
    const taskEditable = document.querySelector('#TaskDescriptionView .ProseMirror');
    if (!taskEditable) {
      return;
    }
    const editable = taskEditable.getAttribute('contenteditable') !== 'true';
    taskEditable.setAttribute('contenteditable', editable);

    // '\u{1F4DD}' = 📝
    // '\u{1F4D6}' = 📖
    ev.srcElement.innerHTML = editable ? '\u{1F4DD}' : '\u{1F4D6}';
    animateButton(ev.srcElement);
  };

  // Switch between dark and light themes
  function switchTheme(ev) {
    const currentTheme = document.body.classList;

    const targetTheme =
      currentTheme.contains('DesignTokenThemeSelectors-theme--darkMode') || currentTheme.contains('DesignTokenThemeSelectors-theme--systemDarkMode')
        ? 'DesignTokenThemeSelectors-theme--lightMode'
        : 'DesignTokenThemeSelectors-theme--darkMode';

    currentTheme.remove(
      'DesignTokenThemeSelectors-theme--systemDarkMode',
      'DesignTokenThemeSelectors-theme--systemLightMode',
      'DesignTokenThemeSelectors-theme--darkMode',
      'DesignTokenThemeSelectors-theme--lightMode'
    );
    currentTheme.add(targetTheme);

    setButtonsTheme(document.getElementById(buttonDivId));
    animateButton(ev.srcElement);
  }

  function setButtonsTheme(buttonDiv) {
    const currentTheme = document.body.classList;
    if (currentTheme.contains('DesignTokenThemeSelectors-theme--darkMode') || currentTheme.contains('DesignTokenThemeSelectors-theme--systemDarkMode')) {
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
  function showAllComments(ev) {
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
    animateButton(ev.srcElement);
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
